"use strict";

import * as Config from './setup_configuration.js'

const APP_NAME = "input_conf_generator_sh";
const DEFAULT_RELOAD_INTERVAL = "*/30 * * * *";

function service_for(splunk_js_sdk) {
    return Config.create_splunk_js_sdk_service(splunk_js_sdk, {
        owner: "nobody",
        app: APP_NAME,
        sharing: "app",
    });
}

// Validates the setup form. Returns a list of error messages (empty if valid).
export function validate(options, token_already_stored) {
    const errors = [];
    if (!/^[A-Za-z0-9.\-:\[\]]+$/.test(options.ds_host || "")) {
        errors.push("DS address must be a hostname or IP address.");
    }
    const port = Number(options.ds_mgmt_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.push("DS management port must be a number between 1 and 65535.");
    }
    if (!options.ds_token && !token_already_stored) {
        errors.push("DS auth token is required.");
    }
    const interval = (options.serverclass_reload_cron || "").trim();
    if (interval && !/^\d+$/.test(interval) && interval.split(/\s+/).length !== 5) {
        errors.push("Reload schedule must be a 5-field cron expression or a number of seconds.");
    }
    return errors;
}

// Reads the current configuration so the setup page can be pre-filled.
export async function load(splunk_js_sdk) {
    const service = service_for(splunk_js_sdk);
    const settings = await Config.read_ds_settings(service);
    return {
        ds_host: settings.ds_host || "",
        ds_mgmt_port: settings.ds_mgmt_port || "8089",
        ssl_verify: String(settings.ssl_verify || "true").toLowerCase() !== "false",
        ca_cert_path: settings.ca_cert_path || "",
        serverclass_reload_cron: await Config.read_reload_interval(service),
        token_stored: await Config.has_ds_token(service),
        legacy_cleartext_token: Boolean(settings.ds_token),
    };
}

// Saves the configuration. Throws on failure so the caller can report it.
export async function perform(splunk_js_sdk, options) {
    const service = service_for(splunk_js_sdk);

    await Config.save_ds_settings(service, {
        ds_host: options.ds_host.trim(),
        ds_mgmt_port: String(options.ds_mgmt_port).trim(),
        ssl_verify: options.ssl_verify,
        ca_cert_path: options.ca_cert_path.trim(),
    });
    if (options.ds_token) {
        await Config.store_ds_token(service, options.ds_token.trim());
    }
    await Config.enable_scripted_inputs(service, (options.serverclass_reload_cron || "").trim() || DEFAULT_RELOAD_INTERVAL);
    await Config.complete_setup(service);
    await Config.reload_splunk_app(service, APP_NAME);
}

export function finish() {
    Config.redirect_to_splunk_app_homepage(APP_NAME);
}
