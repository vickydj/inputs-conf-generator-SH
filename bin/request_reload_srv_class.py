"""Scripted input: asks the DS to reload its server classes, so newly generated
deployment apps and whitelist entries are picked up.

Writes one key=value event per run (sourcetype input_conf_generator:status).
Needs passAuth = splunk-system-user in inputs.conf.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import input_conf_generator_common as common  # noqa: E402

logger = common.setup_logger("input_conf_generator_srv_class")


def main():
    try:
        service = common.service_from_token(common.read_session_key_from_stdin())
        settings = common.get_settings(service)
        token = common.get_ds_token(service)
    except common.ConfigurationError as exc:
        logger.error("%s", exc)
        print(common.kv_event(check="ds_reload", status="not_configured", message=exc))
        return 1

    try:
        status, body = common.ds_request(settings, token, "POST", common.DS_RELOAD_PATH, logger=logger)
    except Exception as exc:
        logger.exception("DS reload request failed")
        print(common.kv_event(check="ds_reload", status="unreachable", ds_host=settings["ds_host"], message=exc))
        return 1

    ok = 200 <= status < 300
    if ok:
        logger.info("DS reload requested, http_status=%s", status)
    else:
        logger.error("DS reload failed, http_status=%s body=%s", status, body)
    print(common.kv_event(check="ds_reload", status="ok" if ok else "error",
                          ds_host=settings["ds_host"], http_status=status))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
