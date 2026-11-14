import { splitList, validatePayloadForm } from "./validators.js";

define([
  "react",
  "splunkjs/splunk",
  'underscore',
  'jquery',
  'splunkjs/mvc',
  'splunkjs/mvc/utils',
  'splunkjs/mvc/tokenutils',
  'splunkjs/mvc/simplexml/ready!'
], function(
  react,
  splunk_js_sdk,
  _,
  $,
  SplunkMVC,
  utils,
  TokenUtils
) {
  const e = react.createElement;

  const Logger = {
    info: (message, data) => {
      console.log(`[INFO] ${message}`, data || '');
    },
    error: (message, error) => {
      console.error(`[ERROR] ${message}`, error);
    },
    warn: (message, data) => {
      console.warn(`[WARN] ${message}`, data || '');
    }
  };
  const TokenManager = {
    initialize: function() {
      try {
        // Get the default token model
        const defaultTokens = SplunkMVC.Components.get('default');

        if (!defaultTokens) {
          throw new Error('Could not get default token model');
        }

        return defaultTokens;
      } catch (error) {
        Logger.error("Error initializing tokens:", error);
        return null;
      }
    }
  };

  const MAX_CHIPS = 200;

  // [name, label, required, placeholder]; precedence is a select and is rendered separately.
  const TEXT_FIELDS = [
    ["message_payload", "Message", true, "RFC123456 / JIRA1234 - Create monitor on apache logs"],
    ["my_index", "Index", true, "web"],
    ["my_sourcetype", "Sourcetype", true, "access_combined"],
    ["my_source", "Source Paths (comma-separated)", true, "/path/to/file1.log, /path/to/file2.log"],
    ["my_host", "Hosts (comma-separated)", true, "hostname1, hostname2, web*"],
    ["app_name", "App Name", true, "my_apache_log"],
    ["environment", "Environment", true, "test OR qa OR dev OR prod OR anything you like ;)"],
    ["version", "Version", false, "1.0.0"],
  ];

  class PayloadConfigPage extends react.Component {
    constructor(props) {
      super(props);
      Logger.info('PayloadConfigPage initialized');

      this.state = {
        message_payload: '',
        precedence: 'low',
        my_index: '',
        my_sourcetype: '',
        my_source: '',
        my_host: '',
        app_name: '',
        environment: '',
        version: '1.0.0',
        generatedPayload: null,
        copySuccess: false,
        errors: {},
        clients: null,       // null = loading, [] = none found
        clientsError: '',
        clientFilter: '',
      };

      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.copyToClipboard = this.copyToClipboard.bind(this);
      this.tokens = null;
    }

    componentDidMount() {
      this.tokens = TokenManager.initialize();
      this.loadClients();
    }

    // Deployment clients known to the DS, through this app's endpoint (the DS token stays server side).
    loadClients() {
      const service = new splunk_js_sdk.Service(new splunk_js_sdk.SplunkWebHttp(),
        { owner: "nobody", app: "input_conf_generator_sh", sharing: "app" });
      service.get("/services/input_conf_generator/clients", { output_mode: "json" }, (err, response) => {
        if (err) {
          const message = (err.data && err.data.message) || `HTTP ${err.status || "error"}`;
          Logger.warn("Could not load deployment clients", err);
          this.setState({ clients: [], clientsError: message });
          return;
        }
        this.setState({ clients: (response.data && response.data.clients) || [], clientsError: '' });
      });
    }

    handleChange(event) {
      const { name, value } = event.target;
      this.setState(prevState => {
        const errors = { ...prevState.errors };
        delete errors[name];
        return { ...prevState, [name]: value, errors };
      });
    }

    toggleHost(hostname) {
      const hosts = splitList(this.state.my_host);
      const next = hosts.includes(hostname) ? hosts.filter(h => h !== hostname) : hosts.concat(hostname);
      this.handleChange({ target: { name: "my_host", value: next.join(", ") } });
    }

    generatePayload() {
      return {
        message: this.state.message_payload.trim(),
        precedence: this.state.precedence,
        my_index: this.state.my_index.trim(),
        my_sourcetype: this.state.my_sourcetype.trim(),
        my_source: splitList(this.state.my_source),
        my_host: splitList(this.state.my_host),
        additional_metadata: {
          app_name: this.state.app_name.trim(),
          environment: this.state.environment.trim(),
          version: this.state.version.trim() || "1.0.0",
          timestamp: new Date().toISOString()
        }
      };
    }

    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(this.state.generatedPayload, null, 2)
        );
        this.setState({ copySuccess: true });
        setTimeout(() => this.setState({ copySuccess: false }), 2000);
      } catch (err) {
        Logger.error('Failed to copy:', err);
        alert('Failed to copy payload to clipboard');
      }
    }

    handleSubmit(event) {
      event.preventDefault();
      const trimmed = {};
      TEXT_FIELDS.forEach(([name]) => { trimmed[name] = this.state[name].trim(); });
      const errors = validatePayloadForm({ ...trimmed, precedence: this.state.precedence });
      if (Object.keys(errors).length) {
        this.setState({ errors, generatedPayload: null });
        if (this.tokens) this.tokens.unset("jspayload");
        return;
      }
      const payload = this.generatePayload();
      this.setState({ generatedPayload: payload, errors: {} });
      if (!this.tokens) {
        Logger.error("Token model not available");
        return;
      }
      // base64 keeps quotes, $ and backslashes from breaking out of the SPL string.
      const json = JSON.stringify(payload);
      this.tokens.set("jspayload", btoa(String.fromCharCode(...new TextEncoder().encode(json))));
      // A new payload needs fresh consent before it is sent.
      this.tokens.unset("consent_token1");
      const submitted = SplunkMVC.Components.get("submitted");
      if (submitted) {
        submitted.unset("consent_token1");
      }
      alert("Payload generated. Check the payload below, tick the consent box at the top and press Submit to send it.");
    }

    renderField([name, label, required, placeholder]) {
      const error = this.state.errors[name];
      return e("div", { className: "form-group", key: name }, [
        e("label", { htmlFor: name, className: required ? "required" : "", key: "l" }, label),
        e("input", {
          key: "i",
          type: "text",
          id: name,
          name: name,
          value: this.state[name],
          onChange: this.handleChange,
          placeholder: placeholder,
          required: required,
          className: error ? "input-error" : "",
        }),
        error && e("div", { className: "field-error", key: "e" }, error),
        name === "my_host" && this.renderClientPicker(),
      ]);
    }

    renderClientPicker() {
      const { clients, clientsError, clientFilter } = this.state;
      if (clients === null) {
        return e("div", { className: "field-hint", key: "p" }, "Loading deployment clients from the DS...");
      }
      if (clientsError) {
        return e("div", { className: "field-hint", key: "p" }, `Could not load deployment clients: ${clientsError}. Type the hosts instead.`);
      }
      if (!clients.length) {
        return e("div", { className: "field-hint", key: "p" }, "The DS reports no deployment clients yet. Type the hosts instead.");
      }
      const selected = splitList(this.state.my_host);
      const filter = clientFilter.trim().toLowerCase();
      const matching = clients.filter(c => !filter || c.hostname.toLowerCase().includes(filter) || (c.ip || "").includes(filter));
      return e("div", { className: "client-picker", key: "p" }, [
        e("input", {
          key: "f",
          type: "text",
          value: clientFilter,
          placeholder: `Filter ${clients.length} deployment clients by name or IP, click to add or remove`,
          onChange: (ev) => this.setState({ clientFilter: ev.target.value }),
        }),
        ...matching.slice(0, MAX_CHIPS).map(c => e("span", {
          key: c.hostname,
          className: "client-chip" + (selected.includes(c.hostname) ? " selected" : ""),
          title: [c.ip, c.last_phone_home && `last phone home: ${c.last_phone_home}`].filter(Boolean).join(" | "),
          onClick: () => this.toggleHost(c.hostname),
        }, c.hostname)),
        matching.length > MAX_CHIPS && e("div", { className: "field-hint", key: "more" },
          `${matching.length - MAX_CHIPS} more; narrow the filter.`),
      ]);
    }

    render() {
      const [messageField, ...otherFields] = TEXT_FIELDS;
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header", key: "h" }, [
          e("h2", { key: "t" }, "Self service - add monitor form"),
          e("h3", { key: "s" }, "Please enter the necessary configuration items"),
        ]),

        e("hr", { key: "hr" }),

        e("form", {
          key: "form",
          onSubmit: this.handleSubmit,
          className: "setup-form",
          noValidate: true,
        }, [
          this.renderField(messageField),
          e("div", { className: "form-group", key: "precedence" }, [
            e("label", { htmlFor: "precedence", className: "required", key: "l" }, "Precedence - Don't change unless you are overriding the lower precedence app"),
            e("select", {
              key: "s",
              id: "precedence",
              name: "precedence",
              value: this.state.precedence,
              onChange: this.handleChange,
              required: true
            }, [
              e("option", { value: "low", key: "low" }, "Low"),
              e("option", { value: "normal", key: "normal" }, "Normal"),
              e("option", { value: "high", key: "high" }, "High")
            ]),
            this.state.errors.precedence && e("div", { className: "field-error", key: "e" }, this.state.errors.precedence),
          ]),
          ...otherFields.map(field => this.renderField(field)),

          e("div", { className: "form-group", key: "submit" },
            e("input", {
              type: "submit",
              value: "Generate Payload",
              className: "submit-button"
            })
          )
        ]),

        // Payload Display Section
        this.state.generatedPayload && e("div", { className: "form-group", key: "out" }, [
          e("h3", { key: "t" }, "Generated Payload"),
          e("p", { className: "field-hint", key: "n" }, "Your Splunk username is added when the payload is sent."),
          e("button", {
            key: "c",
            onClick: this.copyToClipboard,
            className: "copy-button"
          }, this.state.copySuccess ? "Copied!" : "Copy to Clipboard"),
          e("pre", { key: "p" }, JSON.stringify(this.state.generatedPayload, null, 2))
        ])
      ]);
    }
  }

  return e(PayloadConfigPage);
});
