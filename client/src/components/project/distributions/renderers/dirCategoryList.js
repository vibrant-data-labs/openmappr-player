/*globals d3,$  */
angular.module('common')
    .directive('dirCategoryList', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES',
        function($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/categoryList.html',
                scope: true,
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var dirPrefix = '[dirCategoryList] ';
            var ITEMS_TO_SHOW = 100;
            var ITEMS_TO_SHOW_INITIALLY = 10;


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs, renderCtrl) {
                var attrId = scope.attrToRender.id;
                var filteringCatVals = [];
                var isCompareView = renderCtrl.isCompareView();
                var sortOrder = scope.attrToRender.sortOps.sortOrder;
                var sortType = scope.attrToRender.sortOps.sortType;

                var distrData = {
                    numShowGroups : 0,
                    numShownCats : ITEMS_TO_SHOW_INITIALLY,
                    searchQuery: ''
                };
                scope.attrId = attrId;
                scope.distrData = distrData;
                scope.catListData = [];
                scope.colorStr = FilterPanelService.getColorString();
                scope.tooltipText = '';
                scope.totalNodes = '';

                /**
         * Prepares the data which is put into scope
         * @param  {Boolean} sortData    Sort data only on initial build & initialSelection change
         */
                function draw(sortData) {

                    var cs       = FilterPanelService.getCurrentSelection(),
                        attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id),
                        catListData;


                    scope.totalNodes = cs.length;

                    scope.principalNode = null;

                    if(FilterPanelService.getInitialSelection().length === 1) {
                        scope.principalNode = cs[0];
                        cs = FilterPanelService.getNodesForSNCluster();
                    }

                    catListData  = genCatListData(cs, attrInfo, filteringCatVals, scope.colorStr, scope.principalNode, sortType, sortOrder, sortData, scope.catListData);

                    setupFilterClasses(catListData, !scope.showFilter);
                    moveSelectedItemsToTop(cs, catListData, distrData.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
                    scope.catListData = catListData;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY, catListData.data.length);
                    scope.colorStr = FilterPanelService.getColorString();
                }

                try {
                    filteringCatVals = _.clone(_.get(FilterPanelService.getFilterForId(attrId), 'state.selectedVals')) || [];
                    draw(true);
                } catch(e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                }

                // reset filters as well
                scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
                    try {
                        filteringCatVals = [];
                        draw(true, false);
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });

                // on current selection change, update highlights
                scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
                    try {
                        draw(false, true);
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });

                scope.$on(BROADCAST_MESSAGES.fp.filter.changFilterFromService, function() {
                    try {
                        var filterConfig = FilterPanelService.getFilterForId(attrId);
                        filteringCatVals = (filterConfig && filterConfig.state && filterConfig.state.selectedVals) || [];
                        draw(false, true);
                        // hoverSelectedNodes();
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });

                scope.$on(BROADCAST_MESSAGES.fp.filter.changed, function applyBgToSelectedFilters() {
                    scope.catListData.data = scope.catListData.data.map(function mapData(cat) {
                        if (cat.isChecked) {
                            cat.isSubsetted = cat.isChecked;
                        }

                        return cat;
                    });
                });
                /**
         * watch filters being enabled disabled
         */
                scope.$watch('showFilter', function onShowFilterChanged(newVal, oldVal) {
                    if(scope.catListData && oldVal != newVal) {
                        setupFilterClasses(scope.catListData, !newVal);
                    }
                });

                scope.$on(BROADCAST_MESSAGES.fp.filter.reset, function() {
                    filteringCatVals = [];
                });

                scope.$watch('attrToRender.sortOps', function(sortOps) {
                    console.log('dirCategoryList: sortOps', sortOps, scope.catListData);
                    sortType = sortOps.sortType || 'statistical';
                    sortOrder = sortOps.sortOrder || 'desc';
                    scope.catListData.data = sortCatData(scope.catListData.data, sortType, sortOrder, scope.catListData.inSelectionMode);
                }, true);

                scope.showMore = function() {
                    distrData.numShowGroups++;
                    distrData.numShownCats = Math.min(scope.catListData.data.length, distrData.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
                };
                scope.showLess = function() {
                    distrData.numShowGroups = 0;
                    distrData.numShownCats = ITEMS_TO_SHOW_INITIALLY;
                };

                // mousr stuff
                scope.onCatClick = function(catData) {
                    catData.isChecked = !catData.isChecked;
                    selectFilter();
                    if (catData.isChecked) {
                        hoverSelectedNodes(event);
                    } else {
                        unhoverSelectedNodes([catData.id], event);
                    }
                };

                scope.onCatMouseover = function(catData, $event) {
                    if(isCompareView && attrId == 'Cluster') {
                        scope.tooltipText = _.get(renderCtrl.getClusterMeta(), catData.text + '.descr');
                    }
                    else {
                        if(scope.catListData.inSelectionMode) {
                            scope.tooltipText = catData.text + "(" + catData.selFreq + " of " + scope.totalNodes + ")";
                        }
                        else {
                            scope.tooltipText = catData.text;
                        }
                    }

                    renderCtrl.hoverNodesByAttrib(attrId, catData.id, $event);
                };

                scope.outCat = function(catData, $event) {
                    // $timeout(function() {
                    scope.openTooltip = false;
                    // renderCtrl.unHoverNodes();
                    renderCtrl.unhoverNodesByAttrib(attrId, catData.id, $event);
                    // }, 100);
                };

                scope.onFilterUpdate = function() {
                    selectFilter();
                };

                function getSelectedValues() {
                    var filterConfig = FilterPanelService.getFilterForId(attrId);
                    return filterConfig.state.selectedVals;
                }

                function hoverSelectedNodes(event) {
                    var selectedValues = getSelectedValues() || [];
                    renderCtrl.highlightNodesByAttributes(attrId, selectedValues, event);
                }

                function unhoverSelectedNodes(values, event) {
                    renderCtrl.unhighlightNodesByAttributes(attrId, values, event);
                }


                /// filter stuff
                function setupFilterClasses (catListData, isfilterDisabled) {
                    var inFilteringMode = filteringCatVals.length > 0;
                    _.each(catListData.data, function(catData) {
                        catData.checkboxClass['cat-checkbox-on'] = !isfilterDisabled && inFilteringMode && catData.isChecked;
                        catData.checkboxClass['cat-checkbox-off'] = !isfilterDisabled && inFilteringMode && !catData.isChecked;
                        catData.checkboxClass['cat-checkbox-disable'] = isfilterDisabled;
                    });
                }


                /// Old behaviour: when a filter is applied, all the other filters are greyed out.
                ///                 When the current selection is refreshed, the tagList gets sorted depending upon the importance in the CS
                /// New behaviour: The filter is just selected, its applied after the user presses the Subset button
                function selectFilter () {
                    var filterConfig = FilterPanelService.getFilterForId(attrId);
                    filteringCatVals = _.map(_.filter(scope.catListData.data, 'isChecked'), 'id');

                    filterConfig.isEnabled = filteringCatVals.length > 0 && scope.showFilter;
                    filterConfig.state.selectedVals = _.clone(filteringCatVals);
                    filterConfig.selector = filterConfig.isEnabled ? genSelector(filteringCatVals) : null;
                }


                function genSelector (selectedVals) {
                    var selector = SelectorService.newSelector();
                    selector.ofMultipleAttrValues(attrId, selectedVals, true);
                    return selector;
                }
            }



            /*************************************
    ************ Local Functions *********
    **************************************/
            /**
     * catList styling in _renderers.scss
     */


            /**
     * Generate data for cat list
     * @param  {Array} currentSel        The current selection
     * @param  {Object} globalAttrInfo   The attrInfo object
     * @param  {Array} filteringCatVals  cat Values which are being used to filter the list
     * @param  {String} colorStr         The chosen color this distribution
     * @return {Object}                  An object used to render cat listing
     */
            function genCatListData (currentSel, globalAttrInfo, filteringCatVals, colorStr, principalNode, sortType, sortOrder, sortData, oldCatListData) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr.id);
                var maxFreqVal = attrInfo.values[attrInfo.values.length-1];
                var maxFreq = attrInfo.valuesCount[maxFreqVal];
                //var maxFreq = _.reduce(attrInfo.values, function(acc, val) { return acc + attrInfo.valuesCount[val]; }, 0);

                var inFilteringMode = filteringCatVals.length > 0;
                var inSelectionMode = !_.isEmpty(currentSel);
                var highlightedCats = [];

                var attrVals = sortData ? attrInfo.values : _.map(oldCatListData.data, 'id');

                var catData = _.map(attrVals, function genCatData(catVal) {
                    var globalFreq = attrInfo.valuesCount[catVal],
                        selTagFreq = currSelFreqs[catVal] || 0;
                    var isChecked = _.contains(filteringCatVals, catVal);
                    if(selTagFreq > 0) { highlightedCats.push(catVal); }
                    return {
                        text : catVal, // the text in the bar
                        id : catVal, // the Id of cat
                        selFreq: selTagFreq,
                        selPercent : selTagFreq > 0 ? Math.max(1, selTagFreq / maxFreq * 100) : 0,
                        globalFreq : globalFreq,
                        globalpercent : Math.max(1,globalFreq / maxFreq * 100),
                        isChecked : isChecked,
                        isSubsetted: isChecked,
                        isCurrent : selTagFreq > 0,
                        principalNodeBar: principalNode && principalNode.attr[attrInfo.attr.id] == catVal,
                        singleNodeSel: !!principalNode,
                        checkboxClass : {
                            'cat-checkbox-on' : inFilteringMode && isChecked,
                            'cat-checkbox-off' : inFilteringMode && !isChecked,
                            'cat-checkbox-disable' : false
                        }
                    };
                });

                if(sortData) {
                    catData = sortCatData(catData, sortType, sortOrder, inSelectionMode);
                }

                return {
                    colorStr : colorStr,
                    data : catData,
                    currSelFreqs : currSelFreqs,
                    highlightedCats : highlightedCats,
                    inSelectionMode: inSelectionMode
                };
            }

            function getCurrSelFreqsObj (currentSel, attrId) {
                return _.reduce(currentSel, function(acc, node) {
                    var val = node.attr[attrId];
                    if(val != null) {
                        acc[val] = acc[val]  + 1 || 1;
                    }
                    return acc;
                }, {});
            }
            function moveSelectedItemsToTop (currentSel, catListData, windowSize) {
                if(catListData.data.length <= windowSize) { return; }
                if(catListData.highlightedCats.length === 0) { return; }
                if(currentSel.length === 0) { return; }
                // if selected items are already being show, then skip sorting
                if(_.findLastIndex(catListData.data, 'isCurrent', true) < windowSize) { return; }
                // move the highlighted categories at the lowest position in the window, if they are outside it
                var data = _.partition(catListData.data, 'isCurrent', true);
                catListData.data = data[0].concat(data[1]);
            }

            function sortCatData(catData, sortType, sortOrder, inSelection) {
                var sortFn = function(cat) {
                    return inSelection ? cat.selFreq : cat.globalFreq;
                }; //sortType: frequency
                if(sortType === 'alphabetical') { sortFn = function(cat) { return cat.text.toLowerCase(); }; }
                var sortedCatData = _.sortBy(catData, sortFn);
                if(sortOrder === 'desc') { sortedCatData = sortedCatData.reverse(); }
                return sortedCatData;
            }


            return dirDefn;
        }]);
