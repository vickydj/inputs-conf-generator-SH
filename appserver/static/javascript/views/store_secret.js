"use strict";

import { promisify } from './util.js'
import * as Config from './setup_configuration.js'

const app_name = "input_conf_generator_sh";
const RELOAD_STANZA = "script://$SPLUNK_HOME/etc/apps/input_conf_generator_sh/bin/request_reload_srv_class.py";

function service_for(splunk_js_sdk) {
    return Config.create_splunk_js_sdk_service(splunk_js_sdk, { owner: "nobody", app: app_name, sharing: "app" });
}

// GET that resolves to null on 404 instead of failing.
async function get_or_null(service, path) {
    try {
        return await promisify(service.get.bind(service))(path, { output_mode: "json" });
    } catch (error) {
        if (error && error.status === 404) return null;
        throw error;
    }
}

// What is saved already, to pre-fill the form. The token itself is never read back.
export async function load(splunk_js_sdk) {
    const service = service_for(splunk_js_sdk);
    const [ds_info, inputs, secret] = await Promise.all([
        get_or_null(service, "configs/conf-ds_info/properties"),
        get_or_null(service, "configs/conf-inputs/" + encodeURIComponent(RELOAD_STANZA)),
        get_or_null(service, "storage/passwords/" + encodeURIComponent("ds_auth_token:nobody:")),
    ]);
    const content = (response) => (response && response.data && response.data.entry && response.data.entry[0].content) || {};
    return {
        ds_host: content(ds_info).ds_host || "",
        ds_mgmt_port: content(ds_info).ds_mgmt_port || "",
        serverclass_reload_cron: content(inputs).interval || "",
        token_saved: secret !== null,
    };
}

// Asks the DS through this app's endpoint whether the saved settings work. Returns {ok, message}.
export async function test_connection(splunk_js_sdk) {
    const service = service_for(splunk_js_sdk);
    try {
        const response = await promisify(service.get.bind(service))("/services/input_conf_generator/test", { output_mode: "json" });
        return { ok: true, message: response.data.message };
    } catch (error) {
        return { ok: false, message: (error && error.data && error.data.message) || `HTTP ${(error && error.status) || "error"}` };
    }
}

// Saves the settings. An empty ds_token keeps the token that is already saved.
export async function perform(splunk_js_sdk, setup_options) {
    const service = service_for(splunk_js_sdk);
    const { ds_host, ds_mgmt_port, ds_token, serverclass_reload_cron } = setup_options;

    await Config.create_custom_configuration_file(service, ds_host.trim(), ds_mgmt_port.trim());
    await Config.create_inputs_conf(service, serverclass_reload_cron.trim() || "*/30 * * * *");

    if (ds_token) {
        const storagePasswords = service.storagePasswords();
        try {
            // Remove the previous token so create() below does not fail with "already exists".
            await promisify(storagePasswords.del)("ds_auth_token:nobody:", {});
        } catch (error) {
            console.warn('No previous token to delete:', error);
        }
        await promisify(storagePasswords.create)({ name: "nobody", realm: "ds_auth_token", password: ds_token });
    }

    await Config.complete_setup(service);
    await Config.reload_splunk_app(service, app_name);
}

export function go_to_app() {
    Config.redirect_to_splunk_app_homepage(app_name);
}
