"""Shared helpers for input_conf_generator_sh.

* Settings (host, port, TLS) live in ds_info.conf; see README/ds_info.conf.spec.
* The DS auth token lives only in storage/passwords (realm/username below),
  never in a .conf file.
* Every call to the DS verifies TLS unless an admin explicitly sets ssl_verify = false.
"""

import json
import logging
import logging.handlers
import os
import ssl
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

BIN_DIR = os.path.dirname(os.path.abspath(__file__))
if BIN_DIR not in sys.path:
    sys.path.insert(0, BIN_DIR)

from splunklib import client  # noqa: E402

APP_NAME = "input_conf_generator_sh"
CONF_NAME = "ds_info"
CONF_STANZA = "properties"
SECRET_REALM = "input_conf_generator_sh"
SECRET_USERNAME = "ds_token"
DS_RECEIVE_PATH = "/services/receive_payload"
DS_RELOAD_PATH = "/services/deployment/server/config/_reload"
DS_INFO_PATH = "/services/server/info"
TIMEOUT_SECONDS = 30
TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}


class ConfigurationError(RuntimeError):
    """The app has not been configured (or is configured incorrectly)."""


def setup_logger(name, level=logging.INFO):
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(level)
    logger.propagate = False
    log_file = os.path.join(os.environ.get("SPLUNK_HOME", ""), "var", "log", "splunk", f"{name}.log")
    handler = logging.handlers.RotatingFileHandler(log_file, maxBytes=1000000, backupCount=5)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s"))
    logger.addHandler(handler)
    return logger


def service_from_token(token, rest_uri=None):
    """splunklib Service for the local splunkd, scoped to this app."""
    if not rest_uri:
        try:
            import splunk.rest  # type: ignore  # available inside Splunk's Python

            rest_uri = splunk.rest.makeSplunkdUri()
        except Exception:
            rest_uri = "https://127.0.0.1:8089"
    uri = urlparse(rest_uri)
    return client.Service(
        scheme=uri.scheme or "https",
        host=uri.hostname or "127.0.0.1",
        port=uri.port or 8089,
        token=token,
        owner="nobody",
        app=APP_NAME,
    )


def read_session_key_from_stdin():
    """Scripted inputs with ``passAuth`` receive the session key on stdin."""
    key = sys.stdin.readline().strip()
    if not key:
        raise ConfigurationError("No session key on stdin; is passAuth set in inputs.conf?")
    return key


def get_settings(service):
    try:
        props = dict(service.confs[CONF_NAME][CONF_STANZA].content)
    except KeyError:
        raise ConfigurationError("ds_info.conf [properties] not found; run the setup page")
    host = (props.get("ds_host") or "").strip()
    port = (props.get("ds_mgmt_port") or "").strip()
    if not host or not port.isdigit():
        raise ConfigurationError("ds_host / ds_mgmt_port are not configured; run the setup page")
    return {
        "ds_host": host,
        "ds_mgmt_port": int(port),
        "ssl_verify": str(props.get("ssl_verify", "true")).strip().lower() in TRUE_VALUES,
        "ca_cert_path": (props.get("ca_cert_path") or "").strip(),
    }


def get_ds_token(service):
    for secret in service.storage_passwords:
        if secret.content.get("realm") == SECRET_REALM and secret.content.get("username") == SECRET_USERNAME:
            token = secret.content.get("clear_password")
            if token:
                return token
    raise ConfigurationError("DS auth token not found in storage/passwords; run the setup page")


def _ssl_context(settings):
    if not settings["ssl_verify"]:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context
    cafile = settings["ca_cert_path"] or None
    if cafile:
        cafile = os.path.expandvars(cafile)
    return ssl.create_default_context(cafile=cafile)


def ds_request(settings, token, method, path, body=None, logger=None):
    """Call the DS management API. Returns (http_status, parsed_json_or_text)."""
    if not settings["ssl_verify"] and logger:
        logger.warning("TLS verification to the DS is DISABLED (ssl_verify = false)")
    url = f"https://{settings['ds_host']}:{settings['ds_mgmt_port']}{path}"
    url += ("&" if "?" in url else "?") + "output_mode=json"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=_ssl_context(settings)) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as exc:
        status, raw = exc.code, exc.read()
    text = raw.decode("utf-8", "replace")
    try:
        return status, json.loads(text) if text else {}
    except ValueError:
        return status, text


def kv_event(**fields):
    """One key=value line, for scripted-input output."""
    parts = []
    for key, value in fields.items():
        value = str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        parts.append(f'{key}="{value}"')
    return " ".join(parts)
