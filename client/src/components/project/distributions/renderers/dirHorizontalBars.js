/*globals d3,$  */
angular.module('common')
    .directive('dirHorizontalBars', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService', 'layoutService', 'renderGraphfactory',
        function ($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES, hoverService, selectService, subsetService, layoutService, renderGraphfactory) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/horizontal_bars.html',
                scope: true,
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var dirPrefix = '[dirHorizontalBars] ';
            var ITEMS_TO_SHOW = 20;
            var ITEMS_TO_SHOW_INITIALLY = 20;
            var totalNodes = 0;


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
                var initVisItemCount = isCompareView ? 20 : ITEMS_TO_SHOW_INITIALLY;
                var sortOrder = scope.attrToRender.sortOps.sortOrder;
                var sortType = scope.attrToRender.sortOps.sortType;

                totalNodes = dataGraph.getAllNodes().length;

                var distrData = {
                    numShowGroups: 0,
                    numShownCats: initVisItemCount,
                    searchQuery: '',
                    initialItemCount: initVisItemCount,
                    startItem: function() {
                        if (distrData.numShownCats == scope.catListData.data.length) {
                            return distrData.numShowGroups * distrData.step + 1;
                        }

                        return distrData.numShownCats - distrData.step + 1;
                    },
                    step: ITEMS_TO_SHOW
                };
                scope.attrId = attrId;
                scope.distrData = distrData;
                scope.catListData = [];
                scope.colorStr = FilterPanelService.getColorString();
                scope.selNodesCount = 0;
                scope.totalValue = 0;
                scope.isShowMore = false;

                
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
                    
                    layoutService.getCurrent().then(function(layout) {
                        $timeout(function() {
                            var catListData = genTagListData(cs, attrInfo, filteringCatVals, defColorStr, valColorMap, sortType, sortOrder, layout);
                            setupFilterClasses(catListData, !scope.showFilter);
                            filterTags(cs, catListData);
                            scope.totalValue = catListData.maxValue;

                            scope.catListData = catListData.data.slice(0, 10);
                            scope.catListDataTail = catListData.data.slice(10);

                            distrData.numShownCats = Math.min(distrData.numShowGroups * ITEMS_TO_SHOW + initVisItemCount, catListData.data.length);
                        }, 1000)
                        
                    })
                }

                try {
                    filteringCatVals = _.get(FilterPanelService.getFilterForId(attrId), 'state.selectedVals', []);
                    draw();
                } catch (e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack, e);
                }

                function drawSubsetNodes(data) {
                    $timeout(async function () {
                        
                        const layout = await layoutService.getCurrent();

                        scope.isLoading = true;
                        filteringCatVals = _.uniq(_.map(data.nodes, function (node) {
                            return node.attr[scope.attrToRender.id];
                        }));
                        scope.catListData = (new Array(ITEMS_TO_SHOW)).map((r, i) => ({ id: i}));
                        var _catListData = genTagListData(data.nodes,
                            AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id), filteringCatVals, FilterPanelService.getColorString(), genValColorMap(scope.attrToRender.id, data.nodes), sortType, sortOrder, layout);
                        filterTags(data.nodes, _catListData);
                        
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

                        distrData.numShownCats = Math.min(distrData.numShowGroups * ITEMS_TO_SHOW + initVisItemCount, _catListData.data.length);
                        scope.$apply();

                        scope.isLoading = false;
                        scope.disappearAnimation = false;
                        scope.catListData = _catListData.data.slice(0, 10);
                        scope.catListDataTail = _catListData.data.slice(10);
                        
                        scope.totalValue = _catListData.maxValue;
                        scope.isShowMore = !scope.catListDataTail.length;
                        $timeout(() => {
                            scope.transition = false;
                        }, 1000);
                    }, 1000);
                }

                scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (ev, data) {
                    scope.showFilter = true;
                    scope.disappearAnimation = true;
                    scope.transition = true;

                    drawSubsetNodes(data)
                });

                scope.$on(BROADCAST_MESSAGES.cb.changed, function (ev, data) {
                    // var subset = subsetService.currentSubset();
                    var nodes = subsetService.subsetNodes;
                   
                    if (!nodes.length) {
                        draw();
                    } else {
                        drawSubsetNodes({nodes, subsetCount: nodes.length})
                    }
                    
                });

                scope.calcLineWidth = function(item) {
                    var num = item.selTagFreq || item.globalTagFreq;
                    return num / scope.totalValue * 100;
                }

                scope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                    if (!scope.catListData.data) return;

                    scope.catListData.data = scope.catListData.data.map(function mapData(cat) {
                        cat.isChecked = cat.isSubsetted || !cat.isSubsetted && selectService.hasAttrId(scope.attrToRender.id, cat.id);

                        return cat;
                    });
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
                    sortType = sortOps && sortOps.sortType || 'frequency';
                    sortOrder = sortOps && sortOps.sortOrder || 'desc';
                    scope.catListData.data = sortTagData(scope.catListData.data, sortType, sortOrder, (scope.catListData.highlightedCats || []).length > 0);
                }, true);

                scope.$watch('attrToRender.searchQuery', function onSearchQueryChanged(newVal, oldVal) {
                    distrData.searchQuery = newVal || '';
                });

                scope.getTooltipInfo = function(catData) {
                    var subsetLength = subsetService.currentSubset().length;
                    
                    if (subsetLength) {
                        var currentFreq = subsetLength > 0 ? catData.selTagFreq : catData.globalTagFreq;
                        return currentFreq;
                    } else {
                        return catData.globalTagFreq;
                    }
                }

                scope.overCat = function (catData, event) {
                    hoverService.hoverNodes({ attr: attrId, value: catData.id });
                };

                scope.outCat = function (catData, event) {
                    hoverService.unhover();
                };

                // mousr stuff
                scope.onCatClick = function (catData, event) {
                    if (catData.isSubsetted) return;
                    
                    selectFilter(catData);
                };

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
            function genTagListData(currentSel, globalAttrInfo, filteringCatVals, defColorStr, valColorMap, sortType, sortOrder, layout) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr);
                var maxValue = 0;
                var maxFreq = attrInfo.nValues;

                var inFilteringMode = filteringCatVals.length > 0;
                var highlightedCats = [];
                var subset = subsetService.currentSubset()
                var settings = renderGraphfactory.getRenderer().settings;

                var catData = _.map(attrInfo.values, function genCatData(catVal) {
                    var globalFreq = attrInfo.valuesCount[catVal],
                        selTagFreq = currSelFreqs[catVal] || 0;
                    var val = subset.length ? selTagFreq : globalFreq;

                    if (val > maxValue) {
                        maxValue = val;
                    }

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
                    
                    const color = attrInfo.attr.id === settings('nodeColorAttr') ? 
                            d3.rgb(layout.scalers.color(catVal)).toString() : 
                            '#cccccc';

                    return {
                        colorVal: color,
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
                    inFilteringMode: inFilteringMode,
                    maxValue
                };
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
                catListData.data = _.filter(catListData.data, 'isCurrent');
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
