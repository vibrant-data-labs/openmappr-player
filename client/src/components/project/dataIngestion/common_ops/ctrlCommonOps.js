angular.module("mappr")
.controller("CommonOpsCtrl", ["$scope", "$rootScope", "$timeout", "$q", "CommonOpsService", "SelectionSetService", "AttrModifierService", "AttrInfoService", "AttrGeneratorService", "dataGraph", "dataService", "networkService", "projFactory", "BROADCAST_MESSAGES", "uiService",
function($scope, $rootScope, $timeout, $q, CommonOpsService, SelectionSetService, AttrModifierService, AttrInfoService, AttrGeneratorService, dataGraph, dataService, networkService, projFactory, BROADCAST_MESSAGES, uiService) {
    "use strict";

    /*************************************
    ********* CLASSES ********************
    **************************************/
    function OpVm(opDesc) {
        _.extend(this, _.cloneDeep(opDesc));
        this.opInst = {};
        this.sourceFilterFn = CommonOpsService.nodeFilterFn(this.sourceAttrDesc);
        this.warning = null;
    }
    OpVm.prototype.init = function() {
        if($scope.nodeAttrList.length === 0) {
            this.warning = "No Attributes compatible with this algo. choose a different one";
            return;
        }
        if (this.opType === "general_op") {
            generalOpInst(this, this);
        } else if (this.opType === "reduce_op") {
            reduceOpInst(this, this);
        } else {
            transformOpInst(this, this);
        }
        this.opInst.opType = this.opType;
        this.opInst.id = this.id;
    };



    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[CommonOpCtrl: ] ",
        datasetMode = false;
    // the default attr list. is always pristine :)
    var defAttrList = [];



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.mapProcessor.childProcess = runOpOnServer;
    console.log('runOpOnServer: ', runOpOnServer);
    $scope.nodeAttrList = []; // fully filtered listing. may also contain computed attrs
    $scope.opVms = [];
    $scope.selectedOpVm = null;

    /**
    * Scope methods
    */
    $scope.changeOpVm = changeOpVm;
    $scope.updateSrcAttr = updateSrcAttr;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on("commonops:summary:updated", function(event, data) {
        console.log("Summary Data updated, generating new Attrs", data.summaryRows);
        $scope.nodeAttrList = CommonOpsService.injectComputeAttrs(data.summaryRows, $scope.nodeAttrList);
        $scope.nodeAttrList = _.filter($scope.nodeAttrList, $scope.selectedOpVm.sourceFilterFn);
    });



    /*************************************
    ********* Initialise *****************
    **************************************/
    // Enable modal's main button
    $scope.mapProcessor.enableMainBtn();
    init();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        var mergedData = dataGraph.getRawDataUnsafe();
        if (mergedData) {
            $scope.nodeAttrList = mergedData.nodeAttrs;
        } else {
            var dataset = dataService.currDataSetUnsafe();
            datasetMode = true;
            if(dataset) {
                $scope.nodeAttrList = dataset.attrDescriptors;
            } else {
                //in recipe
                //node attr list is defined in parent

            }
        }
        defAttrList = _.clone($scope.nodeAttrList);

        CommonOpsService.getAllOps()
            .then(function(allOps) {
                $scope.opVms = allOps.map(buildOpVm);
                changeOpVm(_.head($scope.opVms));
            });
    }

    function buildOpVm(opDesc) {
        return new OpVm(opDesc);
    }

    function generalOpInst(opvm, opDesc) {
        var opInst = opvm.opInst;
        opInst.srcAttr = _.head($scope.nodeAttrList);
        updateSrcAttr(opvm, opInst);
        var params = _.map(opDesc.params, function(paramDesc) {
            return _.extend({
                value: paramDesc.defaultValue
            }, paramDesc);
        });
        opInst.params = params;
    }

    function reduceOpInst(opvm, opDesc) {
        var opInst = opvm.opInst;
        opInst.opRows = [];
        opInst.destAttrId = opDesc.destAttrDesc.name;

        var params = _.map(opDesc.params, function(paramDesc) {
            return _.extend({
                value: paramDesc.defaultValue
            }, paramDesc);
        });
        opInst.params = params;

        opInst.addRow = function() {
            console.log("Adding another row to the opInst", opInst);
            var srcAttr = _.head($scope.nodeAttrList);

            var row = {
                srcAttr: srcAttr,
                srcAttrId: srcAttr.id
            };
            updateSrcAttr(opvm, row);
            opInst.opRows.push(row);
        };
        opInst.removeRow = function (idx) {
            opInst.opRows.splice(idx,1);
        };

        opInst.addRow();
    }

    // transformOpInst also specifies the classes to use
    function transformOpInst(opvm, opDesc) {
        var opInst = opvm.opInst;
        opInst.opRows = [];
        // the sum should be 10, there are 2 cols for two buttons
        opInst.attr_class_src = "col-xs-5";
        opInst.attr_class_dest = "col-xs-5";
        opInst.attr_class_param = "col-xs-12"; // rendered in next line
        opInst.compactInput = opDesc.compactInput;
        opInst.addRow = function() {
            console.log("Adding another row to the opInst", opInst);
            var srcAttr = _.head($scope.nodeAttrList);
            var destAttrId = srcAttr.id + opDesc.destAttrDesc.suffix;

            var params = _.map(opDesc.params, function(paramDesc) {
                return _.extend({
                    value: paramDesc.defaultValue
                }, paramDesc);
            });

            var row = {
                srcAttr: srcAttr,
                destAttrId: destAttrId,
                params: params
            };
            updateSrcAttr(opvm, row);
            opInst.opRows.push(row);
        };
        opInst.removeRow = function (idx) {
            opInst.opRows.splice(idx,1);
        };
        // if compactInput is true, the show param in line
        if(opDesc.compactInput) {
            if(opDesc.params.length === 0) {
                opInst.attr_class_src = "col-xs-5";
                opInst.attr_class_dest = "col-xs-5";
                opInst.attr_class_param = "col-xs-0";
            } else {
                opInst.attr_class_src = "col-xs-4";
                opInst.attr_class_dest = "col-xs-3";
                opInst.attr_class_param = "col-xs-3";
            }
        }

        opInst.addRow();
    }

    function changeOpVm(newOpVm) {
        console.log(logPrefix + "Changed view to :", newOpVm);
        // $scope.opDataStr = JSON.stringify(newOpVm);
        $scope.selectedOpVm = newOpVm;
        $scope.nodeAttrList = _.filter(defAttrList, newOpVm.sourceFilterFn);
        newOpVm.init();
    }

    function updateSrcAttr(selectedOpVm, opObj) {
        console.log("Changing source AttrId");
        var srcAttr = opObj.srcAttr;
        opObj.srcAttrId = srcAttr.id;
        opObj.srcAttrSampleVals = srcAttr.isNumeric ? srcAttr.attrSampleVals : srcAttr.attrSampleVals + "...";
        opObj.srcAttrSampleVals = srcAttr.attrType + "; " + opObj.srcAttrSampleVals;

        // write dest attrId
        if(selectedOpVm.destAttrDesc != null && selectedOpVm.opType === "transform_op") {
            var suffix = _.get(selectedOpVm, "destAttrDesc.suffix");
            var destAttrId = srcAttr.id + suffix;
            opObj.destAttrId = destAttrId;
        }
    }

    //generate and reload dataset
    function runOpOnServer() {
        console.log(logPrefix, "Running OpVm On server " + $scope.selectedOpVm);
        console.log(logPrefix, "OpIst On server " + $scope.selectedOpVm.opInst);

        var networkId = null,
            datasetId = dataService.currDataSetUnsafe().id;
        if (!datasetMode) {
            networkId = networkService.getCurrentNetwork().id;
        }

        uiService.log("Running op on server...");

        return CommonOpsService.runOp($scope.selectedOpVm.opInst, datasetId, networkId)
            .then(function(resp) {
                var proj = projFactory.currProjectUnsafe();
                console.log("Reloading dataset and network...");
                uiService.log("Reloading dataset and networks...");
                return dataService.fetchProjectDataSet(proj.org.ref, proj._id)
                    .then(function(dataset) {
                        if(resp.reloadAllNws) {
                            console.log("Reloading all networks...");
                            return networkService.refreshAllNetworks().then(function() {
                                return [dataset, networkService.getCurrentNetwork()];
                            });
                        } else if(networkId) {
                            return networkService.fetchProjectNetwork(networkId).then(function(network) {
                                return [dataset, network];
                            });
                        } else return $q.resolve([dataset]);
                    });
            })
            .then(function(vals) {
                var network = vals[1];
                if (network) {
                    uiService.log("Re rendering graph...");
                    $rootScope.$broadcast(BROADCAST_MESSAGES.network.changed, {
                        network: network
                    });
                    return dataGraph.mergeAndLoadNetwork(network);
                } else {
                    return vals[0];
                }
            })
            .catch(function(err) {
                console.log(err.data || err.statusText || err);
                uiService.logError("Error in executing common Ops." + err.statusText);
            });
    }
}
]);
