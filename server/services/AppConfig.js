'use strict';

var _            = require('lodash');

var _config = require("../config/common");

function initConfig (app) {
    var config = null;
    if(app.get('env') === 'local') {
        console.log("Local environment detected");
        config = require('../config/local.js');

    } else if(app.get('env') === 'testing') {
        console.log("Testing environment detected");
        config = require('../config/testing.js');

    } else if(app.get('env') === 'development') {
        console.log("Development environment detected");
        config = require('../config/dev.js');

    } else if(app.get('env') === 'production') {
        console.log("Production environment detected");
        config = require('../config/dev.js');

    }  else if (app.get('env') === 'docker') {
        console.log("Docker environment detected");
        config = require('../config/docker.js');
    } else {
        config = require('../config/local.js'); // fallback to local config
    }
    _.extend(_config, config);

    console.log("Loaded config:", _config);

    return _config;
}
module.exports = {
    init : initConfig,
    get : function() { return _config; }
};
