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
  SplunkMVC,  // Changed name to be more explicit
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

        Logger.info("Token initialization successful");
        
        // Read and log field1 value
        const field1Value = defaultTokens.get("field1");
        Logger.info("Field1 token value:", field1Value); 
        
        // Set jspayload value
        defaultTokens.set("jspayload", "pong");
        Logger.info("jspayload token value:", defaultTokens.get("jspayload")); 

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
        version: '',
        isSubmitting: false,
        generatedPayload: null,
        copySuccess: false
      };
    
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
      this.copyToClipboard = this.copyToClipboard.bind(this);
      this.tokens = null;
    }

    shapeString(input) {
      // Convert JSON object to string
      let jsonString = JSON.stringify(input, null, 2);
      
      // Replace double quotes with single quotes
      jsonString = jsonString.replace(/"/g, "'");
      
      // Remove extra spaces around colons
      jsonString = jsonString.replace(/:\s+/g, ': ');
      
      return jsonString;
    }

    
    componentDidMount() {
      // Initialize tokens when component mounts
      this.tokens = TokenManager.initialize();
    
      if (this.tokens) {
        // Initialize component with token value if it exists
        const field1Value = this.tokens.get("field1");
        if (field1Value) {
          // this.setState({ message_payload: field1Value });
          Logger.info("mount : field1 " + field1Value);
        }
    
        // Add token change listener
        this.tokens.on("change:field1", this.handleTokenChange.bind(this));
      }
    }
    
    handleTokenChange(model, value, options) {
      Logger.info("Token changed field1:", value);
      // this.setState({ message_payload: value });
    }
    
    componentWillUnmount() {
      // Clean up token listeners
      if (this.tokens) {
        this.tokens.off("unmount change:field1", this.handleTokenChange);
      }
    }
   
    handleChange(event) {
      const { name, value } = event.target;
      Logger.info(`Form field changed: ${name}`, { value });
    
      try {
        this.setState(
          prevState => ({ ...prevState, [name]: value }),
          () => {
            // Update tokens when relevant fields change
            if (name === 'message_payload' && this.tokens) {
              // this.tokens.set("jspayload", value);
            }
    
            // Update field1 token with the generated payload
            if (name === 'precedence' && this.tokens) {
              // const payload = this.generatePayload();

              // this.tokens.set("field1", JSON.stringify(payload, null, 2));
              this.tokens.set("field1", value)
              Logger.info("Token field1 updated:", this.tokens.get("field1"));
              
            }
          }
        );
      } catch (error) {
        Logger.error('Error updating state:', error);
      }
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

    

    async handleSubmit(event) {
      event.preventDefault();
      this.setState({ isSubmitting: true });
      this.tokens.set("jspayload", "test");

      const payload = this.generatePayload();
      this.setState({ generatedPayload: payload }, () => {
        Logger.info('Generated payload:', payload);
        if (this.tokens) {
          try {
            const payloadString = JSON.stringify(payload, null, 2);
            const shaped_payload=this.shapeString(payloadString)
            Logger.info('Shaped payload:', shaped_payload);
            this.tokens.set("jspayload", shaped_payload);
            Logger.info("Token jspayload updated:", this.tokens.get("jspayload"));
            alert("Cheers !! Payload generated, now you can hit the agree checkbox and submit on the top of the page !!")
          } catch (error) {
            Logger.error("Error setting token:", error);
          }
        }
      });

      this.setState({ isSubmitting: false });
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
          
          // Message Payload
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "message_payload" }, "Message"),
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
            e("label", { htmlFor: "precedence" }, "Precedence - Don't change unless you are overriding the lower precedence app"),
            e("select", {
              id: "precedence",
              name: "precedence",
              value: this.state.precedence,
              onChange: this.handleChange,
              required: true
            }, [
              e("option", { value: "low" }, "Low"),
              e("option", { value: "normal" }, "Normal"),
              e("option", { value: "higher" }, "Higher")
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
              placeholder: "my_apache_logs",
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
              placeholder: "1.0.0",
              required: false
            })
          ]),
          

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
        this.state.generatedPayload && e("div", {  className: "form-group" }, [
          e("h3", null, "Generated Payload"),
          e("button", {
            onClick: this.copyToClipboard,
            
          }, this.state.copySuccess ? "Copied!" : "Copy to Clipboard"),
          e("pre", { 
            
          }, JSON.stringify(this.state.generatedPayload, null, 2))
        ])
      ]);
    }
  }

  return e(PayloadConfigPage);
});
