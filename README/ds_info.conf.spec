[properties]
ds_host = <string>
* Deployment server hostname or IP.

ds_mgmt_port = <integer>
* Deployment server management port, e.g. 8089.

ssl_verify = <true|false|path>
* true (default): verify the DS certificate against the system CA store.
* <path>: verify against this PEM CA bundle; $SPLUNK_HOME is expanded.
* false: no verification. Lab use only.

ds_token = <string>
* Deprecated and ignored. The token is kept in storage/passwords by the setup page.
