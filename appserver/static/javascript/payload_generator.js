"use strict";

var app_name = "./input_conf_generator_sh";

require.config({
    paths: {
        myApp: "../app/" + app_name + "/javascript/views/generate_payload",
        react: "../app/" + app_name + "/javascript/vendor/react.production.min",
        ReactDOM: "../app/" + app_name + "/javascript/vendor/react-dom.production.min",
    },
    scriptType: "module",
});

require([
    "react", 
    "ReactDOM",
    "myApp",
], function(react, ReactDOM, myApp) {
    // Create a container div for the form and payload display
    const container = document.getElementById('main_container');
    if (!container) {
        console.error('Main container not found');
        return;
    }

    // Create a div for payload display if it doesn't exist
    if (!document.getElementById('payload_display')) {
        const payloadDiv = document.createElement('div');
        payloadDiv.id = 'payload_display';
        container.appendChild(payloadDiv);
    }

    if (!document.getElementById('ds_conn_test')) {
        const ds_conn_test_Div = document.createElement('div');
        ds_conn_test_Div.id = 'ds_conn_test';
        container.appendChild(ds_conn_test_Div);
        
    }

    ReactDOM.render(myApp, container);
});
