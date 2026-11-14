"""python3 -m unittest discover -s tests   (no Splunk needed; splunk.* is stubbed)"""
import json, os, sys, tempfile, types, unittest
from pathlib import Path
from unittest import mock

HOME = tempfile.mkdtemp()
os.environ["SPLUNK_HOME"] = HOME
os.makedirs(os.path.join(HOME, "var", "log", "splunk"))
conf = Path(HOME, "etc", "apps", "input_conf_generator_sh", "local", "ds_info.conf")
conf.parent.mkdir(parents=True)

rest = types.ModuleType("splunk.rest")
rest.simpleRequest = lambda *a, **k: (types.SimpleNamespace(status=200),
                                      json.dumps({"entry": [{"content": {"clear_password": "tok"}}]}).encode())
pc = types.ModuleType("splunk.persistconn.application")
pc.PersistentServerConnectionApplication = object
splunk_pkg = types.ModuleType("splunk")
splunk_pkg.rest = rest
sys.modules.update({"splunk": splunk_pkg, "splunk.rest": rest,
                    "splunk.persistconn": types.ModuleType("splunk.persistconn"), "splunk.persistconn.application": pc})
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bin"))
import ds_client  # noqa: E402
import send_payload_handler  # noqa: E402


def write_conf(ssl_verify=None):
    text = "[properties]\nds_host = ds1\nds_mgmt_port = 8089\nds_token =\n"
    conf.write_text(text + (f"ssl_verify = {ssl_verify}\n" if ssl_verify is not None else ""))


class DsClientTests(unittest.TestCase):
    def test_token_from_storage_and_tls_on_by_default(self):
        write_conf()
        self.assertEqual(ds_client.get_ds("key"), ("https://ds1:8089", "tok", True))

    def test_ssl_verify_values(self):
        for value, expected in (("false", False), ("true", True), ("$SPLUNK_HOME/ca.pem", f"{HOME}/ca.pem")):
            write_conf(value)
            self.assertEqual(ds_client.get_ds("key")[2], expected)

    def test_missing_token_is_an_error(self):
        write_conf()
        with mock.patch.object(rest, "simpleRequest", lambda *a, **k: (types.SimpleNamespace(status=404), b"")):
            with self.assertRaises(RuntimeError):
                ds_client.get_ds("key")


    def test_bad_host_in_conf_is_rejected(self):
        conf.write_text("[properties]\nds_host = evil.com/x?\nds_mgmt_port = 8089\n")
        with self.assertRaises(RuntimeError):
            ds_client.get_ds("key")

    def test_ipv6_host_is_bracketed(self):
        conf.write_text("[properties]\nds_host = ::1\nds_mgmt_port = 8089\n")
        self.assertEqual(ds_client.get_ds("key")[0], "https://[::1]:8089")


class HandlerTests(unittest.TestCase):
    def call(self, rest_path="/input_conf_generator/send", payload='{"message": "x", "submitted_by": "mallory"}'):
        envelope = {"payload": payload, "system_authtoken": "sys", "session": {"user": "alice"}, "rest_path": rest_path}
        return send_payload_handler.SendPayloadHandler("", "").handle(json.dumps(envelope))

    def ds(self, status=200, body=None):
        body = body if body is not None else {}
        answer = mock.Mock(status_code=status, ok=status < 400, text=json.dumps(body), json=lambda: body)
        return mock.patch.object(ds_client.requests, "request", return_value=answer)

    def test_forwards_body_with_token_and_user_and_returns_ds_answer(self):
        write_conf()
        with self.ds(400, {"status": "error", "errors": ["bad"]}) as request:
            result = self.call()
        self.assertEqual(result, {"payload": {"status": "error", "errors": ["bad"]}, "status": 400})
        args, kwargs = request.call_args
        self.assertEqual(args, ("POST", "https://ds1:8089/services/receive_payload"))
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer tok")
        # the browser cannot pick the submitter: the session user wins
        self.assertEqual(json.loads(kwargs["data"]), {"message": "x", "submitted_by": "alice"})
        self.assertIs(kwargs["verify"], True)

    def test_non_object_body_is_400(self):
        write_conf()
        for body in ("not json", "[1, 2]"):
            self.assertEqual(self.call(payload=body)["status"], 400)

    def test_unreachable_ds_is_502(self):
        write_conf()
        with mock.patch.object(ds_client.requests, "request", side_effect=OSError("refused")):
            self.assertEqual(self.call()["status"], 502)

    def test_clients_are_listed_sorted(self):
        write_conf()
        entries = {"entry": [{"content": {"hostname": "web02", "ip": "10.0.0.2", "clientName": "c2"}},
                             {"content": {"hostname": "", "dns": "Web01", "ip": "10.0.0.1"}},
                             {"content": {"ip": "10.0.0.3"}}]}
        with self.ds(200, entries) as request:
            result = self.call("/input_conf_generator/clients")
        self.assertEqual(request.call_args.args[1], "https://ds1:8089/services/deployment/server/clients")
        self.assertEqual([c["hostname"] for c in result["payload"]["clients"]], ["Web01", "web02"])

    def test_connection_test(self):
        write_conf()
        info = {"entry": [{"content": {"serverName": "ds1", "version": "10.2.0"}}]}
        with self.ds(200, info):
            result = self.call("/input_conf_generator/test")
        self.assertEqual(result["status"], 200)
        self.assertIn("ds1", result["payload"]["message"])
        with self.ds(401):
            result = self.call("/input_conf_generator/test")
        self.assertEqual(result["status"], 502)
        self.assertIn("token rejected", result["payload"]["message"])


if __name__ == "__main__":
    unittest.main()
