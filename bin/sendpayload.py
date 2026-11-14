"""| sendpayload  - sends the "payload" field of the first result to the DS.

"payload" is base64 of the JSON built by the dashboard (base64 keeps it safe
inside SPL). The command calls this app's /input_conf_generator/send endpoint
with the searching user's session, so the input_conf_generator_send capability
decides who may send.
"""
import base64
import json

import splunk.Intersplunk  # type: ignore
import splunk.rest  # type: ignore

if __name__ == "__main__":
    results, _, settings = splunk.Intersplunk.getOrganizedResults()
    try:
        payload = base64.b64decode(results[0]["payload"], validate=True).decode("utf-8")
        response, content = splunk.rest.simpleRequest(
            "/services/input_conf_generator/send", sessionKey=settings["sessionKey"],
            method="POST", jsonargs=payload, getargs={"output_mode": "json"})
        body = json.loads(content or b"{}")
        row = {"http_status": response.status, "status": body.get("status"), "message": body.get("message", ""),
               "errors": body.get("errors", []), "script_status": body.get("Script_status", "")}
    except Exception as e:
        row = {"status": "error", "message": str(e)}
    splunk.Intersplunk.outputResults([row])
