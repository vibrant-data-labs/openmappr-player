'use strict';
var	_           = require('lodash');
//
// API to work with Dataset
//
// returns modified attrDesc array
function filterAttrs (entities, attrDesc, attrIds_toPreserve) {
    var partitionedAttrs = null;
    if(attrDesc.length === attrIds_toPreserve.length)
        return attrDesc;
    partitionedAttrs = _.partition(attrDesc, function (attr) {
        return _.contains(attrIds_toPreserve, attr.id);
    });
    var attrIds_toRemove = _.pluck(partitionedAttrs[1], 'id');
    _.each(entities, function (entity) {
        _.each(attrIds_toRemove, function (attrId) {
            delete entity.attr[attrId];
        });
    });
    return partitionedAttrs[0];
}

function equateAttrIdAndTitle(attrDescriptors, entities) {
    var logPrefix = "[equateAttrIdAndTitle: ] ";
    _.each(attrDescriptors, function(attrDescr) {
        if(attrDescr.id != attrDescr.title) {
            console.log(logPrefix + 'Assigning attr title to id');
            console.log(logPrefix + 'Id: ' + attrDescr.id);
            console.log(logPrefix + 'Title: ' + attrDescr.title);
            _.each(entities, function(entity) {
                if(entity.attr[attrDescr.id] != null) {
                    entity.attr[attrDescr.title] = entity.attr[attrDescr.id];
                    delete entity.attr[attrDescr.id];
                }
            });
            attrDescr.id = attrDescr.title;
        }
    });
    return attrDescriptors;
}

module.exports = {
    filterAttrs : filterAttrs,
    equateAttrIdAndTitle: equateAttrIdAndTitle
};
