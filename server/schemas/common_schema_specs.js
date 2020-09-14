'use strict';
var
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var attrSpec = {
    id               : String,
    title            : String,
    attrType         : String,
    renderType       : String,
    generatorType    : String,
    generatorOptions : {},
    visible          : {type: Boolean, default: true },
    metadata         : {},
    isStarred        : {type: Boolean, default: false },
    searchable       : {type: Boolean, default: true },
    visibleInProfile : {type: Boolean, default: true }
};

module.exports = {
    attrSpec
};