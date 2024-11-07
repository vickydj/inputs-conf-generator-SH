import * as Setup from "./store_secret.js";

define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk){
  const e = react.createElement;

  class SetupPage extends react.Component {
    constructor(props) {
      super(props);

      this.state = {
        password: ''
      };

      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(event) {
      this.setState({ ...this.state, [event.target.name]: event.target.value})
    }

    async handleSubmit(event) {
      event.preventDefault();

      await Setup.perform(splunk_js_sdk, this.state)
    }
    render() {
      return e("div", { className: "setup-container" }, [
        e("header", { className: "setup-header" }, [
          e("h2", null, "Configure App input_generator_dashboard_sh"),
          e("h3", null, "Please enter the necessary configuration items for inputs and other related configuration to be created and deployed."),
          e("h3", null, "All Fields are Required."),
          e("h3", null, "Author: Vignesh Narendran"),
        ]),
    
        e("hr", null),
    
        e("form", { onSubmit: this.handleSubmit, className: "setup-form" }, [
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "ds_host" }, "DS Address (IP Address or Hostname)"),
            
            e("input", { 
              type: "text", 
              id: "ds_host",
              name: "ds_host", 
              value: this.state.ds_host, 
              onChange: this.handleChange,
              required: true
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
              required: true
            })
          ]),
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "ds_token" }, "SMC ID"),
            e("input", { 
              type: "text", 
              id: "ds_token",
              name: "ds_token", 
              value: this.state.ds_token, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          e("div", { className: "form-group" }, [
            e("label", { htmlFor: "password" }, "DS Auth Token"),
            e("input", { 
              type: "password", 
              id: "password",
              name: "password", 
              value: this.state.password, 
              onChange: this.handleChange,
              required: true
            })
          ]),
          e("div", { className: "form-group" }, 
            e("input", { type: "submit", value: "Submit", className: "submit-button" })
          )
        ])
      ]);
    }
    

  }

  return e(SetupPage);
});
