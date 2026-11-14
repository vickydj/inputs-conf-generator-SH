import * as Setup from "./store_secret.js";

define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk) {
  const e = react.createElement;

  class SetupPage extends react.Component {
    constructor(props) {
      super(props);
      this.state = {
        ds_host: "",
        ds_mgmt_port: "8089",
        ds_token: "",
        ssl_verify: true,
        ca_cert_path: "",
        serverclass_reload_cron: "",
        token_stored: false,
        legacy_cleartext_token: false,
        loading: true,
        saving: false,
        errors: [],
        saved: false
      };
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
    }

    async componentDidMount() {
      try {
        const current = await Setup.load(splunk_js_sdk);
        this.setState(Object.assign({ loading: false }, current));
      } catch (error) {
        console.error("Could not load current configuration", error);
        this.setState({ loading: false });
      }
    }

    handleChange(event) {
      const { name, type, checked, value } = event.target;
      this.setState({ [name]: type === "checkbox" ? checked : value, errors: [], saved: false });
    }

    async handleSubmit(event) {
      event.preventDefault();
      const errors = Setup.validate(this.state, this.state.token_stored);
      if (errors.length) {
        this.setState({ errors: errors });
        return;
      }
      this.setState({ saving: true, errors: [] });
      try {
        await Setup.perform(splunk_js_sdk, this.state);
        this.setState({ saving: false, saved: true, ds_token: "", token_stored: true });
        Setup.finish();
      } catch (error) {
        console.error("Setup failed", error);
        const detail = (error && (error.data && error.data.messages && error.data.messages[0] && error.data.messages[0].text))
          || (error && error.message) || String(error);
        this.setState({ saving: false, errors: ["Saving the configuration failed: " + detail] });
      }
    }

    input(name, label, opts) {
      opts = opts || {};
      return e("div", { className: "form-group", key: name }, [
        e("label", { htmlFor: name, className: opts.required ? "required" : "", key: "l" }, label),
        e("input", {
          key: "i",
          type: opts.type || "text",
          id: name,
          name: name,
          value: this.state[name],
          onChange: this.handleChange,
          placeholder: opts.placeholder || "",
          required: Boolean(opts.required),
          autoComplete: opts.type === "password" ? "new-password" : "off"
        }),
        opts.help ? e("div", { className: "help-text", key: "h" }, opts.help) : null
      ]);
    }

    render() {
      if (this.state.loading) {
        return e("div", { className: "setup-container" }, "Loading current configuration...");
      }
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header", key: "header" }, [
          e("h2", { key: "t" }, "Configuration Wizard"),
          e("p", { className: "setup-description", key: "d" },
            "Connection details for the deployment server that runs input_conf_generator_ds."),
          e("p", { className: "setup-author", key: "a" }, "Developed by Vignesh Narendran")
        ]),
        e("hr", { key: "hr" }),
        this.state.legacy_cleartext_token ? e("div", { className: "outcome outcome-error form-group", key: "legacy" },
          "A cleartext token from an older version was found in ds_info.conf. Saving this page moves it to " +
          "encrypted storage and blanks it. Also revoke the old token on the DS.") : null,
        this.state.errors.length ? e("div", { className: "outcome outcome-error form-group", key: "errors" },
          e("ul", null, this.state.errors.map((msg, i) => e("li", { key: i }, msg)))) : null,
        this.state.saved ? e("div", { className: "outcome outcome-ok form-group", key: "ok" },
          "Configuration saved. Reloading the app...") : null,
        e("form", { onSubmit: this.handleSubmit, className: "setup-form", key: "form" }, [
          this.input("ds_host", "DS address (IP address or hostname)", { required: true, placeholder: "ds.example.com" }),
          this.input("ds_mgmt_port", "DS management port", { required: true, placeholder: "8089" }),
          this.input("ds_token", "DS auth token", {
            type: "password",
            required: !this.state.token_stored,
            placeholder: this.state.token_stored ? "A token is stored. Leave blank to keep it." : "",
            help: "Token of a DS user that has only the input_conf_generator_sender role. It is stored encrypted in storage/passwords."
          }),
          e("div", { className: "form-group", key: "ssl_verify" },
            e("label", { className: "consent" }, [
              e("input", { key: "c", type: "checkbox", name: "ssl_verify", checked: this.state.ssl_verify, onChange: this.handleChange }),
              " Verify the DS TLS certificate (recommended; only untick for lab environments)"
            ])),
          this.input("ca_cert_path", "CA bundle path (optional)", {
            placeholder: "$SPLUNK_HOME/etc/auth/my_ca.pem",
            help: "PEM file of the CA that signed the DS certificate. Leave blank to use the system CA store."
          }),
          this.input("serverclass_reload_cron", "Server class reload schedule (cron expression or seconds)", {
            placeholder: "*/30 * * * * (default)"
          }),
          e("div", { className: "form-group", key: "submit" },
            e("input", {
              type: "submit", className: "submit-button", disabled: this.state.saving,
              value: this.state.saving ? "Saving..." : "Save"
            }))
        ])
      ]);
    }
  }

  return e(SetupPage);
});
