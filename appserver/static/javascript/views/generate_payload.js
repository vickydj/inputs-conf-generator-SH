define([
  "react",
  "splunkjs/mvc",
  "splunkjs/mvc/simplexml/ready!"
], function(react, mvc) {
  "use strict";
  const e = react.createElement;
  const SEND_PATH = "/services/input_conf_generator/send";

  // Mirrors the DS-side rules (input_conf_generator_lib.py). The DS stays authoritative.
  const PATTERNS = {
    name: "[A-Za-z0-9][A-Za-z0-9_\\-]{0,79}",
    index: "[a-z0-9][a-z0-9_\\-]{0,79}",
    sourcetype: "[A-Za-z0-9_][A-Za-z0-9_.:\\-]{0,99}",
    version: "\\d{1,4}(\\.\\d{1,4}){0,3}"
  };

  const EMPTY_FORM = {
    message_payload: "",
    precedence: "low",
    my_index: "",
    my_sourcetype: "",
    my_source: "",
    my_host: "",
    app_name: "",
    environment: "",
    version: "1.0.0"
  };

  function splitList(value) {
    return value.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  }

  class PayloadConfigPage extends react.Component {
    constructor(props) {
      super(props);
      this.state = {
        form: Object.assign({}, EMPTY_FORM),
        busy: false,
        preview: null,   // last dry-run response (only valid for the current form)
        result: null,    // last real send response
        consent: false
      };
      this.service = mvc.createService();
      this.handleChange = this.handleChange.bind(this);
      this.handlePreview = this.handlePreview.bind(this);
      this.handleSend = this.handleSend.bind(this);
    }

    buildPayload() {
      const f = this.state.form;
      return {
        message: f.message_payload.trim(),
        precedence: f.precedence,
        my_index: f.my_index.trim(),
        my_sourcetype: f.my_sourcetype.trim(),
        my_source: splitList(f.my_source),
        my_host: splitList(f.my_host),
        additional_metadata: {
          app_name: f.app_name.trim(),
          environment: f.environment.trim(),
          version: f.version.trim() || "1.0.0",
          timestamp: new Date().toISOString()
        }
      };
    }

    // Any edit invalidates the preview and the consent given for it.
    handleChange(event) {
      const { name, value } = event.target;
      this.setState(prev => ({
        form: Object.assign({}, prev.form, { [name]: value }),
        preview: null,
        result: null,
        consent: false
      }));
    }

    callSend(dryRun) {
      const body = JSON.stringify({ payload: this.buildPayload(), dry_run: dryRun });
      return new Promise(resolve => {
        this.service.request(
          SEND_PATH, "POST", { output_mode: "json" }, {}, body,
          { "Content-Type": "application/json" },
          (err, response) => {
            if (err) {
              const data = (err.data && typeof err.data === "object") ? err.data
                : { status: "error", message: "HTTP " + (err.status || "?") + " calling " + SEND_PATH };
              resolve(data);
            } else {
              resolve(response.data);
            }
          }
        );
      });
    }

    async handlePreview(event) {
      event.preventDefault();
      this.setState({ busy: true, preview: null, result: null, consent: false });
      const preview = await this.callSend(true);
      this.setState({ busy: false, preview: preview });
    }

    async handleSend() {
      if (!this.canSend()) {
        return;
      }
      this.setState({ busy: true });
      const result = await this.callSend(false);
      this.setState({ busy: false, result: result, consent: false });
    }

    canSend() {
      const p = this.state.preview;
      return !this.state.busy && this.state.consent && p && p.status === "success" && !this.state.result;
    }

    field(name, label, opts) {
      opts = opts || {};
      return e("div", { className: "form-group", key: name }, [
        e("label", { htmlFor: name, className: opts.required === false ? "" : "required", key: "l" }, label),
        e(opts.multiline ? "textarea" : "input", {
          key: "i",
          type: "text",
          id: name,
          name: name,
          value: this.state.form[name],
          onChange: this.handleChange,
          placeholder: opts.placeholder || "",
          pattern: opts.pattern,
          title: opts.title,
          rows: opts.multiline ? 3 : undefined,
          required: opts.required !== false
        })
      ]);
    }

    renderOutcome(data, heading) {
      if (!data) {
        return null;
      }
      const ds = (data.ds_response && data.ds_response.result) || {};
      const errors = data.errors || (data.ds_response && data.ds_response.errors) || [];
      const ok = data.status === "success";
      const list = (label, items) => (items && items.length)
        ? e("li", { key: label }, label + ": " + items.join(", ")) : null;
      return e("div", { className: "form-group outcome " + (ok ? "outcome-ok" : "outcome-error"), key: heading }, [
        e("h3", { key: "h" }, heading + ": " + (data.message || data.status)),
        errors.length ? e("ul", { key: "e" }, errors.map((msg, i) => e("li", { key: i }, msg))) : null,
        ok ? e("ul", { key: "r" }, [
          e("li", { key: "app" }, "Deployment app: " + ds.app + (ds.new_app ? " (new)" : "")),
          e("li", { key: "sc" }, "Server class: " + ds.serverclass + " (" + ds.serverclass_status + ")"),
          list("Inputs to add", ds.inputs_added),
          list("Inputs already present", ds.inputs_skipped),
          list("Hosts to add", ds.hosts_added),
          list("Hosts already present", ds.hosts_skipped)
        ]) : null
      ]);
    }

    render() {
      const previewOk = this.state.preview && this.state.preview.status === "success";
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header", key: "header" }, [
          e("h2", { key: "t" }, "Self service - add monitor form"),
          e("p", { key: "d" }, "Fill in the form, preview the change (nothing is written), then confirm and send it to the deployment server.")
        ]),
        e("hr", { key: "hr" }),
        e("form", { onSubmit: this.handlePreview, className: "setup-form", key: "form" }, [
          this.field("message_payload", "Message (change reference and description)", {
            placeholder: "RFC123456 / JIRA1234 - Create monitor on apache logs"
          }),
          e("div", { className: "form-group", key: "precedence" }, [
            e("label", { htmlFor: "precedence", className: "required", key: "l" },
              "Precedence - don't change unless you are overriding a lower-precedence app"),
            e("select", {
              key: "s", id: "precedence", name: "precedence",
              value: this.state.form.precedence, onChange: this.handleChange, required: true
            }, [
              e("option", { value: "low", key: "low" }, "Low"),
              e("option", { value: "normal", key: "normal" }, "Normal"),
              e("option", { value: "high", key: "high" }, "High")
            ])
          ]),
          this.field("my_index", "Index", { pattern: PATTERNS.index, title: "Lowercase letters, digits, _ and -" }),
          this.field("my_sourcetype", "Sourcetype", { pattern: PATTERNS.sourcetype, title: "Letters, digits, _ . : -" }),
          this.field("my_source", "Source paths (absolute, comma or newline separated)", {
            multiline: true, placeholder: "/var/log/httpd/access.log, /var/log/httpd/error.log"
          }),
          this.field("my_host", "Hosts (comma or newline separated, wildcards like web* allowed)", {
            multiline: true, placeholder: "web01, web02"
          }),
          this.field("app_name", "App name", { pattern: PATTERNS.name, placeholder: "apache", title: "Letters, digits, _ and -" }),
          this.field("environment", "Environment", { pattern: PATTERNS.name, placeholder: "prod", title: "Letters, digits, _ and -" }),
          this.field("version", "Version", { pattern: PATTERNS.version, required: false, placeholder: "1.0.0" }),
          e("div", { className: "form-group", key: "preview" },
            e("input", {
              type: "submit", className: "submit-button", disabled: this.state.busy,
              value: this.state.busy && !previewOk ? "Checking..." : "Preview (dry run)"
            }))
        ]),
        this.renderOutcome(this.state.preview, "Preview"),
        previewOk && !this.state.result ? e("div", { className: "form-group", key: "consent" }, [
          e("label", { key: "c", className: "consent" }, [
            e("input", {
              key: "cb", type: "checkbox", checked: this.state.consent,
              onChange: ev => this.setState({ consent: ev.target.checked })
            }),
            " I agree and take responsibility for having Splunk monitor the files above on the hosts above."
          ]),
          e("button", {
            key: "send", type: "button", className: "submit-button",
            disabled: !this.canSend(), onClick: this.handleSend
          }, this.state.busy ? "Sending..." : "Send to deployment server")
        ]) : null,
        this.renderOutcome(this.state.result, "Result")
      ]);
    }
  }

  return e(PayloadConfigPage);
});
