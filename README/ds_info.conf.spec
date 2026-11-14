[properties]
ds_host = <string>
* Hostname or IP address of the deployment server.

ds_mgmt_port = <integer>
* Management port of the deployment server.
* Default: 8089

ssl_verify = <boolean>
* Whether to verify the deployment server's TLS certificate.
* Only set this to false for lab environments.
* Default: true

ca_cert_path = <string>
* Optional path to a PEM CA bundle that signs the DS certificate.
* May contain $SPLUNK_HOME. If empty, the system CA store is used.
* Default: (empty)

ds_token = <string>
* DEPRECATED, and ignored since 1.1.0. The token is now kept in storage/passwords.
* The setup page blanks this value when it finds one.
