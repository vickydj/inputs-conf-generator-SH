"""REST endpoints of this app (restmap.conf). Splunk checks the capability before calling us.

POST /services/input_conf_generator/send     forward a payload to the DS   (input_conf_generator_send)
GET  /services/input_conf_generator/clients  deployment clients of the DS  (input_conf_generator_send)
GET  /services/input_conf_generator/test     DS connection check           (admin_all_objects)

The handler reads the DS token with the system session key (passSystemAuth),
so users never need list_storage_passwords and never see the token.
The DS validates the payload; this side only stamps it with the logged-in user.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ds_client  # noqa: E402
from splunk.persistconn.application import PersistentServerConnectionApplication  # type: ignore  # noqa: E402

logger = ds_client.get_logger("input_conf_generator_sh")


def reply(body, status=200):
    return {"payload": body, "status": status}


class SendPayloadHandler(PersistentServerConnectionApplication):
    def __init__(self, command_line, command_arg):
        super().__init__()

    def handle(self, in_string):
        request = json.loads(in_string)
        user = (request.get("session") or {}).get("user")
        action = (request.get("rest_path") or "/send").rstrip("/").rsplit("/", 1)[-1]
        key = request["system_authtoken"]
        try:
            if action == "clients":
                return reply({"status": "success", "clients": ds_client.list_clients(key)})
            if action == "test":
                ok, detail = ds_client.check_connection(key)
                return reply({"status": "success" if ok else "error", "message": detail}, 200 if ok else 502)
            return self.send(key, user, request.get("payload") or "{}")
        except Exception as e:
            logger.error(f"user={user} {action}: could not reach the DS: {e}")
            return reply({"status": "error", "message": f"Could not reach the DS: {e}"}, 502)

    def send(self, key, user, body):
        try:
            payload = json.loads(body)
        except ValueError:
            payload = None
        if not isinstance(payload, dict):
            return reply({"status": "error", "message": "The request body must be a JSON object"}, 400)
        # Who sent it comes from the Splunk session, never from the browser.
        payload["submitted_by"] = user or ""
        response = ds_client.ds_request(key, "POST", "/services/receive_payload",
                                        data=json.dumps(payload).encode("utf-8"),
                                        headers={"Content-Type": "application/json"})
        logger.info(f"user={user} DS HTTP {response.status_code}: {response.text[:1000]}")
        try:
            ds_body = response.json()
        except ValueError:
            ds_body = {"status": "error", "message": response.text[:500]}
        return reply(ds_body, response.status_code)
