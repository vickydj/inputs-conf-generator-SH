"""Scripted input (passAuth): checks the DS is reachable and accepts the token."""
import sys

import requests

import ds_client

logger = ds_client.get_logger("input_conf_generator_ping_test")

if __name__ == "__main__":
    try:
        url, token, verify = ds_client.get_ds(sys.stdin.readline().strip())
        response = requests.get(f"{url}/services/server/info", headers={"Authorization": f"Bearer {token}"},
                                params={"output_mode": "json"}, verify=verify, timeout=30)
        status = "ok" if response.status_code == 200 else "error"
        logger.info(f"DS connection check: HTTP {response.status_code}")
        print(f'check=ds_connection status={status} http_status={response.status_code}')
    except Exception as e:
        logger.error(f"DS connection check failed: {e}")
        print(f'check=ds_connection status=error message="{e}"')
        sys.exit(1)
