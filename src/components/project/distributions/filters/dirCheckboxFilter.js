angular.module('common')
.directive('dirCheckboxFilter', ['FilterPanelService', 'SelectorService', 'AttrInfoService', 'BROADCAST_MESSAGES',
function(FilterPanelService, SelectorService, AttrInfoService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        scope: {},
        templateUrl: '#{player_prefix_index}/components/project/distributions/filters/checkboxFilter.html',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    // var logPrefix = '[dirCheckboxFilter: ] ';

    var ITEMS_TO_SHOW = 10;
    var ITEMS_TO_SHOW_INITIALLY = 5;

    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs, renderCtrl) {
        var attrId = scope.attrId = renderCtrl.getAttrId(),
            globalAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attrId);

        var filterConfig = FilterPanelService.getFilterForId(attrId);
        scope.numShowGroups = 0;
        scope.renderLimit = 5; //Limits the no. of filters shown to the user
        scope.attrValVMs = genAttrValVM(FilterPanelService.getCurrSel(), globalAttrInfo);

        scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
            filterConfig = FilterPanelService.getFilterForId(attrId);

            // Reset filter values selection on selection reset
            _.each(scope.attrValVMs, function(attrValVM) {
                attrValVM.checked = false;
            });
            // console.log(logPrefix + 'checkbox filter obj: ', filterConfig);
        });

        scope.$on(BROADCAST_MESSAGES.fp.filter.reset, function() {
            _.each(scope.attrValVMs, function(vm) {
                vm.checked = false;
            });
        });

        /**
         * This only selects the filters and highlights the nodes
         * The filter is not applied
         */
        scope.selectFilters = function() {
            var selectedVals = _.map(_.filter(scope.attrValVMs, 'checked'), 'id');

            filterConfig.isEnabled = selectedVals.length > 0;
            filterConfig.state = {
                selectedVals: selectedVals
            };
            filterConfig.selector = filterConfig.isEnabled ? genSelector(selectedVals) : null;
        };

        scope.showMore = function() {
            scope.numShowGroups++;
            scope.renderLimit = scope.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY
        };

        scope.showLess = function() {
            scope.numShowGroups = 0;
            scope.renderLimit = ITEMS_TO_SHOW_INITIALLY;
        };

        function genSelector (selectedVals) {
            var selector = SelectorService.newSelector();
            selector.ofMultipleAttrValues(attrId, selectedVals, true);
            return selector;
        }


        function genAttrValVM (nodes, attrInfo) {
            var countIdx = nodes.length > 1 ? getAttrValsCounts(nodes, attrInfo) : attrInfo.valuesCount;
            var values = nodes.length > 1 ? getAttrVals(countIdx) : attrInfo.values.slice().reverse();

            var maxCount = _.reduce(attrInfo.values, function(acc, val) {
                return acc + attrInfo.valuesCount[val];
            }, 0);

            var valVMs =_.map(values, function(val) {
                return {
                    value: _.trunc(val,20),
                    id : val,
                    checked: filterConfig.state.selectedVals && filterConfig.state.selectedVals.indexOf(val) > -1
                        ? true
                        : false
                };
            });
            if(maxCount > 0) {
                _.each(valVMs, function(valVM) {
                    // valVM.value = valVM.value + ' (' + (countIdx[valVM.id] / maxCount * 100).toFixed(2) + '%)';
                    valVM.percent = (countIdx[valVM.id] / maxCount * 100).toFixed(2);
                });
            }
            return valVMs;

        }
        // build a list of attribute value in descending order of their frequency
        function getAttrValsCounts (nodes, attrInfo) {
            var countIdx = null;
            if(attrInfo.isTag) {
                countIdx = _.reduce(nodes, function getValCountsForTag(acc, node) {
                    if(node.attr[attrId] && node.attr[attrId].length > 0) {
                        _.each(node.attr[attrId], function(val) {
                            acc[val] = acc[val] + 1 || 1;
                        });
                    }
                    return acc;
                },{});
            } else {
                countIdx = _.reduce(nodes, function getValCounts(acc, node) {
                    var val = node.attr[attrId];
                    if(val) {
                        acc[val] = acc[val] + 1 || 1;
                    }
                    return acc;
                },{});
            }
            return countIdx;
        }

        function getAttrVals (countIdx) {
            var sortedKeys = _.sortBy(_.keys(countIdx), function(a) {
                return countIdx[a];
            });
            return sortedKeys.reverse();
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
