# input_conf_generator_sh 

This app only works if the peer - ds app is installed <app name>, and set up page is configured with details of the DS Without either of them, the functionality is broken.

## Current functionality : 


### Self-service form 

- Admins will need to generate an auth token from DS and configure the setup page with required details.
  
- Dashboard builds a json payload from user inputs. 

- Dashboard calls custom command which invokes python to send payload to DS.

- Generates the payload, then sends it only after the consent box is ticked and Submit is pressed.

### Setup page

- Admin only. Asks for the DS host, port and auth token.
- The token is stored encrypted in storage/passwords (`ds_auth_token`). It is never written to `ds_info.conf`.
- Use a token of a DS account that has only the `input_conf_generator_sender` role (defined by the DS app).
- TLS to the DS is verified by default. If the DS uses a private CA, set `ssl_verify = <path to CA .pem>` in
  `local/ds_info.conf`. `ssl_verify = false` turns verification off; use that for labs only. See `README/ds_info.conf.spec`.

### Who can send

- Sending goes through the endpoint `/services/input_conf_generator/send`. Only roles with the
  `input_conf_generator_send` capability can call it: `admin` and `power` by default (`default/authorize.conf`).
- The endpoint reads the token itself, so users never see it.

### Before merging

Every pull request runs `.github/workflows/validate.yml`. It fails if:
- a test fails;
- `local/`, `local.meta`, `*.backup`, a token, a `$7$` secret or a private key is committed;
- a REST endpoint skips authentication, `web.conf` exposes an endpoint, or Python turns off TLS verification;
- Splunk AppInspect (precert) reports any failure.

Make **Validate Splunk app** a required status check on `master`. Locally, `python3 -m unittest discover -s tests` runs the tests.

Requires Splunk Enterprise 10.2+ (Python 3.13/3.14).

## Feature enhancements:

• Get list of UF from DS, read token from ds_info.conf

• Add username to payload. And add in inputs.conf.

• Populate setup page if configured.

• replicate the dashboard with a js script page to generate payload.

• Add validations to setup page.

• Add validations to payload generation page.


   



