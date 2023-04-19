/*jshint unused:false, loopfunc:true */
/**
 * This service builds intelligence about an attribute in the dataset
 */
angular.module('common')
.service('AttrSanitizeService', [function () {
    "use strict";

    /*************************************
    ****** API ******************
    **************************************/
    this.sanitizeAttr = sanitizeAttr;


    /*************************************
    ****** Core Functions ******************
    **************************************/

    // This function should actually go to server
    function sanitizeAttr (attr, entities) {
        var attribId = attr.id;
        var isNum = true, isInt = true; // hopefully
        attr.existsOnAll = attr.isNumeric = attr.isInteger = attr.isTag = false;

        // For existing projects, set searchable to false for numeric attrs
        if (['integer', 'float'].indexOf(attr.attrType) !== -1) { attr.searchable = false; }

        // Set sort options for dirTagList & dirTagCloud & dirCategoryList
        // Available in both workbench & player
        // Not to be stored in attr descriptor
        attr.sortOps = {};
        if(attr.renderType === 'tags' || attr.renderType === 'tag-cloud' || attr.renderType === 'tag-cloud_2' || attr.renderType === 'tag-cloud_3' || attr.renderType === 'wide-tag-cloud') {
            attr.sortOps.sortType = 'statistical'; // alphabetical/frequency/statistical
            attr.sortOps.sortOrder = 'desc'; // asc/desc
        } else if(attr.renderType === 'categorylist') {
            attr.sortOps.sortType = 'frequency'; // alphabetical/frequency
            attr.sortOps.sortOrder = 'desc'; // asc/desc
        }

        if(attr.attrType !== 'liststring') {
            var values = _.reduce(entities, function(acc, item) {
                // set empty strings to undefined
                if( typeof item.attr[attribId] === 'string' && item.attr[attribId].length === 0 ) {
                    item.attr[attribId] = undefined;
                }
                if(item.attr[attribId] != null) {
                    var val = item.attr[attribId];
                    // check if actually numeric or even, integral
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
                    }
                    acc.push(val);
                }
                return acc;
            }, []);

            if(values.length === 0)
                console.warn('Value for Attribute: %s does not exist in any node', attribId);
            if(values.length !== entities.length)
                console.warn('Length of Values for Attribute %s does not equal number of entities.' +
                    'Some(%i) entities do not have this value defined for them',attribId, entities.length - values.length);

            attr.existsOnAll = values.length == entities.length;
            attr.isNumericLike = isNum;
            attr.isIntegerLike = isInt;
            attr.isNumeric = attr.attrType === 'integer' || attr.attrType === 'float' || attr.attrType === 'timestamp' || attr.attrType === 'year';
            attr.isInteger = attr.attrType === 'integer' || attr.attrType === 'timestamp';

            if(attr.isNumeric) {
                attr.bounds = getNumericBounds(values);
                attr.attrSampleVals = "max: " + attr.bounds.max + ", min: " + attr.bounds.min;
            } else {
                attr.attrSampleVals = _.take(values, 3).join(", ");
            }
        } else {
            var numFound = 0;
            attr.isTag = true;
            _.each(entities, function(ent) {
                var attrArr = ent.attr[attr.id];
                if(_.isArray(attrArr) && attrArr.length > 0) {
                    numFound++;
                    if( _.isArray(attrArr[0]) ) {   // get tags from weighted tags
                        ent.attr[attr.id] = attrArr = _.map(attrArr, _.first);
                    }
                    attrArr.sort();
                }
            });
            var tagFrequency = {};        // global frequency of each tag

            for(var i = 0; i < entities.length; i++) {
                var node = entities[i];
                if(node.attr[attr.id] != null) {    // make sure node has a value for this attribute
                    var vals = node.attr[attr.id];
                    for(var j = 0; j < vals.length; j++) {
                        var val = vals[j];
                        tagFrequency[val] = tagFrequency[val] ? tagFrequency[val]+1 : 1;
                    }
                }
            }
            var sortedKeys = _.sortBy(_.keys(tagFrequency), function(a) {
                return tagFrequency[a];
            });
            attr.attrSampleVals = _.take(sortedKeys, 3).join(", ");

            if(numFound === 0)
                console.warn('Value for Attribute: %s does not exist in any node', attribId);
            if(numFound !== entities.length)
                console.warn('Length of Values for Attribute %s does not equal number of entities.' +
                    'Some(%i) entities do not have this value defined for them',attribId, entities.length - numFound);
            attr.existsOnAll = numFound == entities.length;
        }
        return attr;
    }


    /*************************************
    ********* Local Functions ************
    **************************************/
    function getNumericBounds (values) {
        return {
            max: Math.round(d3.max(values)*100)/100,
            //quantile_90: Math.round(d3.quantile(values,0.90)*100)/100,
            quantile_75: Math.round(d3.quantile(values,0.75)*100)/100,
            quantile_50: Math.round(d3.median(values)*100)/100,
            quantile_25: Math.round(d3.quantile(values,0.25)*100)/100,
            //quantile_10: Math.round(d3.quantile(values,0.10)*100)/100,
            min: Math.round(d3.min(values)*100)/100
            // mean: Math.round(d3.mean(values)*100)/100
        };
    }
}
]);
