angular.module('mappr')
.directive('opsGroupBy', ["$timeout", "$rootScope", "dataGraph", "dataService", "CommonOpsService",
function($timeout, $rootScope, dataGraph, dataService, CommonOpsService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: {
            opVm: "="
        },
        templateUrl: '#{server_prefix}#{view_path}/components/project/dataIngestion/common_ops/commonops_groupby.html',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/


    /*************************************
    ******** Controller Function *********
    **************************************/

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.addGroupRow = addGroupRow;
        scope.removeGroupRow = removeGroupRow;
        scope.updateAttrId = updateAttrId;

        scope.addSummaryRow = addSummaryRow;
        scope.removeSummaryRow = removeSummaryRow;
        scope.updateSummaryAttrId = updateSummaryAttrId;

        scope.attrList = [];
        scope.allAttrList = [];
        scope.summaryAttrList = [];
        scope.opInst = null;

        var defAttrList = [];
        var sourceFilterFn = _.noop;

        init();


        function init() {
            console.log("[opsGroupBy] rendering group for Vm: ", scope.opVm);
            var opInst = scope.opInst = scope.opVm.opInst;
            // load up selectable attrs
            defAttrList = loadAttrListing();
            scope.allAttrList = _.clone(defAttrList);
            sourceFilterFn = CommonOpsService.nodeFilterFn(scope.opVm.groupAttrDesc);

            scope.attrList = _.filter(defAttrList, sourceFilterFn);
            scope.summaryAttrList = _.filter(defAttrList, CommonOpsService.summaryAttrFilterFn(scope.opVm.sourceAttrDesc));

            // init instance object
            opInst.isGroupingEnabled = scope.opVm.isGroupingEnabled;
            opInst.groupRows = [];
            addGroupRow(opInst, 0);

            // init summary objects
            opInst.summaryRows = [];
            addSummaryRow(opInst, 0);

            console.log("[opsGroupBy] rendering group Inst: ", opInst);
        }

        function loadAttrListing() {
            var mergedData = dataGraph.getRawDataUnsafe();
            var nodeAttrs = null;
            // whether to use dataset only or dataset+network attrs
            if (mergedData) {
                nodeAttrs = mergedData.nodeAttrs;
            } else {
                var dataset = dataService.currDataSetUnsafe();
                nodeAttrs = dataset.attrDescriptors;
            }
            return nodeAttrs;
        }

        // add a new group row and initialize it with the default attribute if present
        function addGroupRow(opInst) {
            var defAttrId = scope.opVm.groupAttrDesc.defAttrId;
            var attr = _.find(defAttrList, "id", defAttrId);
            if(!attr) {
                attr = _.head(defAttrList);
            }
            var row = {
                groupAttr : attr,
                groupAttrId : attr.id
            };
            opInst.groupRows.push(row);
        }

        function removeGroupRow(opInst, idx) {
            if(opInst.groupRows.length === 1) {
                opInst.isGroupingEnabled = false;
            }
            opInst.groupRows.splice(idx, 1);
        }

        function updateAttrId(groupRow) {
            groupRow.groupAttrId = groupRow.groupAttr.id;
        }
        // add a new group row and initialize it with the default attribute if present
        function addSummaryRow(opInst) {
            var attr = _.head(defAttrList);
            var row = {
                summaryAttr : attr,
                summaryAttrId : attr.id,
                generations : CommonOpsService.loadGenerations(attr)
            };
            opInst.summaryRows.push(row);
            $rootScope.$broadcast("commonops:summary:updated", {
                summaryRows : opInst.summaryRows
            });
        }

        function removeSummaryRow(opInst, idx) {
            if(opInst.summaryRows.length === 1) {
                opInst.isSummaryEnabled = false;
            }
            opInst.summaryRows.splice(idx, 1);
        }

        function updateSummaryAttrId(summaryRow) {
            summaryRow.summaryAttrId = summaryRow.summaryAttr.id;
            summaryRow.generations = CommonOpsService.loadGenerations(summaryRow.summaryAttr);
            $rootScope.$broadcast("commonops:summary:updated", {
                summaryRows : scope.opInst.summaryRows
            });
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);