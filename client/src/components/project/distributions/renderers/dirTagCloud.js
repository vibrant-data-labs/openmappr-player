/*globals d3,$  */
angular.module('common')
    .directive('dirTagCloud', ['$timeout', '$q', '$filter', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService',
        function ($timeout, $q, $filter, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES, hoverService, selectService, subsetService) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/tagCloud.html',
                scope: true,
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var dirPrefix = '[dirTagCloud] ';
            var totalNodes = 0;


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs, renderCtrl) {
                scope.tagGrid = renderCtrl.attrInfo.attr.renderType;
                switch (scope.tagGrid) {
                    case 'tag-cloud_2':
                        scope.ITEMS_TO_SHOW = 16,
                        scope.ITEMS_TO_SHOW_INITIALLY = 16
                        break;
                    case 'tag-cloud_3':
                        scope.ITEMS_TO_SHOW = 15,
                        scope.ITEMS_TO_SHOW_INITIALLY = 15
                        break;
                    default:
                        scope.ITEMS_TO_SHOW = 20,
                        scope.ITEMS_TO_SHOW_INITIALLY = 20
                        break;
                }

                var attrId = scope.attrToRender.id;
                var filteringCatVals = [];
                var isCompareView = renderCtrl.isCompareView();
                var initVisItemCount = isCompareView ? 20 : scope.ITEMS_TO_SHOW_INITIALLY;
                var sortOrder = scope.attrToRender.sortOps.sortOrder;
                var sortType = scope.attrToRender.sortOps.sortType;

                totalNodes = dataGraph.getAllNodes().length;

                var distrData = {
                    numShowGroups: 0,
                    numShownCats: initVisItemCount,
                    searchQuery: '',
                    initialItemCount: initVisItemCount,
                    startItem: function() {
                        if (distrData.numShownCats == scope.filteredListData.length) {
                            return distrData.numShowGroups * distrData.step + 1;
                        }

                        return distrData.numShownCats - distrData.step + 1;
                    },
                    step: scope.ITEMS_TO_SHOW
                };

                scope.attrId = attrId;
                scope.distrData = distrData;
                scope.catListData = [];
                scope.colorStr = FilterPanelService.getColorString();
                scope.selNodesCount = 0;
                
                // prepares the data which is put into scope
                function draw() {
                    var nodes = dataGraph.getRenderableGraph().graph.nodes,
                        defColorStr = FilterPanelService.getColorString();

                    var cs = FilterPanelService.getCurrentSelection(),
                        attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id),
                        valColorMap = genValColorMap(attrId, nodes);

                    scope.selNodesCount = cs.length;

                    // Hack for compare view(Cluster attr)
                    if (isCompareView) {
                        cs = FilterPanelService.getNodesForClusters(cs[0].attr.extUserClusters);
                    }

                    var catListData = genTagListData(cs, attrInfo, filteringCatVals, defColorStr, valColorMap, sortType, sortOrder);

                    setupFilterClasses(catListData, !scope.showFilter);
                    filterTags(cs, catListData);
                    // moveSelectedItemsToTop(cs, catListData, distrData.numShowGroups * initVisItemCount);
                    scope.catListData = catListData;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, catListData.data.length);
                }

                try {
                    filteringCatVals = _.get(FilterPanelService.getFilterForId(attrId), 'state.selectedVals', []);
                    draw();
                } catch (e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack, e);
                }

                // reset filters as well
                // scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
                //     try {
                //         filteringCatVals = [];
                //         draw();
                //     } catch(e) {
                //         console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                //     }
                // });
                // on current selection change, update highlights
                // scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
                //     try {
                //         update();
                //     } catch(e) {
                //         console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                //     }
                // });

                // scope.$on(BROADCAST_MESSAGES.fp.filter.changFilterFromService, function() {
                //     try {
                //         var filterConfig = FilterPanelService.getFilterForId(attrId);
                //         filteringCatVals = (filterConfig && filterConfig.state && filterConfig.state.selectedVals) || [];
                //         draw();
                //         hoverSelectedNodes();
                //     } catch(e) {
                //         console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                //     }
                // });

                // scope.$on(BROADCAST_MESSAGES.fp.filter.changed, function applyBgToSelectedFilters() {
                //     draw();
                //     scope.catListData.data = scope.catListData.data.map(function mapData(cat) {
                //         if (cat.isChecked) {
                //             cat.isSubsetted = cat.isChecked;
                //         }

                //         return cat;
                //     });
                // });

                scope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                    if (!scope.catListData.data) return;
                    scope.catListData.data = scope.catListData.data.map(function mapData(cat) {
                        cat.isChecked = cat.isSubsetted || !cat.isSubsetted && selectService.hasAttrId(scope.attrToRender.id, cat.id);

                        return cat;
                    });
                });

                scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (ev, data) {
                    scope.attrToRender.searchQuery = '';
                    scope.showFilter = true;
                    scope.disappearAnimation = true;
                    scope.transition = true;
                    $timeout(function () {
                        prepareCatListData(scope, data);

                        $timeout(() => {
                            scope.transition = false;
                        }, 1000);
                    }, 1000);
                });

                function prepareCatListData(scope, data) {
                    scope.isLoading = true;
                    filteringCatVals = _.uniq(_.map(data.nodes, function (node) {
                        return node.attr[scope.attrToRender.id];
                    }));
                    scope.catListData = (new Array(scope.ITEMS_TO_SHOW)).map((r, i) => ({ id: i}));
                    var _catListData = genTagListData(data.nodes,
                        AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id), filteringCatVals, FilterPanelService.getColorString(), genValColorMap(scope.attrToRender.id, data.nodes), sortType, sortOrder);
                    scope.filteredListData = filterTags(data.nodes, _catListData);

                    _catListData.data = _catListData.data.map(function mapData(cat) {
                        cat.isSubsetted = cat.selPercentOfSel == 100;
                        cat.isChecked = cat.isSubsetted;

                        return cat;
                    });

                    var sortOps = scope.attrToRender.sortConfig;
                    _catListData.data = sortTagData(_catListData.data,
                        sortOps && sortOps.sortType || 'frequency',
                        sortOps && sortOps.sortOrder || 'desc', false);
                    setupFilterClasses(_catListData, false);
                    scope.selNodesCount = data.nodes.length;

                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, _catListData.data.length);
                    //scope.$apply();

                    scope.isLoading = false;
                    scope.disappearAnimation = false;
                    scope.catListData = _catListData;

                }

                scope.$on(BROADCAST_MESSAGES.hss.subset.init, function (ev) {
                    scope.showFirstPage();
                });
                /**
         * watch filters being enabled disabled
         */
                scope.$watch('showFilter', function onShowFilterChanged(newVal, oldVal) {
                    if (scope.catListData && oldVal != newVal) {
                        setupFilterClasses(scope.catListData, !newVal);
                    }
                });

                scope.$watch('attrToRender.sortConfig', function (sortOps) {
                    console.log('dirTagCloud: sortConfig', sortOps);
                    sortType = sortOps && sortOps.sortType || 'frequency';
                    sortOrder = sortOps && sortOps.sortOrder || 'desc';
                    var subsetData = subsetService.subsetNodes;
                    if (subsetData && subsetData.length) {
                        prepareCatListData(scope, { nodes: subsetData });
                    }
                    
                    scope.filteredListData = sortTagData(scope.filteredListData, sortType, sortOrder, scope.catListData.highlightedCats.length > 0)
                }, true);

                scope.$watch('attrToRender.searchQuery', function onSearchQueryChanged(newVal, oldVal) {
                    distrData.searchQuery = newVal || '';

                    if (newVal) {
                        scope.filteredListData = $filter('filter')(scope.catListData.data, {text: newVal, isCurrent: true});
                        distrData.numShowGroups = 0;
                        distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, scope.filteredListData.length);
                    } else {
                        var subsetData = subsetService.subsetNodes;
                        if (subsetData && subsetData.length) {
                            prepareCatListData(scope, { nodes: subsetData });
                        } else {
                            scope.filteredListData = $filter('filter')(scope.catListData.data, (item) => item.id )
                        }
                    }
                });

                scope.getTooltipInfo = function(catData) {
                    var subsetLength = subsetService.currentSubset().length;
                    var totalNodes = subsetLength > 0 ? subsetLength : catData.totalNodes;
                    var currentFreq = subsetLength > 0 ? catData.selTagFreq : catData.globalTagFreq;
                    return currentFreq + " of " + totalNodes + " tagged as " + catData.text;
                }

                scope.overCat = function (catData, event) {
                    hoverService.hoverNodes({ attr: attrId, value: catData.id });
                };

                scope.outCat = function (catData, event) {
                    hoverService.unhover();
                };


                scope.showLastPage = function() {
                    distrData.numShowGroups = Math.floor(scope.filteredListData.length / distrData.step);
                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, scope.filteredListData.length);
                };

                scope.showMore = function () {
                    distrData.numShowGroups++;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, scope.filteredListData.length);
                };
                scope.showLess = function () {
                    distrData.numShowGroups--;
                    distrData.numShowGroups = distrData.numShowGroups < 0 ? 0 : distrData.numShowGroups;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, scope.filteredListData.length);
                };

                scope.showFirstPage = function() {
                    distrData.numShowGroups = 0;
                    distrData.numShownCats = Math.min(distrData.numShowGroups * scope.ITEMS_TO_SHOW + initVisItemCount, scope.filteredListData.length);
                };

                // mousr stuff
                scope.onCatClick = function (catData, event) {
                    if (catData.isSubsetted) return;

                    //catData.isChecked = !catData.isChecked;
                    selectFilter(catData);

                    hoverService.unhover();
                };

                function getSelectedValues() {
                    var filterConfig = FilterPanelService.getFilterForId(attrId);
                    return filterConfig.state.selectedVals;
                }

                function hoverSelectedNodes(event) {
                    var selectedValues = getSelectedValues() || [];
                    console.log('dirTagCloud hoverSelectedNodes', selectedValues);
                    renderCtrl.hoverNodesByAttributes(attrId, selectedValues, event);
                }

                /// filter stuff
                function setupFilterClasses(catListData, isfilterDisabled) {
                    var inFilteringMode = filteringCatVals.length > 0;
                    _.each(catListData.data, function (catData) {
                        catData.checkboxClass['cat-checkbox-on'] = !catData.isSubsetted;
                        catData.checkboxClass['cat-checkbox-off'] = catData.isSubsetted;
                        catData.checkboxClass['cat-checkbox-disable'] = catData.isSubsetted;
                    });
                }

                /// Select nodes by filter
                function selectFilter(catData) {
                    selectService.selectNodes({ attr: attrId, value: catData.id });
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
            function genTagListData(currentSel, globalAttrInfo, filteringCatVals, defColorStr, valColorMap, sortType, sortOrder) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr);

                var maxFreq = attrInfo.nValues;

                var inFilteringMode = filteringCatVals.length > 0;
                var highlightedCats = [];

                var catData = _.map(attrInfo.values, function genCatData(catVal) {
                    var globalFreq = attrInfo.valuesCount[catVal],
                        selTagFreq = currSelFreqs[catVal] || 0;

                    var isChecked = _.contains(filteringCatVals, catVal);

                    if (selTagFreq > 0) { highlightedCats.push(catVal); }

                    var importance = 1;
                    if (currentSel.length > 0) {
                        //single or multiple
                        importance = computeImportance(selTagFreq, globalFreq);
                    } else {
                        //no selection - ie global
                        importance = globalFreq;
                    }

                    return {
                        colorStr: valColorMap[catVal] && _.isArray(valColorMap[catVal]) ? valColorMap[catVal][0] : defColorStr,
                        text: catVal, // the text in the bar
                        id: catVal, // the Id of cat
                        selPercent: selTagFreq > 0 ? Math.max(0.1, selTagFreq / totalNodes * 100) : 0,
                        selPercentOfSel: currentSel.length < 2 ? globalFreq / totalNodes * 100 : selTagFreq / currentSel.length * 100,
                        selTagFreq: selTagFreq,
                        globalTagFreq: globalFreq,
                        curSelLength: currentSel.length,
                        maxFreq: maxFreq,
                        totalNodes: totalNodes,
                        globalpercent: Math.max(0.1, globalFreq / totalNodes * 100),
                        isChecked: isChecked,
                        isCurrent: selTagFreq > 0,
                        importance: importance,
                        checkboxClass: {
                            'cat-checkbox-on': inFilteringMode && isChecked,
                            'cat-checkbox-off': inFilteringMode && !isChecked,
                            'cat-checkbox-disable': false
                        },
                        inSelectionMode: false
                    };
                });

                catData = sortTagData(catData, sortType, sortOrder, highlightedCats.length > 0);

                return {
                    data: catData,
                    highlightedCats: highlightedCats,
                    currSelFreqs: currSelFreqs,
                    inFilteringMode: inFilteringMode
                };
            }

            function updateTagListData(currentSel, globalAttrInfo, filteringCatVals, defColorStr, valColorMap, catListData) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr);

                var inFilteringMode = filteringCatVals.length > 0;
                var inSelectionMode = !_.isEmpty(currentSel);

                _.each(catListData.data, function (catData) {
                    var selTagFreq = currSelFreqs[catData.id] || 0;

                    catData.colorStr = valColorMap[catData.id] && _.isArray(valColorMap[catData.id]) ? valColorMap[catData.id][0] : defColorStr;
                    catData.selPercent = selTagFreq > 0 ? Math.max(0.1, selTagFreq / totalNodes * 100) : 0;
                    catData.isCurrent = selTagFreq > 0;
                    catData.selTagFreq = selTagFreq;
                });

                catListData.highlightedCats = _.map(_.filter(catListData.data, function (c) { return c.selPercent > 0; }), 'id');
                catListData.currSelFreqs = currSelFreqs;
                catListData.inFilteringMode = inFilteringMode;
                catListData.inSelectionMode = inSelectionMode;
            }

            // tag importance as a function of tag frequency in local selection and global tag frequency
            function computeImportance(localFreq, globalFreq) {
                return (localFreq * localFreq) / globalFreq;
            }

            function getCurrSelFreqsObj(currentSel, attr) {
                return _.reduce(currentSel, function (acc, node) {
                    var val = node.attr[attr.id];
                    if (val != null) {
                        if (_.isArray(val)) {
                            for (var i = val.length - 1; i >= 0; i--) {
                                acc[val[i]] = acc[val[i]] + 1 || 1;
                            }
                        } else {
                            acc[val] = acc[val] + 1 || 1;
                        }
                    }
                    return acc;
                }, {});
            }

            function genValColorMap(attrId, nodes) {
                var obj = {};
                for (var i = nodes.length - 1; i >= 0; i--) {
                    var attrVal = nodes[i].attr[attrId],
                        color = nodes[i].colorStr;
                    if (attrVal != null) {
                        for (var j = attrVal.length - 1; j >= 0; j--) {
                            var tagVal = attrVal[j];
                            if (obj[tagVal] != null && obj[tagVal].indexOf(color) === -1) {
                                obj[tagVal].push(color);
                            } else {
                                obj[tagVal] = [color];
                            }
                        }
                    }

                }
                return obj;
            }

            function filterTags(cs, catListData) {
                if (cs.length === 0 || catListData.highlightedCats.length === 0) { return; }
                return _.filter(catListData.data, 'isCurrent');
            }

            function sortTagData(catData, sortType, sortOrder, inSelection) {
                var sortFn = function (cat) { return cat.importance; }; //sortType: statistical
                if (sortType === 'alphabetical') { sortFn = function (cat) { return cat.text.toLowerCase(); }; }
                if (sortType === 'frequency') {
                    sortFn = function (cat) {
                        return subsetService.currentSubset().length > 0 ? cat.selTagFreq : cat.globalTagFreq;
                    };
                }
                var sortedCatData = _.sortBy(catData, sortFn);
                if (sortOrder === 'desc') { sortedCatData = sortedCatData.reverse(); }
                return sortedCatData;
            }


            return dirDefn;
        }]);
