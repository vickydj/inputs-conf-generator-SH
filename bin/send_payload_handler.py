"""Persistent REST handler for POST /services/input_conf_generator/send.

Only callers with the ``input_conf_generator_send`` capability get here
(restmap.conf). The handler reads the DS token with the *system* session key
(passSystemAuth), so end users never need ``list_storage_passwords`` and
never see the token.

Request body:  {"payload": {...form fields...}, "dry_run": true|false}
Response body: {"status": "success"|"error", "message": str,
                "ds_http_status": int, "ds_response": {...}}
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from splunk.persistconn.application import PersistentServerConnectionApplication  # type: ignore  # noqa: E402

import input_conf_generator_common as common  # noqa: E402

logger = common.setup_logger("input_conf_generator_sh")
MAX_BODY_BYTES = 256 * 1024
REQUIRED = ("message", "my_index", "my_sourcetype", "my_source", "my_host")
REQUIRED_META = ("app_name", "environment")


def _response(status, body):
    return {"payload": body, "status": status, "headers": {"Content-Type": "application/json"}}


def _as_list(value):
    if isinstance(value, str):
        value = value.split(",")
    if not isinstance(value, list):
        return None
    return [str(v).strip() for v in value if str(v).strip()]


def prepare_payload(payload, user):
    """Light client-side checks; the DS is authoritative and returns detailed errors."""
    if not isinstance(payload, dict):
        return None, ["payload must be a JSON object"]
    errors = [f"{key} is required" for key in REQUIRED if not payload.get(key)]
    meta = payload.get("additional_metadata")
    if not isinstance(meta, dict):
        meta = {}
    errors += [f"{key} is required" for key in REQUIRED_META if not meta.get(key)]
    for key in ("my_source", "my_host"):
        if payload.get(key) and _as_list(payload[key]) is None:
            errors.append(f"{key} must be a list or comma-separated string")
    if errors:
        return None, errors

    out = dict(payload)
    out["my_source"] = _as_list(payload["my_source"])
    out["my_host"] = _as_list(payload["my_host"])
    out["additional_metadata"] = dict(meta, requested_by=user)  # never trust a client-supplied value
    return out, []


class SendPayloadHandler(PersistentServerConnectionApplication):
    def __init__(self, command_line, command_arg):
        super(SendPayloadHandler, self).__init__()

    def handle(self, in_string):
        request = json.loads(in_string)
        user = (request.get("session") or {}).get("user", "unknown")
        if str(request.get("method", "")).upper() != "POST":
            return _response(405, {"status": "error", "message": "Only POST is supported"})

        body = request.get("payload") or ""
        if len(body) > MAX_BODY_BYTES:
            return _response(413, {"status": "error", "message": "Request body too large"})
        try:
            parsed = json.loads(body)
        except ValueError as exc:
            return _response(400, {"status": "error", "message": f"Invalid JSON: {exc}"})
        if not isinstance(parsed, dict):
            return _response(400, {"status": "error", "message": "Body must be a JSON object"})

        dry_run = parsed.get("dry_run") is True
        payload, errors = prepare_payload(parsed.get("payload"), user)
        if errors:
            return _response(400, {"status": "error", "message": "Validation failed", "errors": errors})

        try:
            service = common.service_from_token(
                request.get("system_authtoken"), (request.get("server") or {}).get("rest_uri")
            )
            settings = common.get_settings(service)
            token = common.get_ds_token(service)
        except common.ConfigurationError as exc:
            logger.error("Not configured: %s", exc)
            return _response(503, {"status": "error", "message": str(exc)})

        logger.info("user=%s dry_run=%s app=%s sources=%d hosts=%d message=%r", user, dry_run,
                    payload["additional_metadata"].get("app_name"), len(payload["my_source"]),
                    len(payload["my_host"]), payload.get("message"))
        try:
            ds_status, ds_body = common.ds_request(
                settings, token, "POST", common.DS_RECEIVE_PATH, dict(payload, dry_run=dry_run), logger
            )
        except Exception as exc:  # network / TLS problems
            logger.exception("Could not reach the DS")
            return _response(502, {"status": "error", "message": f"Could not reach the deployment server: {exc}"})

        logger.info("user=%s dry_run=%s ds_http_status=%s ds_response=%s", user, dry_run, ds_status, json.dumps(ds_body))
        result = {"ds_http_status": ds_status, "ds_response": ds_body, "dry_run": dry_run}
        if 200 <= ds_status < 300:
            return _response(200, dict(result, status="success", message="Dry run OK" if dry_run else "Sent to DS"))
        if ds_status == 400:
            errors = ds_body.get("errors", []) if isinstance(ds_body, dict) else []
            return _response(400, dict(result, status="error", message="Rejected by DS", errors=errors))
        if ds_status in (401, 403):
            message = ("DS rejected the auth token: check that it has not expired and that its user has "
                       "the input_conf_generator_sender role")
        else:
            message = f"DS returned HTTP {ds_status}"
        return _response(502, dict(result, status="error", message=message))

    def handleStream(self, handle, in_string):
        raise NotImplementedError("Streaming is not supported")

    def done(self):
        pass
