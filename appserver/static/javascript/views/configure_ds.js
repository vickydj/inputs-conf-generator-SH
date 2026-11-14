import * as Setup from "./store_secret.js";
import { validateSetupForm } from "./validators.js";

define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk){
  const e = react.createElement;

  const Logger = {
    info: (message, data) => {
      console.log(`[INFO] ${message}`, data || '');
    },
    error: (message, error) => {
      console.error(`[ERROR] ${message}`, error);
    },
  };

  // [name, label, required, placeholder, type]
  const FIELDS = [
    ["ds_host", "DS Address (IP Address or Hostname)", true, "ds.example.com", "text"],
    ["ds_mgmt_port", "DS Management Port", true, "8089", "text"],
    ["ds_token", "DS Auth Token", true, "", "password"],
    ["serverclass_reload_cron", "Server Class Reload Schedule (Cron Expression OR Frequency in seconds)", false,
      "Default if not configured : */30 * * * *", "text"],
  ];

  class SetupPage extends react.Component {
    constructor(props) {
      super(props);

      this.state = {
        ds_host: '',
        ds_mgmt_port: '',
        ds_token: '',
        serverclass_reload_cron: '',
        token_saved: false,
        loading: true,
        saving: false,
        errors: {},
        result: null,  // {ok, message} after saving
      };

      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
    }

    async componentDidMount() {
      try {
        const saved = await Setup.load(splunk_js_sdk);
        this.setState({ ...saved, loading: false });
      } catch (error) {
        Logger.error('Could not read the saved configuration', error);
        this.setState({ loading: false });
      }
    }

    handleChange(event) {
      const { name, value } = event.target;
      this.setState(prevState => {
        const errors = { ...prevState.errors };
        delete errors[name];
        return { [name]: value, errors, result: null };
      });
    }

    async handleSubmit(event) {
      event.preventDefault();
      const errors = validateSetupForm(this.state, this.state.token_saved);
      if (Object.keys(errors).length) {
        this.setState({ errors });
        return;
      }
      this.setState({ saving: true, result: null });
      try {
        await Setup.perform(splunk_js_sdk, this.state);
      } catch (error) {
        Logger.error('Saving the configuration failed:', error);
        const message = (error && error.data && error.data.messages && error.data.messages[0] && error.data.messages[0].text) || "please try again";
        this.setState({ saving: false, result: { ok: false, message: `Splunk could not save the configuration: ${message}` } });
        return;
      }
      const test = await Setup.test_connection(splunk_js_sdk);
      this.setState({
        saving: false,
        ds_token: '',
        token_saved: true,
        result: test.ok
          ? { ok: true, message: `Configuration saved. ${test.message}.` }
          : { ok: false, message: `Configuration saved, but the DS connection test failed: ${test.message}. Check the address, port, token and TLS settings.` },
      });
    }

    renderField([name, label, required, placeholder, type]) {
      const error = this.state.errors[name];
      const isToken = name === "ds_token";
      return e("div", { className: "form-group", key: name }, [
        e("label", { htmlFor: name, className: required ? "required" : "", key: "l" }, label),
        e("input", {
          key: "i",
          type: type,
          id: name,
          name: name,
          value: this.state[name],
          onChange: this.handleChange,
          placeholder: isToken && this.state.token_saved ? "A token is saved. Leave empty to keep it." : placeholder,
          autoComplete: isToken ? "new-password" : "off",
          className: error ? "input-error" : "",
        }),
        error && e("div", { className: "field-error", key: "e" }, error),
      ]);
    }

    render() {
      const { loading, saving, result } = this.state;
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header", key: "h" }, [
            e("h2", { key: "t" }, "Configuration Wizard"),
            e("p", { className: "setup-description", key: "d" },
                "Please provide the required configuration parameters below. These settings will be used to communicate with deployment-server ."
            ),
            e("p", { className: "setup-author", key: "a" },
                "Developed by Vignesh Narendran"
            ),
        ]),

        e("hr", { key: "hr" }),

        loading
          ? e("div", { className: "loading", key: "loading" }, "Loading the saved configuration...")
          : e("form", { onSubmit: this.handleSubmit, className: "setup-form", noValidate: true, key: "form" }, [
              ...FIELDS.map(field => this.renderField(field)),
              e("div", { className: "form-group", key: "submit" },
                e("input", {
                  type: "submit",
                  value: saving ? "Saving and testing..." : "Save and test connection",
                  className: "submit-button",
                  disabled: saving,
                })
              ),
            ]),

        result && e("div", { className: result.ok ? "success-message" : "error-message", key: "result" }, [
          e("span", { key: "m" }, result.message + " "),
          result.ok && e("a", { href: "#", key: "go", onClick: (ev) => { ev.preventDefault(); Setup.go_to_app(); } }, "Open the app"),
        ]),
      ]);
    }
  }

  return e(SetupPage);
});
