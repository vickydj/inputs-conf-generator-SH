"""Scripted input: checks that the configured DS is reachable and accepts the token.

Writes one key=value event per run (sourcetype input_conf_generator:status), so
you can alert on status!="ok". Needs passAuth = splunk-system-user in inputs.conf.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import input_conf_generator_common as common  # noqa: E402

logger = common.setup_logger("input_conf_generator_ping_test")


def main():
    try:
        service = common.service_from_token(common.read_session_key_from_stdin())
        settings = common.get_settings(service)
        token = common.get_ds_token(service)
    except common.ConfigurationError as exc:
        logger.error("%s", exc)
        print(common.kv_event(check="ds_connection", status="not_configured", message=exc))
        return 1

    try:
        status, _ = common.ds_request(settings, token, "GET", common.DS_INFO_PATH, logger=logger)
    except Exception as exc:
        logger.exception("DS connection failed")
        print(common.kv_event(check="ds_connection", status="unreachable", ds_host=settings["ds_host"], message=exc))
        return 1

    ok = status == 200
    (logger.info if ok else logger.error)("DS connection check http_status=%s", status)
    print(common.kv_event(check="ds_connection", status="ok" if ok else "error",
                          ds_host=settings["ds_host"], http_status=status))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
