angular.module('common')
    .controller('FilterPanelCtrl', ['$scope', '$rootScope', '$timeout', 'FilterPanelService', 'SelectorService', 'dataGraph', 'AttrInfoService', 'graphSelectionService', 'layoutService', 'nodeSelectionService', 'uiService', 'attrUIService', 'renderGraphfactory', 'networkService', 'BROADCAST_MESSAGES', 'selectService', 'subsetService',
        function($scope, $rootScope, $timeout, FilterPanelService, SelectorService, dataGraph, AttrInfoService, graphSelectionService, layoutService, nodeSelectionService, uiService, attrUIService, renderGraphfactory, networkService, BROADCAST_MESSAGES, selectService, subsetService){
            'use strict';

            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[ctrlFilterPanel: ] ';          
            var groups = {
                tag: ['tag-cloud'],
                widetag: ['wide-tag-cloud'],
                charts: ['histogram']
            };

            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */
            $scope.nodeDistrAttrs = [];
            $scope.currentSelection = [];
            $scope.MAPP_EDITOR_OPEN = $rootScope.MAPP_EDITOR_OPEN;

            /**
    * Scope methods
    */
            $scope.resetFilters = resetFilters;


            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
            $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, function() {
                var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                    x();
                    initialise(true);
                });
            });
            $scope.$on(BROADCAST_MESSAGES.selectNodes, onNodeSelect);
            $scope.$on(BROADCAST_MESSAGES.selectStage, onStageSelect);
            $scope.$on(BROADCAST_MESSAGES.snapshot.changed, onSnapshotChange);
            $scope.$on(BROADCAST_MESSAGES.fp.filter.changed, onFilterSubset);
            $scope.$on(BROADCAST_MESSAGES.fp.filter.undo, onFilterUndo);
            $scope.$on(BROADCAST_MESSAGES.fp.filter.redo, onFilterRedo);
            $scope.$on('TOGGLEFILTERS', toggleFiltersVisiblity);
            $scope.$on('RESETFILTERS', resetFilters);

            $scope.$on('$destroy', function() {
                $scope.ui.renderDistr = false;
            });

            $scope.$on(BROADCAST_MESSAGES.hss.select, function(e, data) {
                $scope.ui.activeFilterCount = data.filtersCount + (data.isSubsetted ? 1 : 0) + (data.filtersCount == 0 && data.selectionCount > 0 ? 1 : 0);
                $scope.ui.subsetEnabled = data.selectionCount > 0;
            });

            $scope.searchToggle = function searchToggle(attr) {
                const card = document.querySelector('.card_type_filter[data-attr="' + attr.id + '"]');
                //const searchBoxInput = document.getElementsByClassName('search-box__input')[0];

                card.classList.toggle('card_expanded');
                //searchBoxInput.focus();
            }

            $scope.clearSearch = function search(attr) {
                attr.searchQuery = null;
            }

            $scope.setSortOrder = function setSortOrder(attr, sortType) {
                var newSortOrder;
                if (sortType === 'frequency' && (!attr.sortConfig || (attr.sortConfig && attr.sortConfig.sortType === 'alphabetical'))) {
                    newSortOrder = 'desc';
                } else if (sortType === 'alphabetical' && (!attr.sortConfig || (attr.sortConfig && attr.sortConfig.sortType === 'frequency'))) {
                    newSortOrder = 'asc';
                } else {
                    newSortOrder = attr.sortConfig.sortOrder === 'asc' ? 'desc' : 'asc';
                }
                attr.sortConfig = { sortType };
                attr.sortConfig.sortOrder = newSortOrder;
            }

            $scope.onScroll = function() {
                var chartItem = $('.chart-first-item').position().top;
                if (chartItem < window.innerHeight / 2) {
                    document.querySelector('.filter-header__item.tag') && document.querySelector('.filter-header__item.tag').classList.remove('filter-header__item_current');
                    document.querySelector('.filter-header__item.chart') && document.querySelector('.filter-header__item.chart').classList.add('filter-header__item_current');
                } else {
                    document.querySelector('.filter-header__item.tag') && document.querySelector('.filter-header__item.tag').classList.add('filter-header__item_current');
                    document.querySelector('.filter-header__item.chart') && document.querySelector('.filter-header__item.chart').classList.remove('filter-header__item_current');
                }
            }

            $scope.onAttrHeaderLoad = function(attr, $event) {
                var elem = $event.target[0]
                if (elem.scrollWidth > elem.clientWidth) {
                    attr.headerPopupText = attr.title;
                }
            };

            /*************************************
    ********* Initialise *****************
    **************************************/
            dataGraph.getRawData().then(function (resolve) {
                initialise(!FilterPanelService.isInitialized());
            });

            networkService.getCurrentNetworkPromisified().then(function(currentNetworkP) {
                $scope.ui.renderDistr = true;
                $scope.ui.enableFilters = true;
            });

            /*************************************
    ********* Core Functions *************
    **************************************/

            function initialise(clearServiceState) {
                console.log(logPrefix + "initializing...");
                var newSelection;

                // Initialise bases on panel state
                if(clearServiceState) {
                    selectService.init();
                    FilterPanelService.init();
                }
                if(FilterPanelService.shouldReplaceNewSel()) {
                    newSelection = graphSelectionService.getSelectedNodes() || [];
                    FilterPanelService.updateInitialSelection(newSelection);
                    $rootScope.$broadcast(BROADCAST_MESSAGES.fp.currentSelection.changed, {nodes: newSelection});
                    if(FilterPanelService.getActiveFilterCount() > 0) {
                        FilterPanelService.applyFilters();
                        updateSelAndGraph(window.event);
                    }
                }
                else {
                    newSelection = FilterPanelService.getInitialSelection();
                }

                // Build distribution attrs list
                var infoObj = AttrInfoService.getNodeAttrInfoForRG();
                $scope.nodeDistrAttrs = [];
                _.each(dataGraph.getNodeAttrs(), function(attr) {
                    if(AttrInfoService.isDistrAttr(attr, infoObj.getForId(attr.id))) {
                        var attrClone = _.clone(attr);
                        attrClone.principalVal = null;
                        attrClone.fpHeight = null;
                        attrClone.disableFilter = newSelection.length === 1 ? true : false;
                        $scope.nodeDistrAttrs.push(attrClone);
                    }
                });

                $rootScope.canShowTagsBtn = function() {
                    return $scope.nodeDistrAttrs.some(function(attr) { 
                        return attr.visible && (attr.renderType == 'tag-cloud' || attr.renderType == 'wide-tag-cloud');
                    });
                }

                $rootScope.canShowChartsBtn = function() {
                    return $scope.nodeDistrAttrs.some(function(attr) { 
                        return attr.visible && (attr.attrType == 'integer' || attr.attrType == 'float' || attr.attrType == 'year' || attr.attrType == 'timestamp')
                    });
                }

                var tagAttrs = $scope.nodeDistrAttrs.filter(function(x) { return groups.tag.includes(x.renderType) || groups.widetag.includes(x.renderType);});
                var visibleTagAttrs = tagAttrs.filter(function(x) {
                    return x.visible;
                });
                if (visibleTagAttrs.length) {
                    visibleTagAttrs[0].isFirstTag = true;
                }

                var chartAttrs = $scope.nodeDistrAttrs.filter(function(x) { return groups.charts.includes(x.renderType);});
                var visibleChartAttrs = chartAttrs.filter(function(x) {
                    return x.visible;
                });

                if (visibleChartAttrs.length) {
                    visibleChartAttrs[0].isFirstChart = true;
                }

                $scope.ui.totalAttrsCount = $scope.nodeDistrAttrs.length;

                // move network attrs to top, both for tags and charts
                var networkAttrs = networkService.getNetworkAttrs(networkService.getCurrentNetwork().id);
                tagAttrs = _(tagAttrs)
                    .partition(function(attr) { return networkAttrs.indexOf(attr.id) > -1; })
                    .flatten()
                    .value();

                chartAttrs = _(chartAttrs)
                    .partition(function (attr) { return networkAttrs.indexOf(attr.id) > -1; })
                    .flatten()
                    .value();

                $scope.nodeDistrAttrs = [...tagAttrs, ...chartAttrs];
                updateNodeColorStr();
                // Set 'sortType' for tag attrs
                setSortForTags($scope.nodeDistrAttrs, !_.isEmpty(newSelection));
                $scope.currentSelection = FilterPanelService.getCurrentSelection();
                console.log('current selection: ', $scope.currentSelection);
                $scope.$broadcast(BROADCAST_MESSAGES.fp.panel.rebuild, {nodes: newSelection});
                updateInfoData($scope.currentSelection);
            }

            function onNodeSelect(ev, data) {
                console.log('onFilterSubset', $scope.nodeDistrAttrs);

                if(!data.newSelection) {
                    console.warn(logPrefix + 'ignoring selection reset for intermediate selection');
                    return;
                }
                resetInitialSelection(data && data.nodes ? data.nodes : []);
            }

            function onStageSelect() {
                resetInitialSelection([]);
            }

            function onSnapshotChange(ev, data) {
                var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                    x();
                    if(data.snapshot && data.snapshot.processSelection) {
                        resetInitialSelection(selectService.getSelectedNodes());
                    }
                    else {
                        console.warn(logPrefix + 'carrying over previous selection on snapshot change, so not resetting initial selection for filter panel.');
                    }
                });
            }
            // reset panel with the new selection
            function resetInitialSelection(nodes) {
                console.log(logPrefix + "resetInitialSelection called");
                var newSelection = _.isArray(nodes) ? nodes : [];

                FilterPanelService.init();
                FilterPanelService.updateInitialSelection(newSelection);
                $scope.currentSelection = FilterPanelService.getCurrentSelection();
                updateNodeColorStr();
                if(_.isArray(nodes) && nodes.length === 1) {
                    _.each($scope.nodeDistrAttrs, function (attr) {
                        attr.disableFilter = true;
                    });
                }
                // Set 'sortType' for tag attrs
                setSortForTags($scope.nodeDistrAttrs, newSelection.length > 0);

                if (!nodes || nodes.length < 1) {
                    //graphSelectionService.clearSelections(true);
                }

                //$rootScope.$broadcast(BROADCAST_MESSAGES.fp.initialSelection.changed, {nodes: newSelection});

                updateInfoData($scope.currentSelection);
            }

            function onFilterSubset(ev) {
                console.log('onFilterSubset onFilterSubset', ev);

                var filterGetLastState = FilterPanelService.getFilterMapAfterSubset();

                console.log('onFilterSubset filterGetLastState', filterGetLastState);
                FilterPanelService.applyFilters();
                _selectNodes(ev);
                FilterPanelService.setFilterMapAfterSubset(FilterPanelService.getAttrFilterConfigMap());
                console.log('onFilterSubset getAttrFilterConfigMap', FilterPanelService.getAttrFilterConfigMap());
                var undoRedoResultObject = FilterPanelService.appendToSelectionHistory(filterGetLastState);

                console.log('onFilterSubset undoRedoResultObject', undoRedoResultObject);

                $scope.$emit(BROADCAST_MESSAGES.fp.filter.undoRedoStatus, undoRedoResultObject);
            }

            function onFilterUndo() {
                var undoRedoResultObject = FilterPanelService.undoFilterFromSelectionHistory();
                $scope.$emit(BROADCAST_MESSAGES.fp.filter.undoRedoStatus, undoRedoResultObject);

                _selectNodes({}, true);
            }

            function onFilterRedo() {
                var undoRedoResultObject = FilterPanelService.redoFilterFromSelectionHistory();
                $scope.$emit(BROADCAST_MESSAGES.fp.filter.undoRedoStatus, undoRedoResultObject);

                _selectNodes({}, true);
            }

            function resetFilters() {
                subsetService.unsubset();
                selectService.unselect();
            }

            function updateNodeColorStr () {
                var layout = layoutService.getCurrentIfExists();
                if(layout) {
                    $scope.nodeColorStr = FilterPanelService.genColorString(layout.setting('nodeColorAttr'));
                    console.log(777, $scope.nodeColorStr);
                } else {
                    $scope.nodeColorStr = FilterPanelService.getColorString();
                    console.log(777, $scope.nodeColorStr);
                }
            }

            function updateInfoData(selection) {
                if(!_.isArray(selection)) throw new Error('Array expected');
                if(selection.length > 0) {
                    $scope.nodeCountInGraph = selection.length;
                }
                else {
                    $scope.nodeCountInGraph = dataGraph.getAllNodes().length;
                }
                $scope.ui.activeFilterCount = selectService.getActiveFilterCount();

                var infoObj = AttrInfoService.getNodeAttrInfoForRG();
                if(selection.length === 1) {
                    var node = selection[0];
                    _.each($scope.nodeDistrAttrs, function(attr) {
                        var attrInfo = infoObj.getForId(attr.id);
                        var nodeVal = node.attr[attr.id];
                        attr.spHeight = attrUIService.getAttrFPHeight(attrInfo, $scope.ui.enableFilters);
                        attr.principalVal = nodeVal;
                        if(attr.principalVal){ //if principalVal exist else skip mods
                            if(attr.attrType == 'float') {
                                attr.principalVal = attr.principalVal.toFixed(2);
                            }
                        }
                        // attr.disableFilter = true;
                    });
                }
                else {
                    _.each($scope.nodeDistrAttrs, function(attr) {
                        var attrInfo = infoObj.getForId(attr.id);
                        attr.spHeight = attrUIService.getAttrFPHeight(attrInfo, $scope.ui.enableFilters);
                        attr.principalVal = null;
                        attr.disableFilter = false;
                    });
                }

                // Hack
                if(!$scope.$$phase && !$rootScope.$$phase) {
                    $scope.$apply();
                }
            }

            function toggleFiltersVisiblity() {
                var infoObj = AttrInfoService.getNodeAttrInfoForRG();
                _.each($scope.nodeDistrAttrs, function(attr) {
                    var attrInfo = infoObj.getForId(attr.id);
                    attr.showFilter = $scope.ui.enableFilters;
                    attr.spHeight = attrUIService.getAttrFPHeight(attrInfo, $scope.ui.enableFilters);
                });
                FilterPanelService.updateFiltersVis($scope.ui.enableFilters);
                $scope.$broadcast(BROADCAST_MESSAGES.fp.filter.visibilityToggled, {filtersVisible: $scope.ui.enableFilters});
            }

            function updateSelAndGraph(ev, useFilterState) {
                var currentSelection = FilterPanelService.getCurrentSelection(),
                    renderer = renderGraphfactory.getRenderer();

                $scope.currentSelection = currentSelection;
                if(!currentSelection || (_.isArray(currentSelection) && currentSelection.length === 0)) {
                    if(selectService.getActiveFilterCount() > 0) {
                        selectService.unselect();
                        //Hack to show graph darkened state
                        renderer.render({drawLabels: false});
                        renderer.greyout(true, 'select');
                    }
                    else {
                        selectService.unselect();
                    }

                    // UI SERVICE not available in player ,removing this for now
                    // uiService.log('Nothing matches the selection criteria!');
                }
                else {
                    sigma.renderers.common.prototype.render.call(renderer, true, false, renderer.settings); //Hack to render labels after graph darkened state
                    nodeSelectionService.selectNodeIdList(_.map(currentSelection, 'id'), ev, false, true);
                    updateNodeColorStr();
                }

                updateInfoData($scope.currentSelection);
                $rootScope.$broadcast(BROADCAST_MESSAGES.fp.currentSelection.changed, {nodes: currentSelection});

                if (useFilterState) {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.fp.filter.changFilterFromService);
                }
            }

            function setSortForTags(attrs, selectionMode) {
                _.each(attrs, function(attr) {
                    if ((attr.renderType === 'tags' || attr.renderType === 'tag-cloud' || attr.renderType === 'wide-tag-cloud')
                && _.get(attr, 'sortOps.sortType') !== 'alphabetical') {
                        attr.sortOps.sortType = selectionMode ? 'statistical' : 'frequency';
                    }
                });
            }

            function _selectNodes(ev, undoOrRedo) {
                updateSelAndGraph(ev, !!undoOrRedo);
                if(_.isEmpty(FilterPanelService.getInitialSelection())) {
                    $scope.$evalAsync(function() {
                        FilterPanelService.rememberSelection(true);
                    });
                }
            }


        }
    ]);
