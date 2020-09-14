'use strict';
/**
 * ETL Model
 * simply a storehouse of scripts available to us
 */

var logPrefix = "[etl_model]";

// a map of scriptName to scriptInfo
var scripts = {
    "Transaction Processor" : require("../../etl-scripts/slice"),
    "Transaction Processor parquet" : require("../../etl-scripts/slice_parquet")
};

/**
 * check if the script with given name exists and is readable
 * @param  {String} scriptName Name of the script
 * @return {Promise}           A boolean promise which resolves to true
 */
function exists(scriptName) {
    return !!scripts[scriptName];
}

function get(scriptName) {
    if(exists(scriptName)) return scripts[scriptName];
    else throw new Error(`${logPrefix} Script with id: ${scriptName} not found`);
}

var api = {
    exists: exists,
    get : get
};

module.exports = api;
