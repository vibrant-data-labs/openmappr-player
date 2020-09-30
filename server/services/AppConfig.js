'use strict';

var _ = require('lodash');

var _config = require("../config/common");

function initConfig(app) {
    var config = require('../config/local.js');
    _.extend(_config, config);

    return _config;
}
module.exports = {
    init: initConfig,
    get: function () { return _config; }
};
