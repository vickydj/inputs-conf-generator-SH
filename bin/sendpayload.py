"""| sendpayload payload=<json or base64 json> [dryrun=<bool>]

Generating command, a thin wrapper around POST /services/input_conf_generator/send.
It runs as the searching user, so the input_conf_generator_send capability
(restmap.conf) decides who can use it. The command never touches the DS token.

Example:
    | sendpayload dryrun=t payload="{\"message\":\"RFC1\",\"my_index\":\"web\", ...}"
"""

import base64
import binascii
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from splunklib.binding import HTTPError  # noqa: E402
from splunklib.searchcommands import Configuration, GeneratingCommand, Option, dispatch, validators  # noqa: E402

SEND_PATH = "/services/input_conf_generator/send"


def decode_payload(raw):
    raw = (raw or "").strip()
    if not raw.startswith("{"):
        try:
            raw = base64.b64decode(raw, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError):
            raise ValueError("payload must be a JSON object or base64-encoded JSON")
    return json.loads(raw)


def flatten(prefix, value, out):
    if isinstance(value, dict):
        for key, inner in value.items():
            flatten(f"{prefix}.{key}" if prefix else key, inner, out)
    elif isinstance(value, list):
        out[prefix] = value if value else ""
    else:
        out[prefix] = value
    return out


@Configuration(type="reporting", distributed=False)
class SendPayloadCommand(GeneratingCommand):
    payload = Option(require=True, doc="Payload as JSON, or base64-encoded JSON (dashboard-safe).")
    dryrun = Option(require=False, default=False, validate=validators.Boolean(),
                    doc="Validate on the DS and report what would change, without writing.")

    def generate(self):
        try:
            payload = decode_payload(self.payload)
        except ValueError as exc:
            yield {"_time": time.time(), "status": "error", "message": str(exc)}
            return

        body = json.dumps({"payload": payload, "dry_run": bool(self.dryrun)})
        try:
            response = self.service.post(SEND_PATH, headers=[("Content-Type", "application/json")], body=body)
            result = json.loads(response.body.read() or b"{}")
        except HTTPError as exc:
            raw = getattr(exc, "body", b"") or b""
            try:
                result = json.loads(raw)
            except (TypeError, ValueError):
                result = {"status": "error", "message": f"HTTP {exc.status}: {exc.reason}"}

        row = {"_time": time.time()}
        flatten("", result, row)
        yield row


dispatch(SendPayloadCommand, sys.argv, sys.stdin, sys.stdout, __name__)
