"""Scripted input (passAuth): asks the DS to reload its server classes."""
import sys

import requests

import ds_client

logger = ds_client.get_logger("input_conf_generator_srv_class")

if __name__ == "__main__":
    try:
        url, token, verify = ds_client.get_ds(sys.stdin.readline().strip())
        response = requests.post(f"{url}/services/deployment/server/config/_reload",
                                 headers={"Authorization": f"Bearer {token}"},
                                 params={"output_mode": "json"}, verify=verify, timeout=60)
        status = "ok" if response.ok else "error"
        logger.info(f"DS reload: HTTP {response.status_code} {response.text[:500]}")
        print(f'check=ds_reload status={status} http_status={response.status_code}')
    except Exception as e:
        logger.error(f"DS reload failed: {e}")
        print(f'check=ds_reload status=error message="{e}"')
        sys.exit(1)
