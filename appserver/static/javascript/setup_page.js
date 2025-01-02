"use strict";

var app_name = "./input_conf_generator_sh";

require.config({
    paths: {
        myApp: "../app/" + app_name + "/javascript/views/configure_ds",
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
    ReactDOM.render(myApp, document.getElementById('main_container'));
});
