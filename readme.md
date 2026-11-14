# input_conf_generator_sh 

This app only works if the peer - ds app is installed <app name>, and set up page is configured with details of the DS Without either of them, the functionality is broken.

## Current functionality : 


### Self-service form 

- Admins will need to generate an auth token from DS and configure the setup page with required details.
  
- Dashboard builds a json payload from user inputs. 

- Dashboard calls custom command which invokes python to send payload to DS.

- Generates the payload, then sends it only after the consent box is ticked and Submit is pressed.

- Every field is checked in the browser with the same rules the DS app uses (`appserver/static/javascript/views/validators.js`),
  so mistakes show next to the field before anything is sent. The DS still validates everything.

- The Hosts field lists the deployment clients that phone home to the DS (`/services/input_conf_generator/clients`).
  Filter them and click to add or remove; you can still type hosts or wildcards such as `web*`.

- The SH adds the Splunk user who pressed Submit to the payload (`submitted_by`). The DS writes it in the comments
  of `inputs.conf` and `serverclass.conf`. A user cannot change it from the browser.

### Setup page

- Admin only. Asks for the DS host, port and auth token.
- Shows the saved host, port and reload schedule when it is opened again. The token is never shown;
  leave it empty to keep the saved one.
- Checks the fields before saving, then tests the connection to the DS (`/services/input_conf_generator/test`)
  and shows the result.
- The token is stored encrypted in storage/passwords (`ds_auth_token`). It is never written to `ds_info.conf`.
- Use a token of a DS account that has only the `input_conf_generator_sender` role (defined by the DS app).
- TLS to the DS is verified by default. If the DS uses a private CA, set `ssl_verify = <path to CA .pem>` in
  `local/ds_info.conf`. `ssl_verify = false` turns verification off; use that for labs only. See `README/ds_info.conf.spec`.

### Who can send

- Sending goes through the endpoint `/services/input_conf_generator/send`. Only roles with the
  `input_conf_generator_send` capability can call it: `admin` and `power` by default (`default/authorize.conf`).
  The same capability allows `/services/input_conf_generator/clients`; the connection test needs `admin_all_objects`.
- The endpoint reads the token itself, so users never see it.

### Before merging

Every pull request runs `.github/workflows/validate.yml`. It fails if:
- a test fails;
- `local/`, `local.meta`, `*.backup`, a token, a `$7$` secret or a private key is committed;
- a REST endpoint skips authentication, `web.conf` exposes an endpoint, or Python turns off TLS verification;
- Splunk AppInspect (precert) reports any failure.

Make **Validate Splunk app** a required status check on `master`. Locally, `python3 -m unittest discover -s tests`
and `node --test tests/*.test.mjs` (Node 22+) run the tests.

Requires Splunk Enterprise 10.2+ (Python 3.13/3.14).

## Feature enhancements:

Done:
- Get list of UF from DS (#9). Token is read from storage/passwords, not ds_info.conf (#7).
- Add username to payload and in inputs.conf (#8).
- Populate setup page if configured.
- Add validations to setup page (#6) and payload generation page (#5).
- DS connection test on the setup page (#4).

Open:
- Send the payload straight from the JS page instead of the `| sendpayload` search.
