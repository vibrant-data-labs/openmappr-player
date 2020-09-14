"use strict";

var _       = require("lodash");

var DSModel = require("../../datasys/datasys_model");

// var logPrefix = "[shared_code]";

/**
 * Updates / creates new attr Descriptors
 * If already exists, the attrType is updated to the one given
 *
 * if destAttrtype === "copySrcType", then it copies the type of the source. works only for transform_op
 */
function genDestAttrs (opInst, destAttrType, attrDescriptors) {
    var idx = _.indexBy(attrDescriptors, "id");
    var opType = opInst.opType;
    var destAttrTypeFn = _.constant(destAttrType); // fn which determines the type of new attr

    if(destAttrType === "copySrcType") {
        if(opType === "transform_op") {
            destAttrTypeFn = _.property("attrType");
        } else {
            throw new Error("[destAttrType] copySrcType given for wrong opType. given Type: " + opType);
        }
    }

    if(opType === "general_op" && opInst.params && opInst.params.length > 0) {
        /// general op basically has a param prefixed with "destAttrId" which has to be non empty
        var destParams = _.filter(opInst.params, param => param.id.startsWith("destAttrId") && param.value.length > 0);
        if(destParams.length > 0) {
            // attrs found, create or update
            _.each(destParams, function (param) {
                var destAttrId = param.value;
                var attr = idx[destAttrId];
                if(!attr) {
                    attrDescriptors.push(new DSModel.AttrDescriptor(destAttrId, destAttrId, destAttrTypeFn()));
                } else {
                    if(attr.isComputed) {
                        attr.isComputed = false;
                    }
                    attr.attrType = destAttrTypeFn();
                }
            });
        }

    } else if(opType === "reduce_op") {
        var destAttrId = opInst.destAttrId;
        var attr = idx[destAttrId];
        if(!attr) {
            attrDescriptors.push(new DSModel.AttrDescriptor(destAttrId, destAttrId, destAttrTypeFn()));
        } else {
            if(attr.isComputed) {
                attr.isComputed = false;
            }
            attr.attrType = destAttrTypeFn();
        }
    } else if(opType === "transform_op") {
        // generate for each opRows.
        _.each(opInst.opRows, function(op) {
            var destAttrId = op.destAttrId,
                srcAttrId = op.srcAttrId;
            var attr = idx[destAttrId], srcAttr = idx[srcAttrId];
            if(!attr) {
                attrDescriptors.push(new DSModel.AttrDescriptor(destAttrId, destAttrId, destAttrTypeFn(srcAttr)));
            } else {
                if(attr.isComputed) {
                    attr.isComputed = false;
                }
                attr.attrType = destAttrTypeFn(srcAttr);
            }
        });
    }
    console.log("[genDestAttrs] Generated AttrIds", _.difference(_.map(attrDescriptors, "id"), _.keys(idx)));
    return attrDescriptors;
}

function createOrUpdateAttr (attrId, attrType, attrDescriptors) {
    var attr = _.find(attrDescriptors,"id", attrId);
    if(!attr) {
        attr = new DSModel.AttrDescriptor(attrId, attrId, attrType);
        attrDescriptors.push(attr);
    } else {
        attr.attrType = attrType;
    }
    return attr;
}

/**
 * Param Class
 * Params belong to 2 generic classes simple and composite.
 * simple class -> string / int / floats
 * Option ->
 * Array ->
 * Array[Option] -> array of simple elements
 */
function genParam (id, tooltip, defaultValue, paramType, paramObj) {
    paramType = paramType || "simple";
    return _.extend({
        id,
        tooltip,
        defaultValue,
        paramType
    }, paramObj || {});
}
module.exports = {
    genDestAttrs,
    genParam,
    createOrUpdateAttr
};
