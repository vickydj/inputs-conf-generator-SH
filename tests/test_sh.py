"""Run with:  python3 -m unittest discover -s tests   (no Splunk needed).

If the DS repo is checked out next to this one (../inputs-conf-generator-DS),
the end-to-end test runs the real DS handler behind an HTTPS server with a
self-signed certificate.
"""
import base64
import json
import os
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import types
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DS_BIN = ROOT.parent / "inputs-conf-generator-DS" / "bin"
sys.path.insert(0, str(ROOT / "bin"))

_pc = types.ModuleType("splunk.persistconn.application")
_pc.PersistentServerConnectionApplication = type("PersistentServerConnectionApplication", (), {"__init__": lambda self: None})
for name, mod in {"splunk": types.ModuleType("splunk"), "splunk.persistconn": types.ModuleType("splunk.persistconn"),
                  "splunk.persistconn.application": _pc}.items():
    sys.modules.setdefault(name, mod)

TMP = tempfile.mkdtemp()
os.environ["SPLUNK_HOME"] = TMP
os.makedirs(os.path.join(TMP, "var", "log", "splunk"), exist_ok=True)

import input_conf_generator_common as common  # noqa: E402
import send_payload_handler  # noqa: E402
import sendpayload  # noqa: E402


def form(**overrides):
    base = {
        "message": "RFC1 apache", "precedence": "high", "my_index": "web", "my_sourcetype": "access_combined",
        "my_source": "/var/log/a.log, /var/log/b.log", "my_host": ["web01"],
        "additional_metadata": {"app_name": "apache", "environment": "prod", "requested_by": "spoofed"},
    }
    base.update(overrides)
    return base


class PrepareTests(unittest.TestCase):
    def test_requested_by_is_session_user(self):
        out, errors = send_payload_handler.prepare_payload(form(), "alice")
        self.assertEqual(errors, [])
        self.assertEqual(out["additional_metadata"]["requested_by"], "alice")
        self.assertEqual(out["my_source"], ["/var/log/a.log", "/var/log/b.log"])

    def test_missing_fields(self):
        _, errors = send_payload_handler.prepare_payload({"message": "x"}, "alice")
        self.assertIn("my_index is required", errors)
        self.assertIn("app_name is required", errors)

    def test_decode_payload(self):
        raw = json.dumps(form())
        self.assertEqual(sendpayload.decode_payload(raw), form())
        self.assertEqual(sendpayload.decode_payload(base64.b64encode(raw.encode()).decode()), form())
        with self.assertRaises(ValueError):
            sendpayload.decode_payload("not-base64!!")

    def test_kv_event_escaping(self):
        self.assertEqual(common.kv_event(a='x"y', b="1\n2"), 'a="x\\"y" b="1 2"')


@unittest.skipUnless(DS_BIN.exists() and shutil.which("openssl"), "DS repo or openssl not available")
class EndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(DS_BIN))
        import receive_process_payload as ds_handler
        cls.ds_home = Path(tempfile.mkdtemp())
        ds_handler.SPLUNK_HOME = str(cls.ds_home)

        cert_dir = Path(tempfile.mkdtemp())
        cls.cert = cert_dir / "cert.pem"
        key = cert_dir / "key.pem"
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
                        "-addext", "subjectAltName=DNS:localhost", "-keyout", str(key), "-out", str(cls.cert)],
                       check=True, capture_output=True)

        class DS(BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers["Content-Length"])).decode()
                if self.headers.get("Authorization") != "Bearer good-token":
                    self.send_response(401); self.end_headers(); return
                envelope = {"method": "POST", "payload": body, "session": {"user": "svc_sender"}}
                result = ds_handler.ReceivePayloadHandler("", "").handle(json.dumps(envelope))
                data = json.dumps(result["payload"]).encode()
                self.send_response(result["status"]); self.end_headers(); self.wfile.write(data)

            def log_message(self, *args):
                pass

        cls.server = HTTPServer(("127.0.0.1", 0), DS)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(str(cls.cert), str(key))
        cls.server.socket = context.wrap_socket(cls.server.socket, server_side=True)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def call(self, body, token="good-token", ca=None):
        settings = {"ds_host": "localhost", "ds_mgmt_port": self.server.server_port, "ssl_verify": True,
                    "ca_cert_path": str(ca or self.cert)}
        common.service_from_token = lambda *a, **k: object()
        common.get_settings = lambda service: settings
        common.get_ds_token = lambda service: token
        envelope = {"method": "POST", "payload": json.dumps(body), "session": {"user": "alice"},
                    "system_authtoken": "x", "server": {"rest_uri": "https://127.0.0.1:8089"}}
        return send_payload_handler.SendPayloadHandler("", "").handle(json.dumps(envelope))

    def test_dry_run_then_send(self):
        r = self.call({"payload": form(), "dry_run": True})
        self.assertEqual(r["status"], 200, r)
        self.assertEqual(r["payload"]["ds_response"]["result"]["app"], "_prod_web_apache")
        self.assertFalse((self.ds_home / "etc" / "deployment-apps" / "_prod_web_apache").exists())

        r = self.call({"payload": form(), "dry_run": False})
        self.assertEqual(r["status"], 200, r)
        inputs = (self.ds_home / "etc" / "deployment-apps" / "_prod_web_apache" / "default" / "inputs.conf").read_text()
        self.assertIn("[monitor:///var/log/b.log]", inputs)
        self.assertIn("Requested by: alice (via svc_sender)", inputs)

    def test_ds_validation_errors_surface(self):
        r = self.call({"payload": form(my_host=["*"])})
        self.assertEqual(r["status"], 400)
        self.assertTrue(any("wildcard" in e for e in r["payload"]["errors"]))

    def test_bad_token(self):
        r = self.call({"payload": form()}, token="bad")
        self.assertEqual(r["status"], 502)
        self.assertIn("rejected the auth token", r["payload"]["message"])

    def test_untrusted_certificate_rejected(self):
        r = self.call({"payload": form()}, ca="/nonexistent-ca.pem")
        self.assertEqual(r["status"], 502)


if __name__ == "__main__":
    unittest.main()
