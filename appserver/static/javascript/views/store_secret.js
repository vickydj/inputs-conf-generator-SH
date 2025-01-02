"use strict";

import * as Splunk from './splunk_helpers.js'
import * as Config from './setup_configuration.js'

export async function perform(splunk_js_sdk, setup_options) {
    var app_name = "input_conf_generator_sh";

    var application_name_space = {
        owner: "nobody",
        app: app_name,
        sharing: "app",
    };

    const service = Config.create_splunk_js_sdk_service(splunk_js_sdk,
        application_name_space,);

    let {password, ds_host, ds_mgmt_port, ds_token, serverclass_reload_cron, ...properties} = setup_options;
    password = ds_token

    var storagePasswords = service.storagePasswords();

    try {
        await storagePasswords.del("ds_auth_token:nobody");
    } catch (error) {
        console.warn('Error deleting password:', error);
    }
    try {
        await Config.create_custom_configuration_file(service, ds_host, ds_mgmt_port, ds_token, serverclass_reload_cron);

        console.log("serverclass_reload_cron: ", serverclass_reload_cron);
        await Config.create_inputs_conf(service, serverclass_reload_cron);


        // Enter code to create a new secret
        await storagePasswords.create({
            name: "nobody",
            realm: "ds_auth_token",
            password: password
        });
        alert("Cheers Admins !! Configs saved, wait for reload");

        await Config.complete_setup(service);

        
        await Config.reload_splunk_app(service, app_name);

        Config.redirect_to_splunk_app_homepage(app_name);

    } catch (error) {
        console.error('Error:', error);
        alert("SPLUNK failed to save configuration, please try again");
    }
}
