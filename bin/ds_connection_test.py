"""Scripted input (passAuth): checks the DS is reachable and accepts the token."""
import sys

import ds_client

logger = ds_client.get_logger("input_conf_generator_ping_test")

if __name__ == "__main__":
    try:
        ok, detail = ds_client.check_connection(sys.stdin.readline().strip())
        logger.info(f"DS connection check: {detail}")
        print(f'check=ds_connection status={"ok" if ok else "error"} message="{detail}"')
    except Exception as e:
        logger.error(f"DS connection check failed: {e}")
        print(f'check=ds_connection status=error message="{e}"')
        sys.exit(1)
