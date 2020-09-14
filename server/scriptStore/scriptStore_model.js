"use strict";

var _ = require("lodash"),
    util = require("util"),
    Promise = require("bluebird");

var ScriptStoreDB = require("../schemas/scriptStore_schema");

var logPrefix = "[scriptStore_model]";

// can return null values.
function listById(id, callback) {
    return ScriptStoreDB.findById(id, function(err, doc) {
        if (err) {
            return callback(err);
        }
        callback(null, doc);
    });
}

// return scripts in decending order
function listByOrg(orgId, callback) {
    return ScriptStoreDB.find({
        orgRef: orgId
    }).sort("-lastUsedAt").exec(callback);
}

function storeScript(script, callback) {
    var scriptM = new ScriptStoreDB(script);
    return scriptM.save().asCallback(callback);
}

var api = {
    listById,
    listByOrg,
    storeScript
};
module.exports = Promise.promisifyAll(api);