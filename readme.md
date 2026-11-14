# input_conf_generator_sh

Search-head half of the Input Conf Generator. It needs
[`input_conf_generator_ds`](https://github.com/vickydj/inputs-conf-generator-DS)
on the deployment server, and the setup page must be completed.

## How it works

```
Self-service form ──POST──▶ /services/input_conf_generator/send   (this app, SH)
   (dashboard)              │  needs capability input_conf_generator_send
| sendpayload  ─────────────┘  reads DS token from storage/passwords (system auth)
                               │
                               └──HTTPS (TLS verified)──▶ /services/receive_payload (DS app)
                                                          needs capability input_conf_generator_write
```

1. **Preview.** The form sends a `dry_run`. The DS validates the request and replies with the
   deployment app, the server class, and which inputs and hosts would be added or are already present. Nothing is written.
2. **Consent and send.** The send button only appears after a successful preview, and only works once
   the consent box is ticked. Editing any field resets the preview and the consent.
3. **Reload.** A scripted input calls the DS server-class reload every 30 minutes (configurable).
   A second scripted input checks the DS connection every 5 minutes. Both write `status=…` events with sourcetype
   `input_conf_generator:status`.

Logs: `$SPLUNK_HOME/var/log/splunk/input_conf_generator_*.log` (sourcetype `input_conf_generator`).

## Install and configure

1. Install `input_conf_generator_ds` on the deployment server. Create a DS service account that has only
   the `input_conf_generator_sender` role, and an auth token for it.
2. Install this app on the search head and restart.
3. As admin, open the app. Splunk redirects to the setup page (`setup_view`). Enter:
   * DS host and management port
   * the DS auth token, which is stored encrypted in `storage/passwords` and never written to a `.conf` file
   * TLS verification (on by default) and an optional CA bundle path
   * the server-class reload schedule
4. Give self-service users the **`input_conf_generator_user`** role. Users without the
   `input_conf_generator_send` capability can't call the endpoint or `| sendpayload`.

## Search command

```
| sendpayload dryrun=true payload="<JSON or base64 JSON>"
```

This calls the same endpoint as the dashboard, so the same capability check applies.

## Upgrading from 1.0.x

* **Upgrade both apps together.** The payload format and the DS authentication changed.
* **Revoke the old DS tokens.** Earlier commits contained `local/ds_info.conf`,
  `default/ds_info.backup` and `local/passwords.conf` with real tokens. Removing them from the
  current tree doesn't remove them from git history. Revoke the tokens on the DS and purge the history,
  e.g. `git filter-repo --path local --path default/ds_info.backup --path metadata/local.meta --invert-paths`.
* Re-run the setup page. It moves the token into `storage/passwords`, blanks the old cleartext
  `ds_token` in `ds_info.conf`, and removes the old `ds_auth_token` secret.

## Development

```bash
python3 -m unittest discover -s tests   # no Splunk needed; runs an HTTPS end-to-end test against
                                        # the DS handler if ../inputs-conf-generator-DS exists
```

Leave `tests/`, `.git` and `local/` out of the package. Check it with
[Splunk AppInspect](https://dev.splunk.com/enterprise/docs/developapps/testvalidate/appinspect/):
`splunk-appinspect inspect input_conf_generator_sh.tgz --mode precert`.

## Changelog

### 1.1.0
* The DS token moved to `storage/passwords`, so no cleartext secrets remain in `.conf` files. Committed secrets and `local/` were removed.
* A new authenticated, capability-protected REST endpoint sends to the DS. Users no longer need `list_storage_passwords`.
* TLS verification is on by default, with an optional CA bundle.
* The form previews via a DS dry run, and consent can't be skipped. Junk "pong"/"test" payloads are no longer sent.
* The precedence option is now `high` (older DS builds expected `high`, but the form sent `higher`).
* `| sendpayload` was rewritten on splunklib 2.1.1 (chunked protocol). It reports the real DS result.
* The scripted inputs were fixed: there was a missing `monitor_ds_connection.py`, and an empty interval from the setup page.
  They now use `passAuth` and ship disabled until setup is done.
* Setup page: password field, pre-filled from the current config, validation, a real `setup_view`, and correct `is_configured` handling.
* Metadata restricts admin objects to admin roles. Nothing is exported globally.

## Roadmap

* Get the list of forwarders from the DS so users can pick hosts.
* Move the UI to Dashboard Studio or a UCC/React app, since Simple XML custom JS is deprecated in Splunk Cloud.
