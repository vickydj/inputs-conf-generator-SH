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
        copySuccess: false
      };
    
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.copyToClipboard = this.copyToClipboard.bind(this);
      this.tokens = null;
    }

    componentDidMount() {
      this.tokens = TokenManager.initialize();
    }

    handleChange(event) {
      const { name, value } = event.target;
      this.setState(prevState => ({ ...prevState, [name]: value }));
    }

    generatePayload() {
      const sourceArray = this.state.my_source.split(',').map(item => item.trim());
      const hostArray = this.state.my_host.split(',').map(item => item.trim());
    
      return {
        message: this.state.message_payload,
        precedence: this.state.precedence,
        my_index: this.state.my_index,
        my_sourcetype: this.state.my_sourcetype,
        my_source: sourceArray,
        my_host: hostArray,
        additional_metadata: {
          app_name: this.state.app_name,
          environment: this.state.environment,
          version: this.state.version,
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
      const payload = this.generatePayload();
      this.setState({ generatedPayload: payload });
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

    render() {
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header" }, [
          e("h2", null, "Self service - add monitor form"),
          e("h3", null, "Please enter the necessary configuration items"),
        ]),
    
        e("hr", null),
    
        e("form", { 
          onSubmit: this.handleSubmit, 
          className: "setup-form"
        }, [
          
          // Message Payload
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "message_payload", className: "required" }, "Message"),


            e("input", { 
              type: "text", 
              id: "message_payload",
              name: "message_payload", 
              value: this.state.message_payload, 
              onChange: this.handleChange,
              placeholder: "RFC123456 / JIRA1234 - Create monitor on apache logs",
              required: true
            })
          ]),
          // Precedence
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "precedence", className: "required"  }, "Precedence - Don't change unless you are overriding the lower precedence app"),
            e("select", {
              id: "precedence",
              name: "precedence",
              value: this.state.precedence,
              onChange: this.handleChange,
              required: true
            }, [
              e("option", { value: "low" }, "Low"),
              e("option", { value: "normal" }, "Normal"),
              e("option", { value: "high" }, "High")
            ])
          ]),
          // Index
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "my_index", className: "required"  }, "Index"),
            e("input", { 
              type: "text", 
              id: "my_index",
              name: "my_index", 
              value: this.state.my_index, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          // Sourcetype
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "my_sourcetype", className: "required"  }, "Sourcetype"),
            e("input", { 
              type: "text", 
              id: "my_sourcetype",
              name: "my_sourcetype", 
              value: this.state.my_sourcetype, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          // Source (comma-separated)
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "my_source", className: "required"  }, "Source Paths (comma-separated)"),
            e("input", { 
              type: "text", 
              id: "my_source",
              name: "my_source", 
              value: this.state.my_source, 
              onChange: this.handleChange,
              placeholder: "/path/to/file1.log, /path/to/file2.log",
              required: true
            })
          ]),
          // Host (comma-separated)
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "my_host", className: "required"  }, "Hosts (comma-separated)"),
            e("input", { 
              type: "text", 
              id: "my_host",
              name: "my_host", 
              value: this.state.my_host, 
              onChange: this.handleChange,
              placeholder: "hostname1, hostname2",
              required: true
            })
          ]),
          // App Name
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "app_name", className: "required"  }, "App Name"),
            e("input", { 
              type: "text", 
              id: "app_name",
              name: "app_name", 
              value: this.state.app_name, 
              onChange: this.handleChange,
              placeholder: "my_apache_log",
              required: true
            })
          ]),
          // Environment
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "environment", className: "required"  }, "Environment"),
            e("input", { 
              type: "text", 
              id: "environment",
              name: "environment", 
              value: this.state.environment, 
              onChange: this.handleChange,
              placeholder: "test OR qa OR dev OR prod OR anything you like ;)",
              required: true
            })
          ]),
          // Version
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "version" }, "Version"),
            e("input", { 
              type: "text", 
              id: "version",
              name: "version", 
              value: this.state.version, 
              onChange: this.handleChange,
              placeholder: "1.0.0 - feature not yet implemented",
              required: false
            })
          ]),
          

          // Submit Button
          e("div", { className: "form-group" }, 
            e("input", { 
              type: "submit", 
              value: "Generate Payload",
              className: "submit-button"
            })
          )
        ]),

        // Payload Display Section
        this.state.generatedPayload && e("div", {  className: "form-group" }, [
          e("h3", null, "Generated Payload"),
          e("button", {
            onClick: this.copyToClipboard,
            className: "copy-button"
            
          }, this.state.copySuccess ? "Copied!" : "Copy to Clipboard"),
          e("pre", { 
            
          }, JSON.stringify(this.state.generatedPayload, null, 2))
        ])
      ]);
    }
  }

  return e(PayloadConfigPage);
});
