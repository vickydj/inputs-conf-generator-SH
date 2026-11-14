"""POST /services/input_conf_generator/send  (restmap.conf).

Splunk only lets callers with the input_conf_generator_send capability in.
The handler reads the DS token with the system session key (passSystemAuth),
so users never need list_storage_passwords and never see the token.
The request body is the payload JSON. It is forwarded as-is; the DS validates it.
"""
import json
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ds_client  # noqa: E402
from splunk.persistconn.application import PersistentServerConnectionApplication  # type: ignore  # noqa: E402

logger = ds_client.get_logger("input_conf_generator_sh")


class SendPayloadHandler(PersistentServerConnectionApplication):
    def __init__(self, command_line, command_arg):
        super().__init__()

    def handle(self, in_string):
        request = json.loads(in_string)
        user = (request.get("session") or {}).get("user")
        body = request.get("payload") or "{}"
        try:
            url, token, verify = ds_client.get_ds(request["system_authtoken"])
            response = requests.post(f"{url}/services/receive_payload", data=body.encode("utf-8"),
                                     headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                                     params={"output_mode": "json"}, verify=verify, timeout=60)
        except Exception as e:
            logger.error(f"user={user} could not send to DS: {e}")
            return {"payload": {"status": "error", "message": f"Could not reach the DS: {e}"}, "status": 502}
        logger.info(f"user={user} DS HTTP {response.status_code}: {response.text[:1000]}")
        try:
            ds_body = response.json()
        except ValueError:
            ds_body = {"status": "error", "message": response.text[:500]}
        return {"payload": ds_body, "status": response.status_code}
