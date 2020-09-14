'use strict';
var _            = require('lodash'),
    unorm        = require('unorm'),
    moment       = require('moment');


// var allTypes = ['color','liststring','string','integer','float','boolean', 'timestamp', 'picture','profile','video','audio_stream','media_link','video_stream','html','url','twitter', 'instagram', 'json'];

// var coreTypes = ['liststring', 'float', 'integer', 'boolean', 'string', 'color', 'timestamp'];
//constants. NOTE: Also change dataUtils.js
var stringTypes = ['string', 'picture','profile','video','audio_stream','media_link','video_stream','html','url','twitter', 'instagram', 'json'];
// var booleanValues = ["true", "y", "yes", "false", "n", "no"];

var liststring_splitter = /\s*\|\s*/;

// Helpers
function valueConverter (targetType, currentType, attrId, entities) {
    var updater = null;

    if(targetType === currentType || (_isStringLike(targetType) && _isStringLike(currentType))) {
        updater = _.identity;
        return updater;
    }

    if(_isStringLike(targetType)) {
        if(currentType === 'liststring') updater = function(val) { return '' + val.join(' | '); };
        else updater = function(val) { return '' + val; };
        return updater;
    }

    if(targetType === 'liststring') {
        if(currentType === 'string') updater = _toListString;
        else if(currentType === 'timestamp') updater = function(val) { return moment.unix(val).utc().toString(); };
        else return null;
    }

    var typeInfo = genTypeInfo(attrId, entities);

    // if(targetType === 'date') {
    //     if(typeInfo.isNumericLike)
    // }

    if(targetType === 'float') {
        if(typeInfo.isNumericLike)         updater = function(val) { return Number(val); };
        else if(currentType === 'boolean') updater = function(val) { return val ? 1 : 0 ;};
        else return null;
    }

    if(targetType ===  'integer') {
        if(typeInfo.isIntegerLike)         updater = function(val) { return Number(val); };
        else if(typeInfo.isNumericLike)    updater = function(val) { return Number(val) - (Number(val) % 1); };
        else if(currentType === 'boolean') updater = function(val) { return val ? 1 : 0 ;};
        else return null;
    }
    if(targetType === 'timestamp') {
        if(typeInfo.isIntegerLike)         updater = function(val) { return moment.unix(Number(val)).unix(); };
        else if(typeInfo.isNumericLike)    updater = function(val) { return moment.unix(Number(val) - (Number(val) % 1)).unix(); };
        else {
            var res = _.all(typeInfo.numValues, function(val) {
                var d = new Date(val);
                return d.toString() !== "Invalid Date";
            });
            if(res) {
                updater = function(val) { return moment(new Date(val)).unix(); };
            } else return null;
        }
    }

    if(targetType === 'boolean') {
        if( typeInfo.numValues === 2) updater = function(val) { return typeInfo.values[0] == val; };
        else return null;
    }

    if(targetType === 'year') {
        if(typeInfo.isIntegerLike)  updater = function(val) { return Number(val); };
        else return null;
    }

    return updater;
}
function genTypeInfo(attrId, entities) {
    var isNum = true, isInt = true;

    var values = _.pluck(entities,'attr.' + attrId);
    _.each(values, function(val) {
        if(val == null) return ; //Non-existent values should not affect type change
        if(isNum && !isNaN(+val)) { // convert value to number test for NaN
            val = +val;
            if(isInt && val % 1 === 0) {// check if integer
                // hmm...good for you attr :)
            } else {
                isInt = false;
            }
        } else {
            isNum = false;
            isInt = false;
            return false;
        }
    });

    return {
        isNumericLike : isNum,
        isIntegerLike : isInt,
        numValues : values.length
    };
}
// function _getColor (val) {
//     var col =  color(val) || color("rgb(" + val + ")") || color("rgba(" + val + ')');
//     return col ? col : undefined;
// }

function _toListString(val) {
    var updated_val = null;
    if(_.isArray(val)) updated_val = val;
    else if(_.isString(val)){
        updated_val = _.map(_.filter(val.split(liststring_splitter), function(elem) { return elem.length > 0; }), unorm.nfkc, unorm);
    } else {
        updated_val = ['' + val];
    }
    updated_val = _.uniq(updated_val);

    return updated_val;
}
function _isStringLike(valType) {
    return _.contains(stringTypes,valType);
}

module.exports = {
    valueConverter : valueConverter
};
