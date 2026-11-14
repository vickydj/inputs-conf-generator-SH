"""Shared by the scripts in bin/: DS settings, the DS token and a logger."""
import configparser
import json
import logging
import logging.handlers
import os

import splunk.rest  # type: ignore  # ships with Splunk

CONF = os.path.join(os.environ.get("SPLUNK_HOME", ""), "etc", "apps", "input_conf_generator_sh", "local", "ds_info.conf")
SECRET = "/servicesNS/nobody/input_conf_generator_sh/storage/passwords/ds_auth_token:nobody:"  # written by the setup page


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
    return f"https://{props['ds_host']}:{int(props['ds_mgmt_port'])}", token, verify
