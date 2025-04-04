/*globals d3,$  */
angular.module('common')
    .directive('dirHorizontalBars', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService', 'layoutService', 'renderGraphfactory', 'clusterService',
        function ($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES, hoverService, selectService, subsetService, layoutService, renderGraphfactory, clusterService) {
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
                scope.totalSelectedValue = 0;
                scope.selectedValues = {};
                scope.isShowMore = false;
                scope.displayItemsBars = 10;
                
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
                            scope.totalItems = catListData.data.length;
                            scope.catListData = catListData.data.slice(0, scope.displayItemsBars);
                            scope.catListDataTail = catListData.data.slice(scope.displayItemsBars);
                            distrData.numShownCats = Math.min(distrData.numShowGroups * ITEMS_TO_SHOW + initVisItemCount, catListData.data.length);
                        }, 500)
                    })
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
                        scope.catListData = _catListData.data.slice(0, scope.displayItemsBars);
                        scope.catListDataTail = _catListData.data.slice(scope.displayItemsBars);
                        
                        scope.totalValue = _catListData.maxValue;
                        scope.isShowMore = !scope.catListDataTail.length;
                        $timeout(() => {
                            scope.transition = false;
                        }, 500);
                    }, 500);
                }

                try {
                    filteringCatVals = _.get(FilterPanelService.getFilterForId(attrId), 'state.selectedVals', []);
                    var nodes = subsetService.subsetNodes;
                    if (!nodes.length) {
                        $timeout(function() {
                            draw();
                        }, 0);
                    } else {
                        drawSubsetNodes({nodes, subsetCount: nodes.length})
                    }
                } catch (e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack, e);
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
                        $timeout(function() {
                            draw();
                        }, 0);
                    } else {
                        drawSubsetNodes({nodes, subsetCount: nodes.length})
                    }
                    
                });
                
                scope.calcLineWidth = function(item) {
                    if (item) {
                        var num = item.selTagFreq || item.globalTagFreq;
                        return num / scope.totalValue * 100;
                    }
                }

                scope.calcSelectedLineWidth = function(attr) {
                    if (!scope.totalSelectedValue) {
                        return 0;
                    }
            
                    if (!scope.selectedValues[attr.id]) {
                        return 0;
                    }
                    const totalValues = Object.values(scope.selectedValues).reduce((acc, i) => acc += i, 0);            
                    return scope.selectedValues[attr.id] / totalValues * 100;
                }

                scope.$on(BROADCAST_MESSAGES.snapshot.changed, function(event, data) {
                    const nodes = selectService.getSelectedNodes();

                    const valuesCount = _.reduce(nodes, (acc, cv) => {
                        const attrValue = cv.attr[scope.attrToRender.id];
                        acc[attrValue] = acc[attrValue] ? (acc[attrValue] + 1) : 1;
                        return acc;
                    }, {});

                    if (!nodes.length) {
                        scope.totalSelectedValue = 0;

                    } else {
                        scope.totalSelectedValue = _(valuesCount).keys().map(x => valuesCount[x]).max();
                    }
            
                    scope.selectedValues = valuesCount;   
                });

                scope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                    scope.isInSelection = Boolean(data.nodes.length);
                    if (!data.nodes.length) {
                        scope.totalSelectedValue = 0;
                        return;
                    }
                    const valuesCount = _.reduce(data.nodes, (acc, cv) => {
                        const attrValue = cv.attr[scope.attrToRender.id];
                        acc[attrValue] = acc[attrValue] ? (acc[attrValue] + 1) : 1;
                        return acc;
                    }, {});
            
                    scope.totalSelectedValue = _(valuesCount).keys().map(x => valuesCount[x]).max();
                    scope.selectedValues = valuesCount;   

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

                function roundValue (value) {
                    if (value < 1 && value > 0) {
                        return '< 1%'
                    } 
                    if (value <= 0) {
                        return 0;
                    }

                    return `${Math.round(value)}%`;
                }

                scope.getTooltipInfo = function(catData) {
                    if (catData) {
                        var subsetLength = subsetService.currentSubset().length;
                        var total = 0;
                        var percent = catData.totalNodes / 100;
                        if (subsetLength) {
                            var currentFreq = subsetLength > 0 ? catData.selTagFreq : catData.globalTagFreq;
                            total = currentFreq;
                            percent = subsetLength / 100;
                        } else {
                            total = catData.globalTagFreq;
                        }
                        const totalValues = Object.values(scope.selectedValues).reduce((acc, i) => acc += i, 0);
                        const selectedVals = scope.selectedValues[catData.id];
                        if (scope.totalSelectedValue) {
                            //return (selectedVals || 0) + ' / ' + total;
                            return roundValue(((selectedVals || 0) / totalValues * 100).toFixed(1)) + ` / ${roundValue(catData.percentage)}`;
                        }
                        
                        return roundValue(catData.percentage || total);
                    }
                    return 0
                }

                scope.overCat = function (catData, event) {
                    hoverService.hoverNodes({ attr: scope.attrToRender.id, value: catData.id });
                };

                scope.outCat = function (catData, event) {
                    hoverService.unhover();
                };

                // mousr stuff
                scope.onCatClick = function (catData, event) {
                    if (catData.isSubsetted) return;

                    selectFilter(catData);
                };

                scope.toggleShowMore = function() {
                    scope.isShowMore = !scope.isShowMore;
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
                    selectService.selectNodes({ attr: scope.attrToRender.id, value: catData.id });
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
            function getClusters (layout) {
                const nodes = dataGraph.getRenderableGraph().graph.nodes;
                const clusterAttr = layout.mapprSettings.nodeClusterAttr;
                return _.reduce(nodes, function(acc, cv) {
                    const val = cv.attr[clusterAttr];
                    acc[val] = cv.clusterColorStr;
                    return acc;
                }, {});
            }
            function getSubclusters(layout) {
                const nodes = dataGraph.getRenderableGraph().graph.nodes;
                const clusterAttr = layout.mapprSettings.nodeSubclusterAttr;
                return _.reduce(nodes, function(acc, cv) {
                    const val = cv.attr[clusterAttr];
                    acc[val] = cv.clusterColorStr;
                    return acc;
                }, {});
            }
            
            function getColors(layout) {
                const nodes = dataGraph.getRenderableGraph().graph.nodes;
                const colorAttr = layout.mapprSettings.nodeColorAttr;
                return _.reduce(nodes, function(acc, cv) {
                    const val = cv.attr[colorAttr];
                    acc[val] = cv.colorStr;
                    return acc;
                }, {});  
            }
            function getColorMap(layout, attrInfo) {
                if (attrInfo.attr.id === layout.mapprSettings.nodeClusterAttr) {
                    return getClusters(layout);
                }

                if (attrInfo.attr.id === layout.mapprSettings.nodeSubclusterAttr) {
                    return getSubclusters(layout);
                }

                if (attrInfo.attr.id === layout.mapprSettings.nodeColorAttr) {
                    return getColors(layout);
                }

                return {};
            }
            function genTagListData(currentSel, globalAttrInfo, filteringCatVals, defColorStr, valColorMap, sortType, sortOrder, layout) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr);
                var maxValue = 0;
                var maxFreq = attrInfo.nValues;
                var usePercentage = true;
                var inFilteringMode = filteringCatVals.length > 0;
                var highlightedCats = [];
                var subset = subsetService.currentSubset()
                var settings = renderGraphfactory.getRenderer().settings;
                var values = attrInfo.values.map(function(catVal){
                    var globalFreq = attrInfo.valuesCount[catVal],
                        selTagFreq = currSelFreqs[catVal] || 0;
                    return subset.length ? selTagFreq : globalFreq;
                });
                var maxVal = values.reduce(function(v,v1){return v+v1;});
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
                    
                    const colorMap = getColorMap(layout, attrInfo);
                    const color = (colorMap && colorMap[catVal]) || '#cccccc';
                    var percent = maxVal/100; 
                    return {
                        val:val,
                        colorVal: color,
                        colorStr: valColorMap[catVal] && _.isArray(valColorMap[catVal]) ? valColorMap[catVal][0] : defColorStr,
                        text: catVal, // the text in the bar
                        percentage: usePercentage ? (val / percent).toFixed(1) : undefined,
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
