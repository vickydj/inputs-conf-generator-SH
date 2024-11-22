define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk) {
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

  const styles = {
    payloadSection: {
      margin: '20px 0',
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    },
    pre: {
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      backgroundColor: '#fff',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px'
    },
    copyButton: {
      padding: '5px 10px',
      margin: '10px 0',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }
  };

  class PayloadConfigPage extends react.Component {
    constructor(props) {
      super(props);
      Logger.info('PayloadConfigPage initialized');
    
      this.state = {
        message_payload: '',
        severity: 'info',
        my_index: '',
        my_sourcetype: '',
        my_source: '',
        my_host: '',
        app_name: '',
        environment: '',
        version: '',
        isSubmitting: false,
        generatedPayload: null,
        copySuccess: false
      };
    
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.copyToClipboard = this.copyToClipboard.bind(this);
    }
    
    handleChange(event) {
      const { name, value } = event.target;
      Logger.info(`Form field changed: ${name}`, { value });
      
      try {
        this.setState({ ...this.state, [name]: value });
      } catch (error) {
        Logger.error('Error updating state:', error);
      }
    }

    generatePayload() {
      const sourceArray = this.state.my_source.split(',').map(item => item.trim());
      const hostArray = this.state.my_host.split(',').map(item => item.trim());

      return {
        message: this.state.message_payload,
        severity: this.state.severity,
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

    async handleSubmit(event) {
      event.preventDefault();
      this.setState({ isSubmitting: true });
      Logger.info('Form submission started');
    
      try {
        const payload = this.generatePayload();
        Logger.info('Generated payload:', payload);
        
        // Update state with generated payload
        this.setState({ 
          generatedPayload: payload,
          isSubmitting: false 
        });

        // Optional: Send to Splunk
        const service = new splunk_js_sdk.Service();
        const myIndex = service.indexes().item(this.state.my_index);
        
        await myIndex.submitEvent({
          data: JSON.stringify(payload),
          sourcetype: this.state.my_sourcetype,
          source: this.state.my_source[0],
          host: this.state.my_host[0],
          time: Date.now()
        });
    
        Logger.info('Payload sent successfully to Splunk dashboard');
      } catch (error) {
        Logger.error('Failed to process payload:', error);
        alert("Error processing payload. Please check console for details.");
      } finally {
        this.setState({ isSubmitting: false });
      }
    }

    render() {
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header" }, [
          e("h2", null, "Configure Payload Generator"),
          e("h3", null, "Please enter the necessary configuration items"),
        ]),
    
        e("hr", null),
    
        e("form", { 
          onSubmit: this.handleSubmit, 
          className: "setup-form"
        }, [
          // Form groups remain the same as in your original code
          // Message Payload
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "message_payload" }, "Message"),
            e("input", { 
              type: "text", 
              id: "message_payload",
              name: "message_payload", 
              value: this.state.message_payload, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          // Severity
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "severity" }, "Severity"),
            e("select", {
              id: "severity",
              name: "severity",
              value: this.state.severity,
              onChange: this.handleChange,
              required: true
            }, [
              e("option", { value: "info" }, "Info"),
              e("option", { value: "warning" }, "Warning"),
              e("option", { value: "error" }, "Error")
            ])
          ]),
          // Index
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "my_index" }, "Index"),
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
            e("label", { htmlFor: "my_sourcetype" }, "Sourcetype"),
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
            e("label", { htmlFor: "my_source" }, "Source Paths (comma-separated)"),
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
            e("label", { htmlFor: "my_host" }, "Hosts (comma-separated)"),
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
            e("label", { htmlFor: "app_name" }, "App Name"),
            e("input", { 
              type: "text", 
              id: "app_name",
              name: "app_name", 
              value: this.state.app_name, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          // Environment
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "environment" }, "Environment"),
            e("input", { 
              type: "text", 
              id: "environment",
              name: "environment", 
              value: this.state.environment, 
              onChange: this.handleChange,
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
              required: true
            })
          ]),
          // ... other form groups ...

          // Submit Button
          e("div", { className: "form-group" }, 
            e("input", { 
              type: "submit", 
              value: this.state.isSubmitting ? "Generating..." : "Generate Payload", 
              className: "submit-button",
              disabled: this.state.isSubmitting
            })
          )
        ]),

        // Payload Display Section
        this.state.generatedPayload && e("div", { 
          style: styles.payloadSection 
        }, [
          e("h3", null, "Generated Payload"),
          e("button", {
            onClick: this.copyToClipboard,
            style: styles.copyButton
          }, this.state.copySuccess ? "Copied!" : "Copy to Clipboard"),
          e("pre", { 
            style: styles.pre 
          }, JSON.stringify(this.state.generatedPayload, null, 2))
        ])
      ]);
    }
  }

  return e(PayloadConfigPage);
});
