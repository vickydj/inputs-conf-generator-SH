import * as Setup from "./store_secret.js";

define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk){
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

  class SetupPage extends react.Component {
    constructor(props) {
      super(props);
      Logger.info('SetupPage initialized');
    
      this.state = {
        ds_host: '',
        ds_mgmt_port: '',
        ds_token: '',
        serverclass_reload_cron: ''
      };
    
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
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

    async handleSubmit(event) {
      event.preventDefault();
      Logger.info('Form submission started', { formData: this.state });

      try {
        await Setup.perform(splunk_js_sdk, this.state);
        Logger.info('Form submission completed successfully');
        alert ("Configuration Completed Successfully. Please wait for the app to reload.");
      } catch (error) {
        Logger.error('Form submission failed:', error);
        alert ("Configuration Failed. Please try again.");
        
      }
    }

    componentDidMount() {
      Logger.info('Component mounted');
    }

    componentWillUnmount() {
      Logger.info('Component will unmount');
    }

    render() {
      Logger.info('Rendering SetupPage');
      
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header" }, [
          e("h2", null, "Configure App input_generator_dashboard_sh"),
          e("h3", null, "Please enter the necessary configuration items for inputs and other related configuration to be created and deployed."),
          e("h3", null, "All Fields are Required."),
          e("h3", null, "Author: Vignesh Narendran"),
        ]),
    
        e("hr", null),
    
        e("form", { 
          onSubmit: this.handleSubmit, 
          className: "setup-form",
          onInvalid: (e) => Logger.warn('Form validation failed:', { field: e.target.name })
        }, [
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "ds_host" }, "DS Address (IP Address or Hostname)"),
            e("input", { 
              type: "text", 
              id: "ds_host",
              name: "ds_host", 
              value: this.state.ds_host, 
              onChange: this.handleChange,
              required: true,

            })
          ]),
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "ds_mgmt_port" }, "DS Management Port"),
            e("input", { 
              type: "text", 
              id: "ds_mgmt_port",
              name: "ds_mgmt_port", 
              value: this.state.ds_mgmt_port, 
              onChange: this.handleChange,
              required: true,

            })
          ]),
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "ds_token" }, "DS Auth Token"),
            e("input", { 
              type: "text", 
              id: "ds_token",
              name: "ds_token", 
              value: this.state.ds_token, 
              onChange: this.handleChange,
              required: true,

            })
          ]),
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "serverclass_reload_cron" }, "Server Class Reload Schedule (Cron Expression)"),
            e("input", { 
              type: "text", 
              id: "serverclass_reload_cron",
              name: "serverclass_reload_cron", 
              value: this.state.serverclass_reload_cron, 
              onChange: this.handleChange,
              placeholder: "*/30 * * * *",
              required: true,

            })
          ]),
          e("div", { className: "form-group" }, 
            e("input", { 
              type: "submit", 
              value: "Submit", 
              className: "submit-button",
              onClick: () => Logger.info('Submit button clicked')
            })
          )
        ])
      ]);
    }
  }

  Logger.info('Initializing SetupPage component');
  return e(SetupPage);
});
