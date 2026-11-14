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


class HandlerTests(unittest.TestCase):
    def call(self):
        envelope = {"payload": '{"message": "x"}', "system_authtoken": "sys", "session": {"user": "alice"}}
        return send_payload_handler.SendPayloadHandler("", "").handle(json.dumps(envelope))

    def test_forwards_body_with_token_and_returns_ds_answer(self):
        write_conf()
        answer = mock.Mock(status_code=400, text="{}", json=lambda: {"status": "error", "errors": ["bad"]})
        with mock.patch.object(send_payload_handler.requests, "post", return_value=answer) as post:
            result = self.call()
        self.assertEqual(result, {"payload": {"status": "error", "errors": ["bad"]}, "status": 400})
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://ds1:8089/services/receive_payload")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer tok")
        self.assertEqual(kwargs["data"], b'{"message": "x"}')
        self.assertIs(kwargs["verify"], True)

    def test_unreachable_ds_is_502(self):
        write_conf()
        with mock.patch.object(send_payload_handler.requests, "post", side_effect=OSError("refused")):
            self.assertEqual(self.call()["status"], 502)


if __name__ == "__main__":
    unittest.main()
