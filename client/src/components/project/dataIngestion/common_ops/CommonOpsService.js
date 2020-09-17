angular.module("mappr")
.service("CommonOpsService", ["$q", "$http", "projFactory",
function($q, $http, projFactory) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.getAllOps = getAllOps;
    this.runOp = runOp;
    this.injectComputeAttrs = injectComputeAttrs;
    this.loadGenerations = loadGenerations;
    this.nodeFilterFn = nodeFilterFn;
    this.summaryAttrFilterFn = summaryAttrFilterFn;



    /*************************************
    ********* Local Data *****************
    **************************************/
    // Group prefix
    var groupPrefix = "group_";

    /*************************************
    ********* Core Functions *************
    **************************************/   

    function buildOrgProjUrl(suffix) {
        var proj = projFactory.currProjectUnsafe(),
            orgId = proj.org.ref,
            projId = proj._id;
        var baseUrl = "/api/orgs/" + orgId + "/projects/" + projId + "/common_ops";
        return suffix ? baseUrl + "/" + suffix : baseUrl;
    }

    function getAllOps() {
        var url = buildOrgProjUrl();
        return $http.get(url)
            .then(function(respData) {
                return respData.data;
            });
    }

    function runOp(opInst, datasetId, networkId) {
        return $http.post(buildOrgProjUrl(opInst.id), {
            datasetId: datasetId,
            networkId: networkId,
            opInst: opInst
        }).then(function _postRunOp(respData) {
            console.log("Op Run Results: ", respData.data);
            return {
                dataset : respData.data[0],
                networks : respData.data[1],
                reloadAllNws : respData.data[2]
            };
        });
    }

    // find all attrs whose summary is compatible with the source of the algorithms
    function summaryAttrFilterFn(filterDesc) {
        var _filterFn = function (attrDesc) {
            var isValid = true;
            var computedAttrType = "liststring";
            if(attrDesc.isNumeric) {
                computedAttrType = "float";
            }
            // isNumeric check
            if (isValid && filterDesc.isNumeric != null) {
                isValid = filterDesc.isNumeric === (computedAttrType === "float");
            }
            // isTag check
            if(isValid && filterDesc.isTag != null) {
                isValid = filterDesc.isTag === (computedAttrType === "liststring");
            }
            if(isValid && filterDesc.isTimestamp != null) {
                isValid = false;
            }
            return isValid;
        };
        return _filterFn;
    }

    // generates a filter function to be used for filtering source attributes
    function nodeFilterFn (filterDesc) {
        var _filterFn = function(attrDesc) {
            var isValid = true;
            // isNumeric check
            if (isValid && filterDesc.isNumeric != null) {
                isValid = filterDesc.isNumeric === attrDesc.isNumeric;
            }
            // isTag check
            if(isValid && filterDesc.isTag != null) {
                isValid = filterDesc.isTag === attrDesc.isTag;
            }
            if(isValid && filterDesc.isTimestamp != null) {
                isValid = filterDesc.isTimestamp === (attrDesc.attrType === "timestamp");
            }
            return isValid;
        };
        return _filterFn;
    }

    /**
     * Updates node attrs with the computed asummary attrs for the given listing
     */
    function injectComputeAttrs (summaryRows, nodeAttrs) {
        var cleanedAttrs = _.reject(nodeAttrs, "isComputed");
        return _.reduce(summaryRows, function(acc, summaryRow) {
            var newAttrs = _injectComputeAttr(summaryRow, acc);
            _.each(newAttrs, function(attr) {
                acc.push(attr);
            });
            return acc;
        }, cleanedAttrs);
    }
    /**
     * generates a list of computed attrs for the given summary. Doesn't modify nodeAttrs
     */
    function _injectComputeAttr (summaryRow, nodeAttrs) {
        var summaryAttr = summaryRow.summaryAttr;

        var genToBuild = _.map(_.filter(summaryRow.generations, "isChecked"), "genName");
        var genAttrType = _.constant("liststring");
        if(summaryAttr.isNumeric) {
            genAttrType = _.constant("float");
        }
        // generate computed Attrs for selected options
        var newAttrs = _.map(genToBuild, function(genName) {
            var attrId = getUniqueAttr(genComputedAttrId(summaryRow.summaryAttrId, genName));
            var computedAttr = _.clone(summaryAttr);
            computedAttr.id = attrId;
            computedAttr.attrType = genAttrType(genName);
            computedAttr.genName = genName;
            return computedAttr;
        });

        _.each(newAttrs, function(computedAttr) {
            computedAttr.isComputed = true;
            computedAttr.summaryAttrId = summaryAttr.id;
            computedAttr.title = genComputedAttrId(summaryAttr.title, computedAttr.genName);
        });
        return newAttrs;

        // ensure computed attr Id is always unique for the given node attrs
        function getUniqueAttr (attrId) {
            if(!_.find(nodeAttrs, "id", attrId)) {
                return attrId;
            } else return genIdx(1);

            function genIdx (idx) {
                var newId = attrId + "_" + idx;
                if(_.find(nodeAttrs, "id", newId)) {
                    return genIdx(idx + 1);
                } else return newId;
            }
        }
    }

    // encodes schema of computed attr name
    function genComputedAttrId (attrId, genName) {
        var computedAttrId = groupPrefix + "_" + attrId + "_" + genName;
        return computedAttrId;
    }
    // load generation options
    function loadGenerations (attr) {
        if(attr.isNumeric) {
            return _.map(["max", "quantile_75", "median", "quantile_25", "min", "mean"], function(genName) {
                return {
                    genName : genName,
                    isChecked : genName.substr(0, "quantile".length) !== "quantile"
                };
            });
        } else {
            return _.map(["unique", "maxFreq", "minFreq"], function(genName) {
                return {
                    genName : genName,
                    isChecked : true
                };
            });
        }
    }

}
]);