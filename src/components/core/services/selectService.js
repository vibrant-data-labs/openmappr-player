/**
* Handles Graph Selection ops
*/
angular.module('common')
    .service('selectService', ['$rootScope', '$q', 'dataService', 'renderGraphfactory', 'dataGraph', 'nodeRenderer', 'inputMgmtService', 'BROADCAST_MESSAGES', 'SelectorService', 'subsetService', 'graphSelectionService', 'searchService', 'layoutService', 'GEO_REGION_TITLES',
        function ($rootScope, $q, dataService, renderGraphfactory, dataGraph, nodeRenderer, inputMgmtService, BROADCAST_MESSAGES, SelectorService, subsetService, graphSelectionService, searchService, layoutService, GEO_REGION_TITLES) {
            'use strict';

            /*************************************
            *************** API ******************
            **************************************/
            this.sigBinds = sigBinds;
            this.selectNodes = selectNodes;
            this.selectSingleNode = selectSingleNode;
            this.appendToSelection = appendToSelection;
            this.singleNode = null;
            this.unselect = unselect;
            this.selectedNodes = [];
            this.getActiveFilterCount = getActiveFilterCount;
            this.getFilterForId = getFilterForId;
            this.hasFilter = hasFilter;
            this.getSelectedNodes = getSelectedNodes;
            this.hasAttrId = hasAttrId;
            this.init = init;
            this.filters = null;
            this._filter = filter;
            this.applyFilters = applyFilters;
            this.createMultipleFilter = createMultipleFilter;
            this.createMinMaxFilter = createMinMaxFilter;
            this.attrs = null;
            this.prevBroadcastData = null;

            this.copyFilters = function () {
                return angular.copy(this.filters);
            };

            const GEO_FILTERS = {
                'countries': 'Country',
                'fed_districts': 'States',
                'adm_districts': 'Counties',
            }

            /*************************************
            ********* Local Data *****************
            **************************************/
            var findNodeWithId;

            function getActiveFilterCount() {
                return _.filter(_.values(this.filters), 'isEnabled').length;
            }

            /*************************************
            ********* CLASSES ********************
            **************************************/
            function FilterConfig(attrId, attrName, bounds) {
                this.attrId = attrId;
                this.attrName = attrName;
                if (bounds) {
                    this.max = bounds.max;
                    this.min = bounds.min;
                }
                this.isEnabled = false;
                this.selector = null;
                this.selectedVals = [];
                this.state = {}; //Remembers filter state. Upto the consumer how to use this obj.
            }

            // if given null as nodes, then select from datagraph
            // else select from nodes
            FilterConfig.prototype.filter = function (nodes) {
                var selNodes = nodes;
                if (!this.isEnabled) {
                    return selNodes;
                } else {
                    // previous filters application got us empty selection
                    if (nodes && nodes.length === 0) {
                        return [];
                    }

                    // if nodes is null, then select from dataGraph
                    if (!nodes) {
                        this.selector.selectfromDataGraph();
                    } else {
                        this.selector.selectFromNodes(nodes);
                    }

                    // selNodes = _.map(nodeIds, function(nodeId) { return nodeIdx[nodeId]; });
                    selNodes = this.selector.getNodes();
                }

                return selNodes;
            };

            /*************************************
            ********* Core Functions *************
            **************************************/
            function init() {
                this.filters = _.indexBy(_buildFilters(dataGraph.getNodeAttrs()), 'attrId');
                (function (service) {
                    $rootScope.$on(BROADCAST_MESSAGES.hss.subset.init, function (ev) {
                        if (layoutService.rebuildGeoLayout(service.getSelectedNodes())) {
                            var rg = dataGraph.getRenderableGraph();
                            rg.refreshForZoomLevel(0);
                        }
                        subsetService.subsetSelection(service.getSelectedNodes());
                        service.filters = _.indexBy(_buildFilters(dataGraph.getNodeAttrs()), 'attrId');
                        service.unselect();
                    });
                    $rootScope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (ev, data) {
                        if (data.subsetCount === 0) {
                            service.unselect();
                        }
                    });
                })(this);
            }

            /**
             * Select the nodes
             * @param {Object} selectData - The select descriptor
             * @param {Object} selectData.ids - The list of nodes by ids
             * @param {string} selectData.attr - The attribute
             * @param {string} selectData.value - the attribute value
             * @param {string} selectData.min - the attribute min value
             * @param {string} selectData.max - the attribute max value
             * @param {string} selectData.fivePct - fivePct
             * @param {array}  selectData.ids - nodeIds
             * @param {string} selectData.customValue - custom value
             * @param {boolean} selectData.filters - whether apply current filters
             * @param {boolean} selectData.force - whether replace value of current filter
             * @param {boolean} selectData.forceDisable - whether disable current filter
             * @param {string} selectData.searchText - exists when nodes were selected by the search
             * @param {Object} selectData.searchAttr - exists when nodes were selected by the search
             * @param {Object} selectData.scope - exists when nodes were selected by the search
             */
            function selectNodes(selectData) {
                _.map(this.getSelectedNodes(), function (n) {
                    n.isSelected = false;
                    return n;
                });

                this.singleNode = null;

                var currentSubset = subsetService.currentSubset();

                var cs = this._filter(selectData, subsetService.subsetNodes);
                this.selectedNodes = _.pluck(cs, 'id');

                if (currentSubset.length > 0) {
                    this.selectedNodes = this.selectedNodes.filter(function (x) {
                        return currentSubset.indexOf(x) > -1;
                    });

                    if (_.xor(this.selectedNodes, currentSubset).length == 0) {
                        this.selectedNodes = [];
                    }
                }

                if (selectData.ids) {
                    this.selectedNodes = _.uniq(this.selectedNodes.concat(selectData.ids));
                }

                if (selectData.searchText) {
                    return searchNodes(selectData, this);
                }

                const broadcastData = {
                    filtersCount: this.getActiveFilterCount(),
                    selectionCount: this.selectedNodes.length,
                    isSubsetted: currentSubset.length > 0,
                    nodes: this.getSelectedNodes(),
                    searchText: selectData.searchText,
                    geoText: selectData.geoText,
                    searchAttr: selectData.searchAttr,
                    attr: selectData.attr,
                    attrCustomValue: selectData.customValue,
                };
                
                const isEqualToPrev = this.prevBroadcastData &&
                    this.prevBroadcastData.filters === JSON.stringify(this.filters) &&
                    this.prevBroadcastData.selectionCount === broadcastData.selectionCount &&
                    this.prevBroadcastData.isSubsetted === broadcastData.isSubsetted &&
                    this.prevBroadcastData.searchText === broadcastData.searchText &&
                    this.prevBroadcastData.geoText === broadcastData.geoText &&
                    this.prevBroadcastData.searchAttr === broadcastData.searchAttr;

                if (!isEqualToPrev) {
                    this.prevBroadcastData = {
                        ...broadcastData,
                        filters: JSON.stringify(this.filters)
                    }
                    $rootScope.$broadcast(BROADCAST_MESSAGES.hss.select, broadcastData);
                }

                return Promise.resolve();
            }

            function appendToSelection(nodeIds) {
                var currentSubset = subsetService.currentSubset();
                var selectNodeIds = !currentSubset.length ? nodeIds : nodeIds.filter(x => currentSubset.indexOf(x) > -1);

                if (this.singleNode && this.selectedNodes.length == 0) this.selectedNodes = [this.singleNode.id];
                this.selectedNodes = _.unique([...this.selectedNodes, ...selectNodeIds]);

                if (this.selectedNodes.length == 1) {
                    this.singleNode = this.selectedNodes[0];
                } else {
                    this.singleNode = null;
                }

                var nodes = this.selectedNodes.map(findNodeWithId);

                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.select, {
                    filtersCount: this.getActiveFilterCount(),
                    selectionCount: this.selectedNodes.length,
                    isSubsetted: currentSubset.length > 0,
                    nodes: nodes,
                });
            }

            function searchNodes(selectData, service) {
                var dataRef = $rootScope.MAPP_EDITOR_OPEN
                    ? dataService.currDataSetUnsafe().id
                    : selectData.scope.player.dataset.ref;
                var filterAttrIds = selectData.searchAttr ? [selectData.searchAttr.id] : [];
                if (filterAttrIds.length === 0) {
                    var filterAttrVMs = _.reduce(dataGraph.getNodeAttrs(), function (acc, attr) {
                        // Filter hidden & numeric & not searchable attrs
                        if (!attr.isNumeric && attr.visibility.includes('search')) {
                            acc.push(_.assign(_.clone(attr), {
                                checked: false
                            }));
                        }
                        return acc;
                    }, []);
                    filterAttrIds = _.map(filterAttrVMs, 'id');
                }

                return searchService.searchNodes(selectData.searchText, dataRef, filterAttrIds, selectData.scope.player.player.settings.searchAlg).then(function (hits) {
                    var currentSubset = subsetService.currentSubset();
                    if (currentSubset && currentSubset.length) {
                        hits = _.filter(hits, function (hit) {
                            return _.includes(currentSubset, hit._source.id);
                        });
                    }

                    service.selectedNodes = _.union(service.selectedNodes || [], _.map(hits, function (h) {
                        return h._source.id;
                    }));

                    $rootScope.$broadcast(BROADCAST_MESSAGES.hss.select, {
                        filtersCount: service.getActiveFilterCount(),
                        selectionCount: service.selectedNodes.length,
                        isSubsetted: currentSubset.length > 0,
                        nodes: service.getSelectedNodes(),
                        searchText: selectData.searchText,
                        searchAttr: selectData.searchAttr
                    });
                })
            }

            function selectSingleNode(id, listPanelPrevent = false) {
                var node = findNodeWithId(id);
                this.singleNode = node;
                var currentSubset = subsetService.currentSubset();

                var nodes = [node];

                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.select, {
                    filtersCount: this.getActiveFilterCount(),
                    selectionCount: this.selectedNodes.length,
                    isSubsetted: currentSubset.length > 0,
                    nodes: nodes,
                    listPanelPrevent,
                });
            }

            function applyFilters(filters, searchText, searchAttr, scope) {
                this.unselect();
                this.filters = _.clone(filters);
                return this.selectNodes({ searchText: searchText, searchAttr: searchAttr, scope: scope });
            }

            function filter(data, subset) {
                if (data.attr) {
                    if (data.min || data.max) {
                        this.createMinMaxFilter(data.attr, data.min, data.max, data.force, data.forceDisable);
                    } else {
                        this.createMultipleFilter(data.attr, data.value, data.ids);
                        if (data.attr2) {
                            this.createMultipleFilter(data.attr2, data.value2);
                        }
                    }
                }

                return _.reduce(_.values(this.filters), function (acc, filterCfg) {
                    return filterCfg.filter(acc);
                }, subset.length > 0 ? subset : null);
            }

            function createMultipleFilter(attrId, vals, ids) {
                var filterConfig = this.getFilterForId(attrId);
                var newVal = _.isArray(vals) ? vals : [vals];
                var filterVal;

                const isGeoFilter = Object.keys(GEO_FILTERS).includes(attrId);

                if (!isGeoFilter) {
                    if (attrId === 'geo_count') {
                        // do nothing
                    } else if (filterConfig.state.selectedVals && filterConfig.state.selectedVals.indexOf(vals) > -1) {
                        filterVal = _.filter(_.filter(filterConfig.state.selectedVals, v => newVal.indexOf(v) == -1), _.identity);
                    } else {
                        filterVal = _.filter(_.flatten([filterConfig.state.selectedVals, _.clone(newVal)]), _.identity);
                    }
                } else {
                    if (filterConfig.state.selectedVals && filterConfig.state.selectedVals.some(x => x.id == vals.id)) {
                        filterVal = _.filter(_.filter(filterConfig.state.selectedVals, v => v.id != vals.id), _.identity);
                    } else {
                        filterVal = _.filter(_.flatten([filterConfig.state.selectedVals, _.clone(newVal)]), _.identity);
                    }
                }

                filterConfig.state.selectedVals = filterVal;
                if (isGeoFilter) {
                    filterConfig.selector = SelectorService.newSelector().ofGeo(attrId, filterVal);
                } else if (attrId === 'geo_count') {
                    filterConfig.selector = SelectorService.newSelector().ofMultipleNodes(ids);
                } else {
                    filterConfig.selector = SelectorService.newSelector().ofMultipleAttrValues(attrId, filterVal, true);
                }
                filterConfig.isEnabled = attrId === 'geo_count' ? true : filterVal && filterVal.length > 0;

                return filterConfig;
            }

            function createMinMaxFilter(attrId, min, max, force, forceDisable) {
                var filterConfig = this.getFilterForId(attrId);

                if (min == filterConfig.min && max == filterConfig.max) {
                    filterConfig.selector = null;
                    filterConfig.isEnabled = false;
                    return filterConfig;
                }


                if (force || !filterConfig.isEnabled) {
                    filterConfig.selector = SelectorService.newSelector().ofMultiAttrRange(attrId, [{ min, max }]);
                } else {
                    var item = _.find(filterConfig.selector.attrRanges, function (r) { return r.min == min && r.max == max });

                    if (item) {
                        filterConfig.selector.attrRanges = _.filter(filterConfig.selector.attrRanges, function (r) {
                            return r.min != min || r.max != max;
                        });
                    } else {
                        filterConfig.selector.attrRanges.push({ min, max });
                    }
                }

                filterConfig.isEnabled = !forceDisable && filterConfig.selector.attrRanges.length > 0;

                return filterConfig;
            }

            function unselect() {
                var currentSubset = subsetService.currentSubset();
                const hasSingleNodeSelection = Boolean(this.singleNode);

                if (hasSingleNodeSelection) {
                    this.singleNode = null;
                }

                this.attrs = null;

                for (var f of _.values(this.filters)) {
                    if (f.isEnabled) {
                        f.isEnabled = false;
                        f.selector = null;
                        f.state = {};
                    }
                }

                _.map(this.getSelectedNodes(), function (n) {
                    n.isSelected = false;
                    return n;
                });

                this.selectedNodes = [];

                const broadcastData = {
                    filtersCount: this.getActiveFilterCount(),
                    selectionCount: this.selectedNodes.length,
                    isSubsetted: currentSubset.length > 0,
                    nodes: this.getSelectedNodes(),
                    isUnselect: true
                };

                const isEqualToPrev = this.prevBroadcastData &&
                    this.prevBroadcastData.filters === JSON.stringify(this.filters) &&
                    this.prevBroadcastData.selectionCount === broadcastData.selectionCount &&
                    this.prevBroadcastData.isSubsetted === broadcastData.isSubsetted &&
                    this.prevBroadcastData.isUnselect === broadcastData.isUnselect;

                if (!isEqualToPrev || hasSingleNodeSelection) {
                    this.prevBroadcastData = {
                        ...broadcastData,
                        filters: JSON.stringify(this.filters)
                    }
                    $rootScope.$broadcast(BROADCAST_MESSAGES.hss.select, broadcastData);
                }

                if (!currentSubset.length && !this.selectedNodes.length) {
                    renderGraphfactory.getRenderer().render();
                }
            }

            function hasFilter(id) {
                return this.filters && this.filters[id] && this.filters[id].isEnabled;
            }

            function getFilterForId(id) {
                return this.filters && this.filters[id];
            };

            function getSelectedNodes() {
                return _.map(this.selectedNodes, findNodeWithId).filter(el => el);
            }

            function hasAttrId(attrId, value) {
                if (this.filters && this.filters[attrId] && this.filters[attrId].isEnabled)
                    return this.filters[attrId].state.selectedVals.indexOf(value) > -1;

                return false;
            }

            //
            // Bind to the render graph and the define the above functions
            //
            function sigBinds(sig) {
                console.log('Binding handlers');
                // The function to find out which node to select for the given id. If the node is under a cluster,
                // then select the cluster

                findNodeWithId = function findNodeWithId(nodeId) {
                    var node = sig.graph.nodes(nodeId);
                    if (!node) {
                        // possibly aggregated, return the node Aggregation
                        node = sig.graph.getParentAggrNode(nodeId);

                        if (!node) {
                            console.warn('Node with Id: %s does not exist in the graph', nodeId);
                        }
                    }

                    if (node && node[renderGraphfactory.getRendererPrefix() + 'size'] === null) { // no render data
                        console.warn('Node hasn\'t been rendered: %O', node);
                    }

                    return node;
                };
            }

            function _buildFilters(attrs) {
                const res = _.map(attrs, function (attr) { return new FilterConfig(attr.id, null, attr.bounds); });

                return [
                    ...res,
                    ...Object.entries(GEO_FILTERS).map(([k, v]) => {
                        return new FilterConfig(k, v)
                    }),
                    new FilterConfig('geo_count', 'Points per ' + GEO_REGION_TITLES[$rootScope.geo.level])
                ]
            }
        }
    ]);
