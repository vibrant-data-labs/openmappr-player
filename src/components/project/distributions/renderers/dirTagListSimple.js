/*globals d3,$  */
angular.module('common')
    .directive('dirTagListSimple', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES',
        function($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                template: '<div ng-include="getTemplate()"></div>',
                // templateUrl: '#{player_prefix_index}/partials/renderers/tagListSimple.html',
                scope: true,
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var dirPrefix = '[dirTagListSimple] ';
            var ITEMS_TO_SHOW = 10;
            var tooltipText;


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
                var initVisItemCount = isCompareView ? 20 : ITEMS_TO_SHOW;

                var distrData = {
                    numShowGroups : 1,
                    numShownCats : initVisItemCount
                };
                scope.attrId = attrId;
                scope.distrData = distrData;
                scope.catListData = [];
                scope.colorStr = FilterPanelService.getColorString();

                //get correct template based on type
                scope.getTemplate = function() {
                    if(attrs.template == 'tagCloud') {
                        return '#{player_prefix_index}/partials/renderers/tagCloud.html';
                    } else {
                        return '#{player_prefix_index}/partials/renderers/tagListSimple.html';
                    }
                };

                // prepares the data which is put into scope
                function draw() {
                    var nodes = dataGraph.getRenderableGraph().graph.nodes,
                        defColorStr = FilterPanelService.getColorString();

                    var cs       = FilterPanelService.getCurrentSelection(),
                        attrInfo     = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id),
                        valColorMap  = genValColorMap(attrId, nodes);

                    // Hack for compare view(Cluster attr)
                    if(isCompareView) {
                        cs = FilterPanelService.getNodesForClusters(cs[0].attr.extUserClusters);
                    }

                    var catListData  = genCatListData(cs, attrInfo, filteringCatVals, defColorStr, valColorMap);

                    setupFilterClasses(catListData, !scope.showFilter);
                    moveSelectedItemsToTop(cs, catListData, distrData.numShowGroups * initVisItemCount);
                    scope.catListData = catListData;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * initVisItemCount, catListData.data.length);
                }

                try {
                    filteringCatVals = [];
                    draw();
                } catch(e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                }

                // reset filters as well
                scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
                    try {
                        filteringCatVals = [];
                        draw();
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });
                // on current selection change, update highlights
                scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
                    try {
                        draw();
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

                scope.overCat = function(catData, event) {
                    var off = $(event.currentTarget).offset(),
                        tElem = event.target,
                        tElemPosnObj = tElem.getBoundingClientRect();
                    // console.log('off: ', off);
                    scope.tooltipText = tooltipText;
                    element.find('.tooltip-positioner').css({
                        top : tElemPosnObj.top - off.top,
                        left : -10
                    });
                    scope.openTooltip = true;
                };

                scope.outCat = function() {
                    $timeout(function() {
                        scope.openTooltip = false;
                        renderCtrl.unHoverNodes();
                    }, 100);
                };


                scope.showMore = function() {
                    distrData.numShowGroups++;
                    distrData.numShownCats = distrData.numShowGroups * initVisItemCount;
                };
                scope.showLess = function() {
                    distrData.numShowGroups = 1;
                    distrData.numShownCats = distrData.numShowGroups * initVisItemCount;
                };

                // mousr stuff
                scope.onCatClick = function(catData) {
                    catData.isChecked = !catData.isChecked;
                    scope.onFilterUpdate();
                };
                scope.onCatMouseover = function(catData, $event) {
                    if(isCompareView && attrId == 'Cluster') {
                        tooltipText = _.get(renderCtrl.getClusterMeta(), catData.text + '.descr');
                    }
                    else {
                        tooltipText = catData.text;
                    }
                    // hover nodes
                    renderCtrl.hoverNodesByAttrib(attrId, catData.id, $event);
                };
                scope.onFilterUpdate = function() {
                    selectFilter();
                };


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
     * styling in _renderers.scss
     */


            /**
     * Generate data for cat list
     * @param  {Array} currentSel        The current selection
     * @param  {Object} globalAttrInfo   The attrInfo object
     * @param  {Array} filteringCatVals  cat Values which are being used to filter the list
     * @param  {Object} valColorMap      A mapping from Value to it's corresponding color
     * @return {Object}                  An object used to render cat listing
     */
            function genCatListData (currentSel, globalAttrInfo, filteringCatVals, defColorStr, valColorMap) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr.id);

                var maxFreq = attrInfo.nValues;

                var inFilteringMode = filteringCatVals.length > 0;
                var highlightedCats = [];

                var catData = _.map(attrInfo.values, function genCatData(catVal) {
                    var globalFreq = attrInfo.valuesCount[catVal],
                        selTagFreq = currSelFreqs[catVal] || 0;
                    var isChecked = _.contains(filteringCatVals, catVal);

                    if(selTagFreq > 0) { highlightedCats.push(catVal); }

                    return {
                        colorStr : valColorMap[catVal] && _.isArray(valColorMap[catVal]) ? valColorMap[catVal][0] : defColorStr,
                        text : catVal, // the text in the bar
                        id : catVal, // the Id of cat
                        selPercent : selTagFreq > 0 ? Math.max(0.1, selTagFreq / maxFreq * 100) : 0,
                        globalpercent : Math.max(0.1,globalFreq / maxFreq * 100),
                        isChecked : isChecked,
                        isCurrent : selTagFreq > 0,
                        checkboxClass : {
                            'cat-checkbox-on' : inFilteringMode && isChecked,
                            'cat-checkbox-off' : inFilteringMode && !isChecked,
                            'cat-checkbox-disable' : false
                        }
                    };
                });
                // from max to min
                catData.reverse();


                return {
                    data : catData,
                    highlightedCats : highlightedCats,
                    currSelFreqs : currSelFreqs,
                    inFilteringMode : inFilteringMode
                };
            }

            function getCurrSelFreqsObj (currentSel, attrId) {
                return _.reduce(currentSel, function(acc, node) {
                    var val = node.attr[attrId];
                    if(val != null) {
                        for(var i = val.length-1; i >= 0; i--) {
                            acc[val[i]] = acc[val[i]]  + 1 || 1;
                        }
                    }
                    return acc;
                }, {});
            }

            function genValColorMap (attrId, nodes) {
                var obj = {};
                for(var i = nodes.length-1; i >= 0; i--) {
                    var attrVal = nodes[i].attr[attrId],
                        color = nodes[i].colorStr;
                    if(attrVal != null) {
                        for(var j = attrVal.length-1; j >= 0; j--) {
                            var tagVal = attrVal[j];
                            if(obj[tagVal] != null && obj[tagVal].indexOf(color) === -1) {
                                obj[tagVal].push(color);
                            } else {
                                obj[tagVal] = [color];
                            }
                        }
                    }

                }
                return obj;
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

            return dirDefn;
        }]);
