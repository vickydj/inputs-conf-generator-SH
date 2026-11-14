"""Shared by the scripts in bin/: DS settings, the DS token and a logger."""
import configparser
import json
import logging
import logging.handlers
import os
import re

import requests
import splunk.rest  # type: ignore  # ships with Splunk

CONF = os.path.join(os.environ.get("SPLUNK_HOME", ""), "etc", "apps", "input_conf_generator_sh", "local", "ds_info.conf")
SECRET = "/servicesNS/nobody/input_conf_generator_sh/storage/passwords/ds_auth_token:nobody:"  # written by the setup page
HOST_RE = re.compile(r"^[A-Za-z0-9.:-]{1,253}$")  # hostname, IPv4 or bare IPv6; same rule as the setup page


def get_logger(name):
    logger = logging.getLogger(name)
    if not logger.handlers:
        path = os.path.join(os.environ.get("SPLUNK_HOME", ""), "var", "log", "splunk", f"{name}.log")
        handler = logging.handlers.RotatingFileHandler(path, maxBytes=1000000, backupCount=5)
        handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def get_ds(session_key):
    """Returns (base_url, token, verify). ``verify`` is what requests expects:
    True, False, or the path of a CA bundle (ds_info.conf ssl_verify)."""
    config = configparser.ConfigParser(interpolation=None)
    config.read(CONF)
    props = config["properties"]
    verify = props.get("ssl_verify", "true").strip()
    verify = {"true": True, "1": True, "": True, "false": False, "0": False}.get(verify.lower(), os.path.expandvars(verify))

    response, content = splunk.rest.simpleRequest(SECRET, sessionKey=session_key, getargs={"output_mode": "json"})
    if response.status != 200:
        raise RuntimeError(f"DS token not found in storage/passwords (HTTP {response.status}); run the setup page")
    token = json.loads(content)["entry"][0]["content"]["clear_password"]
    host, port = props["ds_host"].strip(), int(props["ds_mgmt_port"])
    if not HOST_RE.match(host) or not 0 < port < 65536:
        raise RuntimeError("ds_host or ds_mgmt_port in ds_info.conf is invalid; run the setup page")
    host = f"[{host}]" if ":" in host else host
    return f"https://{host}:{port}", token, verify


def ds_request(session_key, method, path, **kwargs):
    """Calls the DS REST API with the saved token. Returns the requests response."""
    url, token, verify = get_ds(session_key)
    params = dict(kwargs.pop("params", {}), output_mode="json")
    headers = dict(kwargs.pop("headers", {}), Authorization=f"Bearer {token}")
    return requests.request(method, f"{url}{path}", params=params, headers=headers, verify=verify,
                            timeout=kwargs.pop("timeout", 60), **kwargs)


def check_connection(session_key):
    """Returns (ok, detail): can we reach the DS and does it accept the token?"""
    response = ds_request(session_key, "GET", "/services/server/info", timeout=30)
    if response.status_code != 200:
        return False, f"DS answered HTTP {response.status_code}" + (" (token rejected)" if response.status_code == 401 else "")
    info = (response.json().get("entry") or [{}])[0].get("content", {})
    return True, f"Connected to {info.get('serverName', 'DS')} (Splunk {info.get('version', '?')})"


def list_clients(session_key):
    """Deployment clients that phone home to the DS, sorted by hostname."""
    response = ds_request(session_key, "GET", "/services/deployment/server/clients", params={"count": 0})
    response.raise_for_status()
    clients = []
    for entry in response.json().get("entry", []):
        c = entry.get("content", {})
        clients.append({"hostname": c.get("hostname") or c.get("dns") or "", "ip": c.get("ip", ""),
                        "client_name": c.get("clientName", ""), "last_phone_home": c.get("lastPhoneHomeTime", "")})
    return sorted((c for c in clients if c["hostname"]), key=lambda c: c["hostname"].lower())
