import { promisify } from './util.js'
import * as SplunkHelpers from './splunk_helpers.js'

// Must match bin/input_conf_generator_common.py
const CONF_NAME = "ds_info";
const CONF_STANZA = "properties";
const SECRET_REALM = "input_conf_generator_sh";
const SECRET_USERNAME = "ds_token";
const LEGACY_SECRET_REALM = "ds_auth_token";   // used by versions before 1.1.0
const SCRIPTED_INPUTS = [
  { stanza: "script://$SPLUNK_HOME/etc/apps/input_conf_generator_sh/bin/request_reload_srv_class.py", configurable: true },
  { stanza: "script://$SPLUNK_HOME/etc/apps/input_conf_generator_sh/bin/ds_connection_test.py", configurable: false },
];

async function read_ds_settings(service) {
  return (await SplunkHelpers.read_configuration_stanza(service, CONF_NAME, CONF_STANZA)) || {};
}

async function read_reload_interval(service) {
  const props = await SplunkHelpers.read_configuration_stanza(service, "inputs", SCRIPTED_INPUTS[0].stanza);
  return props && props.interval ? props.interval : "";
}

// Writes ds_info.conf. The token is never written here; a cleartext ds_token
// left over from an older version is blanked.
async function save_ds_settings(service, settings) {
  const existing = await read_ds_settings(service);
  const properties = {
    ds_host: settings.ds_host,
    ds_mgmt_port: settings.ds_mgmt_port,
    ssl_verify: settings.ssl_verify ? "true" : "false",
    ca_cert_path: settings.ca_cert_path,
  };
  if (existing.ds_token) {
    properties.ds_token = "";
  }
  await SplunkHelpers.update_configuration_file(service, CONF_NAME, CONF_STANZA, properties);
}

async function list_secrets(service) {
  let passwords = service.storagePasswords();
  passwords = await promisify(passwords.fetch.bind(passwords))();
  return { collection: passwords, entities: passwords.list() };
}

function is_our_secret(entity) {
  const p = entity.properties();
  return p.realm === SECRET_REALM && p.username === SECRET_USERNAME;
}

async function has_ds_token(service) {
  const { entities } = await list_secrets(service);
  return entities.some(is_our_secret);
}

// Creates or updates the DS token in storage/passwords and removes the legacy secret.
async function store_ds_token(service, token) {
  const { collection, entities } = await list_secrets(service);
  const existing = entities.find(is_our_secret);
  if (existing) {
    await promisify(existing.update.bind(existing))({ password: token });
  } else {
    await promisify(collection.create.bind(collection))({
      name: SECRET_USERNAME,
      realm: SECRET_REALM,
      password: token,
    });
  }
  for (const entity of entities) {
    if (entity.properties().realm === LEGACY_SECRET_REALM) {
      try {
        await promisify(entity.remove.bind(entity))();
      } catch (error) {
        console.warn("Could not remove legacy secret", error);
      }
    }
  }
}

// Enables the scripted inputs. Only the reload input takes the admin's schedule.
async function enable_scripted_inputs(service, reload_interval) {
  for (const input of SCRIPTED_INPUTS) {
    const properties = { disabled: "false" };
    if (input.configurable) {
      properties.interval = reload_interval;
    }
    await SplunkHelpers.update_configuration_file(service, "inputs", input.stanza, properties);
  }
}

// app.conf [install] is_configured = true (so Splunk stops redirecting to setup)
async function complete_setup(service) {
  await SplunkHelpers.update_configuration_file(service, "app", "install", { is_configured: "true" });
}

async function reload_splunk_app(service, app_name) {
  var apps = service.apps();
  await promisify(apps.fetch)();
  var current_app = apps.item(app_name);
  await promisify(current_app.reload)();
}

function redirect_to_splunk_app_homepage(app_name) {
  window.location.href = "/app/" + app_name;
}

function create_splunk_js_sdk_service(splunk_js_sdk, application_name_space) {
  var http = new splunk_js_sdk.SplunkWebHttp();
  return new splunk_js_sdk.Service(http, application_name_space);
}

export {
  read_ds_settings,
  read_reload_interval,
  save_ds_settings,
  has_ds_token,
  store_ds_token,
  enable_scripted_inputs,
  complete_setup,
  reload_splunk_app,
  redirect_to_splunk_app_homepage,
  create_splunk_js_sdk_service,
}
