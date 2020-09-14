"use strict";

var _       = require("lodash"),
    math = require("mathjs");

// var shared_code = require("./shared_code");
// var genDestAttrs = shared_code.genDestAttrs;
// var genParam = shared_code.genParam;
// var createOrUpdateAttr = shared_code.createOrUpdateAttr;

// var logPrefix = "[summary_generators]";

function getAttrType_Numeric (genName) {
    return "float";
}
function getAttrType_Tag (genName) {
    return "liststring";
}

function getAttrType_Cat (genName) {
    return "liststring";
}



function genNumericInfo (attrId, entities) {
    var candidate_vals = _.filter(_.map(entities, "attr." + attrId), i => _.isNumber(i));
    var bounds = getNumericBounds(candidate_vals);
    return bounds;
}

function genTagInfo (attrId, entities) {
    /// unique tags, most freq, least freq
    var tagFreq = countTagFreq(attrId, entities);
    return _getCat_TagInfoHelper(tagFreq);
}

function genCatInfo (attrId, entities) {
    /// unique tags, most freq, least freq
    var catFreq = countCatFreq(attrId, entities);
    return _getCat_TagInfoHelper(catFreq);
}

// given a frequency map of value -> freq, find min, max, and uniques
function _getCat_TagInfoHelper (freqMap) {
    //say freqMap = {a:1, c:3, d:3, e:4}
    var grouped = _.transform(freqMap, function(result, value, key) {
        (result[value] || (result[value] = [])).push(key);
        return result;
    }, {});
    //grouped = [1:['a'], 3:['c','d'], 4:['e']]
    var sortedGroupKeys = _.keys(grouped).sort();
    //sortedGroupKeys = ["1", "3", "4"]

    //max min are also liststrings
    var maxFreq = sortedGroupKeys.length > 0 ? grouped[_.last(sortedGroupKeys)] : null;
    var minFreq = sortedGroupKeys.length > 0 ? grouped[_.first(sortedGroupKeys)] : null;
    return {
        unique : Object.keys(freqMap).sort((a,b) => freqMap[b] - freqMap[a]), //desc
        maxFreq : maxFreq,
        minFreq : minFreq
    };
}


function getNumericBounds (values) {
    if(values.length>0){
        return {
            max: Math.round(math.max(values)*100)/100,
            quantile_75: Math.round(math.quantileSeq(values,0.75, false)*100)/100,
            median: Math.round(math.median(values)*100)/100,
            quantile_25: Math.round(math.quantileSeq(values,0.25, false)*100)/100,
            min: Math.round(math.min(values)*100)/100,
            mean: Math.round(math.mean(values)*100)/100
        };
    } else {
        return {
            max: 0,
            quantile_75: 0,
            median: 0,
            quantile_25: 0,
            min: 0,
            mean: 0
        };
    }
}


// returns a Map of tagVal -> occurance
function countTagFreq (attrId, entities) {
    var tagFrequency = {}, i, j, val;

    for(i = 0; i < entities.length; i++) {
        var ent = entities[i], vals = ent.attr[attrId];
        if(_.isArray(vals)) {    // make sure ent has a value for this attribute
            for(j = 0; j < vals.length; j++) {
                val = vals[j];
                tagFrequency[val] = tagFrequency[val] ? tagFrequency[val] + 1 : 1;
            }
        }
    }
    return tagFrequency;
}
// returns a Map of tagVal -> occurance
function countCatFreq (attrId, entities) {
    var catFreq = {}, i, val;

    for(i = 0; i < entities.length; i++) {
        var ent = entities[i];
        val = ent.attr[attrId];
        if(_.isString(val)) {
            catFreq[val] = catFreq[val] ? catFreq[val] + 1 : 1;
        }
    }
    return catFreq;
}

module.exports = {
    getAttrType_Numeric,
    getAttrType_Cat,
    getAttrType_Tag,

    genNumericInfo,
    genTagInfo,
    genCatInfo
};
