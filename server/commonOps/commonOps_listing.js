"use strict";

var _       = require("lodash");

// var logPrefix = "[commonOps_listing]";


// There are 3 types of op
// general_op -> topmost, most generic algos
// reduce_op  -> which takes many atributes and build a single one
// transform_op-> single attr ops

var shared_code = require("./ops_library/shared_code");
var generalOps = require("./ops_library/general_ops").listing;
var reduceOps = require("./ops_library/reduce_ops").listing;
var transformOps = require("./ops_library/transform_ops").listing;

var allOps = generalOps.concat(reduceOps, transformOps);

var api = {
    allOps : function() { return _.cloneDeep(allOps); },
    forTesting : _.extend(shared_code,
        require("./ops_library/general_ops").forTesting,
        require("./ops_library/reduce_ops").forTesting,
        require("./ops_library/transform_ops").forTesting
        )
};
module.exports = api;
