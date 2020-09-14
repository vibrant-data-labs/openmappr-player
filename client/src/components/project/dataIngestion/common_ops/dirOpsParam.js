angular.module('mappr')
.directive('opsParam', ['$timeout', "dataGraph", "dataService", "CommonOpsService",
function($timeout, dataGraph, dataService, CommonOpsService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: {
            opInst: "=",
            opParam: "=",
            tooltipAsDescr: "=?"
        },
        templateUrl: '#{server_prefix}#{view_path}/components/project/dataIngestion/common_ops/commonops_params.html',
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
        scope.addRow = addRow;
        scope.removeRow = removeRow;
        scope.updateAttrId = updateAttrId;

        // fully filtered listing. may also contain computed attrs
        scope.attrList = [];

        // the default attr list. is always pristine :)
        var defAttrList = [];

        var sourceFilterFn = _.noop;

        scope.$on("commonops:summary:updated", function(event, data) {
            console.log("Summary Data updated, generating new Attrs", data.summaryRows);
            scope.attrList = CommonOpsService.injectComputeAttrs(data.summaryRows, scope.attrList);
            scope.attrList = _.filter(scope.attrList, sourceFilterFn);
        });

        init();

        function init() {
            console.log("[dirOpsParam] rendering ops: ", scope.opParam);
            scope.opParam.value = _.cloneDeep(scope.opParam.defaultValue);
            defAttrList = loadAttrListing();
            sourceFilterFn = CommonOpsService.nodeFilterFn(scope.opParam);

            if (scope.opParam.paramType === "attr-select") {
                scope.attrList = _.filteRr(defAttrList, sourceFilterFn);
                scope.opParam.value = _.head(scope.attrList).id;
            } else {
                scope.attrList = [];
            }
        }

        // load an attr compatible attr listing
        function loadAttrListing() {
            var mergedData = dataGraph.getRawDataUnsafe();
            var nodeAttrs = null;

            if (mergedData) {
                nodeAttrs = mergedData.nodeAttrs;
            } else {
                var dataset = dataService.currDataSetUnsafe();
                nodeAttrs = dataset.attrDescriptors;
            }
            return nodeAttrs;
        }

        function addRow(param, idx) {
            var defValArr = scope.opParam.defaultValue,
                val = defValArr[0];
            if (idx < defValArr.length) {
                val = defValArr[idx];
            }
            scope.opParam.value.push(_.clone(val));
        }

        function removeRow(param, idx) {
            scope.opParam.value.splice(idx, 1);
        }

        function updateAttrId() {
            scope.opParam.value = scope.opParam.srcAttr.id;
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);