import { promisify } from './util.js'
import * as SplunkHelpers from './splunk_helpers.js'

//create ds_info.conf
async function create_custom_configuration_file(  splunk_js_sdk_service,  ds_host,  ds_mgmt_port,  ds_token ) 
{
  console.log("Updating ds_info.conf")
  var custom_configuration_file_name = "ds_info";
  var stanza_name = "properties";
  var properties_to_update = {
      ds_host: ds_host,
      ds_mgmt_port: ds_mgmt_port,
      ds_token: ds_token,
    };

  await SplunkHelpers.update_configuration_file(splunk_js_sdk_service,custom_configuration_file_name,stanza_name,properties_to_update,);
};

//update app.conf - is_configured
async function complete_setup(splunk_js_sdk_service) {
  console.log("setup_configuration.js called");
  
  var configuration_file_name = "app";
  var stanza_name = "install";
  var properties_to_update = {
      is_configured: "true",
      
  };

  await SplunkHelpers.update_configuration_file(splunk_js_sdk_service,configuration_file_name,stanza_name,properties_to_update,);
};

//configure scripted inputs for reload srvclass
async function create_inputs_conf(splunk_js_sdk_service, serverclass_reload_cron) 
{
  console.log("Updating inputs.conf with cron", serverclass_reload_cron);
 
  const configuration_file_name = "inputs";
  const stanza_name = "script://$SPLUNK_HOME/etc/apps/input_conf_generator_sh/bin/request_reload_srv_class.py"
  const properties_to_update = {
      interval: serverclass_reload_cron,
      disabled: "false",
  };

  try {
      await SplunkHelpers.update_configuration_file(splunk_js_sdk_service,configuration_file_name,stanza_name,properties_to_update,);
      console.log("updated inputs.conf");
  } catch (error) {
      console.error("Error updating inputs.conf:", error);
      throw error;
  }
}


async function reload_splunk_app(  splunk_js_sdk_service,  app_name,) 
{
  var splunk_js_sdk_apps = splunk_js_sdk_service.apps();
  await promisify(splunk_js_sdk_apps.fetch)();

  var current_app = splunk_js_sdk_apps.item(app_name);
  await promisify(current_app.reload)();
};

function redirect_to_splunk_app_homepage(  app_name,) 
{
  var redirect_url = "/app/" + app_name;

  window.location.href = redirect_url;
};

function create_splunk_js_sdk_service(  splunk_js_sdk,  application_name_space,)
{
  var http = new splunk_js_sdk.SplunkWebHttp();

  var splunk_js_sdk_service = new splunk_js_sdk.Service(
      http,
      application_name_space,
  );

  return splunk_js_sdk_service;
};

export {
  create_custom_configuration_file,
  complete_setup,
  reload_splunk_app,
  create_inputs_conf,
  redirect_to_splunk_app_homepage,
  create_splunk_js_sdk_service,
}
