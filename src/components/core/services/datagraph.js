/*jshint unused:false, loopfunc:true */
/**
 * This service actually contains 2 services. One for the rawData and another for the rendergraph.
 * RawData contains data for the current network and operation on them
 * Rendergraph contains color values and adjusted size values. I.e. Rendergraph is the graph generrate after a layout is applied to the rawData
 */
angular.module('common')
    .factory('dataGraph', ['$timeout', '$q', '$rootScope', 'aggregatorService', 'dataService', 'networkService', 'AttrInfoService', 'orgFactory', 'BROADCAST_MESSAGES',
        function ($timeout, $q, $rootScope, aggregatorService, dataService, networkService, AttrInfoService, orgFactory, BROADCAST_MESSAGES) {
            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            var API = {
                clear: clear,
                clearRenderGraph: clearRenderGraph,
                //
                // RenderableGraph API
                //
                getRenderableGraph: function getRenderableGraph() { return _currRenderableGraph; },
                buildRenderableGraph: buildRenderableGraph,
                //
                // Raw Data API
                //
                //Loads rawData
                mergeAndLoadNetwork: mergeAndLoadNetwork,
                getRawData: function getRawData() {
                    if (_rawData) {
                        return $q.when(_rawData);
                    } else {
                        return _rawDataDefer.promise;
                    }
                },
                // Unsafe if the data does not exist??
                getRawDataUnsafe: function getRawDataUnsafe() { return _rawData; },
                getAllNodes: function getAllNodes() { return _rawData.nodes; },
                getNodeById: function getNodeById(nid) { return _rawData.nodeIndex[nid]; },
                getAllEdges: function getAllEdges() { return _rawData.edges; },
                getData: function getData() { return _rawData; },

                getNodeEdges: getNodeEdges,
                getEdgesByNodes: getEdgesByNodes,

                // fivePct is a boolean to return numeric values in 5% range or quartiles
                getNodesByAttrib: getNodesByAttrib,
                getNodesByAttributes: getNodesByAttributes,
                getNodesByAttribRange: getNodesByAttribRange,
                getEdgesByAttrib: getEdgesByAttrib,

                //
                // Attr functions
                //
                getNodeAttrTitle: function getNodeAttrTitle(attrId) { return _rawData.nodeAttrIndex[attrId].title; },
                getNodeAttrTypes: function getNodeAttrTypes() {
                    return ['color', 'liststring', 'string', 'integer', 'float', 'boolean', 'year', 'timestamp', 'picture', 'profile', 'video', 'media_link', 'audio_stream', 'video_stream', 'html', 'url', 'twitter', 'instagram', 'json'];
                },

                getNodeAttrs: function getNodeAttrs() { return _rawData.nodeAttrs; },

                getNodeAttrsTitleKeys: function getNodeAttrsTitleKeys() { return _rawData.nodeAttrIndex; },

                getEdgeAttrTypes: function getEdgeAttrTypes() {
                    return ['color', 'liststring', 'string', 'integer', 'float', 'boolean', 'timestamp', 'picture', 'profile', 'video', 'media_link', 'audio_stream', 'video_stream', 'html', 'url', 'twitter', 'instagram', 'json'];
                },
                getEdgeAttrs: function getEdgeAttrs() { return _rawData.edgeAttrs; },
                getEdgeInfoAttrs: function getEdgeInfoAttrs() {
                    var idsToIgnore = ['OriginalColor', 'OriginalSize', 'OriginalLabel', 'linkingAttributes', 'id', 'isDirectional'];
                    return _rawData.edgeAttrs.filter(function (attr) {
                        if (_.contains(idsToIgnore, attr.id) || !attr.visible) { return false; }
                        return _.contains(['string', 'integer', 'float'], attr.attrType);
                    });
                },

                getEdgeAttrsTitleKeys: function getEdgeAttrsTitleKeys() { return _rawData.edgeAttrIndex; },

                updateNodeAttrsBase: updateNodeAttrsBase,
                removeNodeAttrs: removeNodeAttrs,
                updateEdgeAttrsBase: updateEdgeAttrsBase,
                removeEdgeAttrs: removeEdgeAttrs,
                updateNodeAttrsOrder: updateNodeAttrsOrder,
                updateEdgeAttrsOrder: updateEdgeAttrsOrder,
                getNodesForCluster: getNodesForCluster,
                getNodesForPartition: getNodesForPartition,
                partitionNodesByAttr: partitionNodesByAttr,

                isNodeAttr: function isNodeAttr(attribName) { return _rawData.isNodeAttr(attribName); },
                hasGeoData: function hasGeoData() {
                    if (_rawData) {
                        return _rawData.hasGeoData;
                    } else {
                        return false;
                    }
                },
                isEdgeAttr: function isEdgeAttr(attribName) { return _rawData.isEdgeAttr(attribName); },
                getNodeAttrTitlesForIds: getNodeAttrTitlesForIds,
                changeNodeCatNames: changeNodeCatNames
            };

            /*************************************
    ********* CLASSES ********************
    **************************************/
            // RAW DATA Classs
            //
            function RawData(nodes, edges, nodeAttrs, edgeAttrs) {
                this.id = _.uniqueId('raw-data');
                this.nodes = nodes;
                this.edges = edges;
                this.nodeAttrs = nodeAttrs;
                this.edgeAttrs = edgeAttrs;
                this.nodeAttrIndex = _.indexBy(nodeAttrs, 'id');
                this.edgeAttrIndex = _.indexBy(edgeAttrs, 'id');
                this.nodeAttrTitleIndex = _.indexBy(nodeAttrs, 'title');
                // this.nodeAttrsInfo = {}; // an object which contains information (bounds, values) for each node Attr
                // this.edgeAttrsInfo = {};
                this.nodeIndex = _.indexBy(nodes, "id");
                this.dataPointIdNodeIdMap = _.reduce(nodes, function (acc, node) { acc[node.dataPointId] = node.id; return acc; }, {});
                this.edgeIndex = {};
                // edgeOutIndex[src]=> all edges outgoing from src
                this.edgeOutIndex = {};
                // edgeInIndex[target] => all edges incoming to target
                this.edgeInIndex = {};
                _.each(edges, function (e) {
                    this.edgeIndex[e.id] = e;

                    this.edgeOutIndex[e.source] = this.edgeOutIndex[e.source] || {};
                    this.edgeOutIndex[e.source][e.target] = e;

                    this.edgeInIndex[e.target] = this.edgeInIndex[e.target] || {};
                    this.edgeInIndex[e.target][e.source] = e;
                }, this);

                // Node attrs and their value / bounds map
                // buildAttrInfoMap(nodeAttrs, nodes, this.nodeAttrsInfo);
                // console.log('Node Attribute Info Map: %O', this.nodeAttrsInfo);

                // Edge attrs and their value / bounds map
                // buildAttrInfoMap(edgeAttrs, edges, this.edgeAttrsInfo);
                // console.log('Edge Attribute Info Map: %O', this.edgeAttrsInfo);

                /// unify attr Descriptors and attr Info
                this.nodeAttrsBase = this.nodeAttrs;
                this.edgeAttrsBase = this.edgeAttrs;
                // order aware list
                // this.nodeAttrs = _.map(this.nodeAttrsBase, function(attr) { return self.nodeAttrsInfo[attr.title]; });
                // this.edgeAttrs = _.map(this.edgeAttrsBase, function(attr) { return self.edgeAttrsInfo[attr.title]; });

                this.hasGeoData = this.isNodeAttr('Latitude') && this.isNodeAttr('Longitude');
                // If it has geo data, then find it's bounds
                if (this.hasGeoData) {
                    this.bounds = _.map(this.nodes, function calcGeoBounds(n) {
                        var lat = n.attr.Latitude ? parseFloat(n.attr.Latitude) : 0;
                        var lng = n.attr.Longitude ? parseFloat(n.attr.Longitude) : 0;
                        return window.L.latLng(lat, lng);
                    });
                    this.bounds = window.L.latLngBounds(this.bounds);
                } else {
                    this.bounds = null;
                }

            }
            RawData.prototype.updateBounds = function (x, y) {
                this.bounds = _.map(this.nodes, function calcGeoBounds(n) {
                    var lat = n.attr[x] ? parseFloat(n.attr[x]) : 0;
                    var lng = n.attr[y] ? parseFloat(n.attr[y]) : 0;
                    return window.L.latLng(lat, lng);
                });
                this.bounds = window.L.latLngBounds(this.bounds);
            };
            RawData.prototype.isEmpty = function () {
                return this.nodes.length === 0;
            };
            RawData.prototype.isNodeAttr = function (attribName) {
                return this.nodeAttrIndex[attribName] != null;
            };
            RawData.prototype.getAttrInfo = function (attribName) {
                return this.nodeAttrIndex[attribName];
            };
            RawData.prototype.getAttrInfoByTitle = function () {
                throw new Error("Stupid function. do not use");
                // return this.nodeAttrTitleIndex[attribTitle];
            };
            RawData.prototype.getNodeAttrs = function () {
                return this.nodeAttrs;
            };
            RawData.prototype.getNodeAttrsBase = function () {
                return this.nodeAttrsBase;
            };
            RawData.prototype.isEdgesEmpty = function () {
                return this.edges.length === 0;
            };
            RawData.prototype.isEdgeAttr = function (attribName) {
                return this.edgeAttrIndex[attribName] != null;
            };
            RawData.prototype.getEdgeAttrInfo = function (attribName) {
                return this.edgeAttrIndex[attribName];
            };
            RawData.prototype.getEdgeAttrs = function () {
                return this.edgeAttrs;
            };
            RawData.prototype.getEdgeAttrsBase = function () {
                return this.edgeAttrsBase;
            };

            RawData.prototype.hasEdge = function (sourceId, targetId) {
                var res = this.edgeOutIndex[sourceId] ? !!this.edgeOutIndex[sourceId][targetId] : false;
                //console.log('hasEdge %s, %s: %s',sourceId, targetId, res);

                return res;
            };
            RawData.prototype.getAllNeighbours = function (nodeId) {
                var incoming = this.edgeInIndex[nodeId];
                var outgoing = this.edgeOutIndex[nodeId];
                var nodes = [];
                _.each(incoming, function (val, key) { nodes.push(this.nodeIndex[key]); }, this);
                _.each(outgoing, function (val, key) { nodes.push(this.nodeIndex[key]); }, this);
                return nodes;
            };
            RawData.prototype.hasNode = function (nodeId) {
                return !!this.nodeIndex[nodeId];
            };

            // SigmaRenderable Classs
            //
            function SigmaRenderableGraph(rawData, layout, zoomLevel) {
                this.layout = layout;
                this.isGeo = !!layout.isGeo;
                this.rawData = rawData;
                // this.disableAggregation = layout.setting('disableAggregation');
                this.disableAggregation = true;
                this.zoomingRatio = layout.setting('zoomingRatio');
                this.zoomLevel = zoomLevel;
                this.aggregationWidth = layout.setting("aggregationWidth");
                this.aggregationHeight = layout.setting("aggregationHeight");
                if (rawData.nodes.length === 0) {
                    console.warn("Rendergraph requested for empty data!");
                    this.graph = {
                        nodes: [],
                        edges: []
                    };
                }
                this.refreshForZoomLevel(0);
            }

            SigmaRenderableGraph.prototype.updateZoomLevel = function (zoomLevel) {
                this.zoomLevel = zoomLevel;
                if (!this.isGeo) {
                    this.ratio = this.baseRatio * Math.pow(this.zoomingRatio, this.zoomLevel);
                } else {
                    this.ratio = 1;
                }
            };

            // helpful for aggregate nodes, otherwise does nothing
            SigmaRenderableGraph.prototype.refreshForZoomLevel = function (delta) {
                var self = this, rawData = this.rawData, layout = this.layout;
                this.zoomLevel += delta;
                var zoomLevel = this.zoomLevel;
                var bigOnTop = layout.setting('bigOnTop');

                console.group('dataGraph: Building RenderGraph. zoomLevel :', zoomLevel);

                // Filtering bad nodes
                var nodeDataIndex = rawData.nodeIndex; //_.indexBy(rawData.nodes, "id");

                var data = {
                    nodes: _.filter(rawData.nodes, layout.isNodeValid, layout),
                    edges: _.filter(rawData.edges, function (edge) {
                        return layout.isNodeValid(nodeDataIndex[edge.source]) &&
                            layout.isNodeValid(nodeDataIndex[edge.target]) &&
                            layout.isEdgeValid(edge);
                    })
                };
                console.log('Number of Filtered Edges: %i', rawData.edges.length - data.edges.length);
                console.log('Number of Filtered Nodes: %i', rawData.nodes.length - data.nodes.length);

                var nodes = [];
                var edges = []; //optional!
                var idx = 0;

                if (data.nodes.length === 0) {
                    throw new Error("ALl the nodes got filtered out! Nothing left to render!");
                    // this.graph = {nodes : nodes, edges : edges};
                    // this.graph.nodeIndex = {};
                    // return;
                }

                //Copy the nodes, we don't want to corrupt the original data.
                _.each(data.nodes, function (node) {
                    var n = _.clone(node);
                    layout.nodeT(n);
                    console.assert(isFinite(n.x) && !isNaN(n.x), 'node x is invalid. ' + n.x + '. Bad layout?');
                    console.assert(isFinite(n.y) && !isNaN(n.y), 'node y is invalid. ' + n.y + '. Bad layout?');
                    console.assert(isFinite(n.size) && !isNaN(n.size), 'node size is invalid. ' + n.size + '. Bad layout?');
                    nodes.push(n);
                });
                const clusterAttr = layout.mapprSettings.nodeClusterAttr;
                const clusters = _.reduce(nodes, function(acc, cv) {
                    const val = cv.attr[clusterAttr];
                    if(!acc[val]) {
                        acc[val] = [];
                    }
                    acc[val].push(cv.color);
                    return acc;
                }, {});
                // calculate the most frequent color
                Object.keys(clusters).forEach(function(key) {
                    const colors = clusters[key];
                    const colorStrs = colors.map(r => ({
                        color: r,
                        colorStr: window.mappr.utils.colorStr(r)
                    }));

                    const colorStats = _.reduce(colorStrs, function(acc, cv) {
                        if (!acc[cv.colorStr]) {
                            acc[cv.colorStr] = {
                                count: 1,
                                color: cv.color
                            }
                        } else {
                            acc[cv.colorStr].count++;
                        }

                        return acc;
                    }, {});
                    
                    const sorted = _.sortBy(colorStats, 'count');

                    clusters[key] = sorted[sorted.length - 1].color;
                });

                _.each(nodes, function(node) {
                    const val = node.attr[clusterAttr];
                    node.clusterColor = clusters[val];
                    node.clusterColorStr = window.mappr.utils.colorStr(node.clusterColor);
                });
                // sort to establish drawing order
                nodes.sort(bigOnTop ? function (n1, n2) { return n1.size - n2.size; } :
                    function (n1, n2) { return n2.size - n1.size; });
                // add index to track drawing order
                _.each(nodes, function (node) {
                    node.idx = idx++;
                });
                // build index for looking up nodes by id
                var nodeIndex = _.indexBy(nodes, "id");

                // ranks edges by their importance
                // edge is important if it is long or if source or target node
                var importance = function (e) {
                    var n1 = nodeIndex[e.source];
                    var n2 = nodeIndex[e.target];
                    var dx = n2.x - n1.x, dy = n2.y - n1.y;
                    var len = (dx * dx + dy * dy);
                    var degree = (n1.attr.degree !== undefined && n2.attr.degree !== undefined) ? Math.min(n1.attr.degree, n2.attr.degree) : 1;
                    return len / degree;
                };
                // copy and assign importance to the edges
                _.each(data.edges, function (edge) {
                    var e = _.clone(edge);
                    layout.edgeT(e);
                    e.importance = importance(e);
                    edges.push(e);
                });
                edges.sort(function (e1, e2) { return e2.importance - e1.importance; });

                var nodeBounds = this.nodeBounds = getBounds(nodes);

                //Graph bounds. The center of which is used to scale nodes
                var minx = nodeBounds.minx.x || 0,
                    miny = nodeBounds.miny.y || 0,
                    maxx = nodeBounds.maxx.x || 0,
                    maxy = nodeBounds.maxy.y || 0,
                    centerx = (minx + maxx) / 2,
                    centery = (miny + maxy) / 2;

                var bounds = {
                    minx: minx,
                    miny: miny,
                    maxx: maxx,
                    maxy: maxy,
                    center: {
                        x: centerx,
                        y: centery
                    }
                };

                //
                // Normalized the Graph to fit the viewport at zoomLevel of 0
                //
                // calculate the scaling ratio to fill the viewport
                function calcBaseScalingRatio(bounds) {
                    var marginX = 120;  // duplicates values in layoutService to avoid circular dependency
                    var marginY = 120;
                    var isScatterplot = layout.plotType === 'scatterplot';
                    var extraMarginX = isScatterplot ? 100 : 0;
                    var extraMarginY = isScatterplot ? 200 : 0;
                    return Math.max(
                        (Math.abs(bounds.minx - bounds.maxx)) / (window.innerWidth - (marginX + extraMarginX)),
                        (Math.abs(bounds.miny - bounds.maxy)) / (window.innerHeight - (marginY + extraMarginY))
                    );
                }

                if (!this.isGeo) {
                    var baseRatio = this.baseRatio = calcBaseScalingRatio(bounds);
                    this.ratio = this.baseRatio * Math.pow(this.zoomingRatio, this.zoomLevel); // ratio used for this graph

                    //var sizeRatio = Math.pow(this.baseRatio, 0.2);
                    // center the nodes and rescale based on scaling to fit
                    _.each(nodes, function (n) {
                        n.x = (n.x - centerx) / baseRatio;
                        n.y = (n.y - centery) / baseRatio;
                    });
                    // _.each(edges, function(e) {
                    //     e.size = e.size / sizeRatio;
                    // });
                    if (layout.shouldNormalizeCamera) {
                        layout.normalizeCamera(self.baseRatio);
                        layout.shouldNormalizeCamera = false;
                    }

                } else {
                    this.baseRatio = 1;
                    this.ratio = 1;
                }

                if (!this.disableAggregation) {
                    console.log('Aggregation for ratio: ' + self.ratio);
                    var aggregator = new aggregatorService.AggregatorDef({
                        quadX: Math.abs((bounds.maxx - bounds.minx) / self.aggregationWidth) * self.ratio,
                        quadY: Math.abs((bounds.maxy - bounds.miny) / self.aggregationHeight) * self.ratio,
                        layout: layout
                    });
                    this.graph = aggregator.aggregate(nodes, edges, '');
                    this.graph.nodeIndex = _.indexBy(this.graph.nodes, "id");

                } else {
                    this.graph = { nodes: nodes, edges: edges };
                    this.graph.nodeIndex = nodeIndex;
                }
                // get the bounds of the nodes
                //this.nodeBounds = getBounds(this.graph.nodes);
                console.log("Finished generation renderGraph");
                console.groupEnd();
            };
            SigmaRenderableGraph.prototype.refreshForGeoLevelChange = function () {
                var nodes = this.graph.nodes,
                    edges = this.graph.edges,
                    layout = this.layout,
                    self = this;
                _.each(nodes, function (node) {
                    var n = node;
                    layout.nodeT(n);

                    console.assert(isFinite(n.x) && !isNaN(n.x), 'node x is invalid. Bad layout?');
                    console.assert(isFinite(n.y) && !isNaN(n.y), 'node size is invalid. Bad layout?');
                    console.assert(isFinite(n.size) && !isNaN(n.size), 'node size is invalid. Bad layout?');
                });

                _.each(edges, function (edge) {
                    var e = edge;
                    layout.edgeT(e);
                });

                //Graph bounds. The center of which is used to scale nodes
                var nodeBounds = this.nodeBounds = getBounds(nodes);

                var minx = nodeBounds.minx.x || 0,
                    miny = nodeBounds.miny.y || 0,
                    maxx = nodeBounds.maxx.x || 0,
                    maxy = nodeBounds.maxy.y || 0,
                    centerx = (minx + maxx) / 2,
                    centery = (miny + maxy) / 2;

                var bounds = {
                    minx: minx,
                    miny: miny,
                    maxx: maxx,
                    maxy: maxy,
                    center: {
                        x: centerx,
                        y: centery
                    }
                };

                this.ratio = 1;

                if (!this.disableAggregation) {
                    console.log('Aggregation for ratio: ' + self.ratio);
                    var aggregator = new aggregatorService.AggregatorDef({
                        quadX: Math.abs((bounds.maxx - bounds.minx) / self.aggregationWidth) * self.ratio,
                        quadY: Math.abs((bounds.maxy - bounds.miny) / self.aggregationHeight) * self.ratio,
                        layout: layout
                    });
                    this.graph = aggregator.aggregate(nodes, edges, '');
                }
            };
            SigmaRenderableGraph.prototype.getNodeById = function (id) {
                return this.graph.nodeIndex[id];
            };
            SigmaRenderableGraph.prototype.getNodeTitle = function (id) {
                var node = this.graph.nodeIndex[id],
                    labelAttr = this.layout.setting('labelAttr');
                if (node) {
                    return node.attr[labelAttr] || node.attr['OriginalLabel'];
                } else {
                    return '';
                }
            };


            /*************************************
    ********* Local Data *****************
    **************************************/
            var _currRenderableGraph = null;
            var _currRenderableGraphDefer = $q.defer();

            var _rawData = null;
            var _rawDataDefer = $q.defer();


            /*************************************
    ********* Core Functions *************
    **************************************/
            /**
     * Merges dataset info into the network so that rawData contains all the info needed
     * @param  {[type]} network [description]
     * @return {[type]}         [description]
     */
            function mergeAndLoadNetwork(network) {
                var nwData = network;
                const tileData = {
                    0: 'countries',
                    1: 'fed_districts',
                    2: 'adm_districts'
                };
                var mergedNodeAttrDescriptors = [];
                var dataset = dataService.currDataSetUnsafe();
                // merge network node data and dataset datapoint data for now
                var dpIndex = _.indexBy(dataset.datapoints, 'id');
                // copy over Datapoint attrs into network node
                _.each(nwData.nodes, function (node) {
                    var dp = dpIndex[node.dataPointId];
                    //_.extend(node.attr, dp.attr); // _.defaults instead of _.extend so that dataset does not overwrite network prop
                    _.defaults(node.attr, dp.attr);
                    if ('geodata' in dp) {
                        node.geodata = dp.geodata.reduce((acc, cv) => {
                            acc[tileData[cv.level]] = cv.polygon_id;
                            return acc;
                        }, {});
                    }
                });
                // update attr descriptions too
                var nwNodeAttrDescIndex = _.indexBy(nwData.nodeAttrDescriptors, 'title');
                _.each(dataset.attrDescriptors, function (attrDesc) {
                    // attrDesc.fromDataset = true;
                    var existingAttr = nwNodeAttrDescIndex[attrDesc.title];
                    if (existingAttr) {
                        _.extend(existingAttr, attrDesc);
                    } else {
                        var dsAttrCopy = _.clone(attrDesc);
                        dsAttrCopy.fromDataset = true;
                        mergedNodeAttrDescriptors.push(dsAttrCopy);
                    }
                });

                // push network attrs to merged attrs
                mergedNodeAttrDescriptors = mergedNodeAttrDescriptors.concat(nwData.nodeAttrDescriptors);
                loadRawData(nwData.nodes, nwData.links, mergedNodeAttrDescriptors, nwData.linkAttrDescriptors);
                _rawData.networkId = network.id;
                return _rawData;
            }

            //
            //  Setters
            //
            function loadRawData(nodes, links, nodeAttrs, linksAttrs) {
                _rawData = new RawData(nodes, links, nodeAttrs, linksAttrs);
                _rawDataDefer.resolve(_rawData);
            }
            function setRenderableGraph(graph) {
                _currRenderableGraph = graph;
                _currRenderableGraphDefer.resolve(graph);
            }

            function clear() {
                console.log('[dataGraph] clearing graph');
                // if previously loaded data exists, then clear it.
                if (_rawData) {
                    _rawData = null;
                    _rawDataDefer.reject('graph cleared');
                    _rawDataDefer = $q.defer();
                }
                API.clearRenderGraph();
            }

            function clearRenderGraph() {
                if (_currRenderableGraph) {
                    _currRenderableGraph = null;
                    _currRenderableGraphDefer.reject('graph cleared');
                    _currRenderableGraphDefer = $q.defer();
                    // $rootScope.$broadcast(BROADCAST_MESSAGES.renderGraph.removed);
                }
            }

            function buildRenderableGraph(data, layout, zoomLevel) {
                var _zoomLevel = zoomLevel != null ? zoomLevel : 0;
                var g = new SigmaRenderableGraph(data, layout, _zoomLevel);
                setRenderableGraph(g);
                return g;
            }

            function getNodeEdges(node) {
                var nEdges = [], nEdge;
                for (var i = _rawData.edges.length - 1; i >= 0; i--) {
                    if (_rawData.edges[i].source == node.id) {
                        nEdge = _.clone(_rawData.edges[i]);
                        nEdge.outgoing = true;
                        nEdges.push(nEdge);
                    }
                    else if (_rawData.edges[i].target == node.id) {
                        nEdge = _.clone(_rawData.edges[i]);
                        nEdge.incoming = true;
                        nEdges.push(nEdge);
                    }
                }
                return nEdges;
            }

            function getNodesByAttrib(attr, value, fivePct) {

                if (attr == undefined) {
                    console.log('getNodesByAttrib ----------------------');
                    return [];
                }
                console.log('Getting nodes by value: %s for attr: %s', value, attr);
                var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attr);
                var nodes = API.getAllNodes();
                if (!attrInfo) {
                    console.warn('Unable to find attrInfo for Attribute:' + attr);
                    return [];
                }
                var selectedNodeIds = [];
                if (attrInfo.isNumeric) {
                    var valLow, valHigh, nBins = fivePct ? 20 : 5;
                    value = parseFloat(value);
                    if (attrInfo.valuesCount[value] == undefined) {
                        value = attrInfo.values[Math.min(_.sortedIndex(attrInfo.values, value), attrInfo.values.length - 1)];
                    }
                    var rank = attrInfo.valuesCount[value].rank;
                    var count = attrInfo.values.length, binSize = count / nBins;
                    if (rank.max - rank.min + 1 >= binSize) {  // lots of nodes with this value
                        valLow = valHigh = value;
                    } else {    // few nodes with value, show bin including this value
                        valLow = attrInfo.values[Math.floor(binSize * Math.floor(rank.min / binSize))];
                        if (rank.min === 0 && rank.max === 0) {
                            valHigh = attrInfo.values[Math.ceil(binSize) - 1];
                        }
                        else {
                            valHigh = attrInfo.values[Math.ceil(binSize * Math.ceil(rank.max / binSize)) - 1];
                        }
                    }
                    // find all nodes with the value within the bracket (val >= low && val <= high)
                    selectedNodeIds = _.reduce(nodes, function (chosenOnes, node) {
                        if (node.attr[attr] != null && node.attr[attr] >= valLow && node.attr[attr] <= valHigh) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    }, []);
                } else if (attrInfo.isTag) {    // find nodes with tag in attribute value array
                    // combined multi tag string
                    var tags = [];
                    var onlyTagMode = false; // find node which only have these tags
                    if (value.indexOf('|') > 0) {
                        tags = value.split('|');
                        onlyTagMode = true;
                    } else {
                        tags = [value];
                    }
                    selectedNodeIds = _.reduce(nodes, function (chosenOnes, node) {
                        var nodeTags = node.attr[attr];
                        if (!nodeTags || nodeTags.length === 0) {
                            return chosenOnes;
                        }
                        var notFoundFlag = false;
                        // search for each tag on the node
                        for (var i = 0; i < tags.length; i++) {
                            if (nodeTags.indexOf(tags[i]) === -1) {
                                notFoundFlag = true;
                                break;
                            }
                        }
                        // if all tags are there on this node, then choose it
                        if (!notFoundFlag) {
                            if (onlyTagMode) {
                                if (tags.length === nodeTags.length) { chosenOnes.push(node.id); }
                            } else {
                                chosenOnes.push(node.id);
                            }
                        }
                        return chosenOnes;
                    }, []);
                } else {
                    // find all nodes with the (categorical) value
                    selectedNodeIds = _.reduce(nodes, function (chosenOnes, node) {
                        if (node.attr[attr] === value) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    }, []);
                }
                //
                // From these nodes, remove ones which are invalid
                var rg = API.getRenderableGraph();
                return _.filter(selectedNodeIds, function (nodeId) { return rg.getNodeById(nodeId); });
            }

            function getNodesByAttributes(attr, values, fivePct) {
                var allNodes = [];
                values.forEach(function (value) {
                    var nodes = value != null ? getNodesByAttrib(attr, value, fivePct) : [];
                    allNodes = allNodes.concat(nodes);
                });
                return allNodes;
            }

            function getNodesByAttribRange(attr, min, max) {
                if (attr == undefined) {
                    console.log('getNodesByAttrib ----------------------');
                    return [];
                }
                console.log('Getting nodes in range: %s, %s for attr: %s', min, max, attr);
                var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attr);
                var nodes = API.getAllNodes();
                if (!attrInfo) {
                    console.warn('Unable to find attrInfo for Attribute:' + attr);
                    return [];
                }
                var selectedNodeIds = [];
                if (attrInfo.isNumeric) {
                    // find all nodes with the value within the bracket (val >= low && val <= high)
                    selectedNodeIds = _.reduce(nodes, function (chosenOnes, node) {
                        if (node.attr[attr] != null && node.attr[attr] >= min && node.attr[attr] <= max) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    }, []);
                }
                var rg = API.getRenderableGraph();
                return _.filter(selectedNodeIds, function (nodeId) { return rg.getNodeById(nodeId); });
            }

            function getEdgesByNodes(nodes) {
                var edges = API.getAllEdges();
                var filteredEdges = _.filter(edges, function(edge) {
                    var source = edge.source;
                    var target = edge.target;

                    return nodes.some(x => x.id == source || x.id == target);
                });

                return filteredEdges;
            }

            function getEdgesByAttrib(attr, value) {
                var attrInfo = AttrInfoService.getLinkAttrInfoForRG().getForId(attr);
                var edges = API.getAllEdges();
                if (!attrInfo) {
                    console.warn('Unable to find attrInfo for Edge Attribute:' + attr);
                    return;
                }
                var selectedEdges = [];
                if (attrInfo.isNumeric) {
                    value = parseFloat(value);
                    //find the array of values for quantiles [max,75%,50%,25%,min]
                    var vals = _.values(attrInfo.bounds);
                    //find the bracket(high low) in which the edge val is bound
                    var highValIndex, lowValIndex; //high-low describes the local bound [indices] within which the edge value exists
                    for (lowValIndex = vals.length - 1; lowValIndex > 0; lowValIndex--) {
                        highValIndex = lowValIndex - 1;
                        //console.debug('low',vals[lowValIndex]);
                        //console.debug('high',vals[highValIndex]);
                        if (vals[highValIndex] >= value) break;
                    }

                    // find all edges with the value within the bracket (val > low && val <= high)
                    selectedEdges = _.reduce(edges, function (chosenOnes, edge) {
                        if (edge.attr[attr] != null && edge.attr[attr] > vals[lowValIndex] && edge.attr[attr] <= vals[highValIndex]) {
                            chosenOnes.push(edge);
                        }
                        return chosenOnes;
                    }, []);
                } else {
                    // find all edges with the value
                    selectedEdges = _.reduce(edges, function (chosenOnes, edge) {
                        if (edge.attr[attr] === value) {
                            chosenOnes.push(edge);
                        }
                        return chosenOnes;
                    }, []);
                }
                return selectedEdges;
            }

            function updateNodeAttrsBase(attrs) {
                var attrInfo = AttrInfoService.getNodeAttrInfoForRG();

                _.each(attrs, function (attr) {
                    var baseAttr = _.find(_rawData.nodeAttrsBase, 'id', attr.id);
                    if (baseAttr) {
                        _.assign(baseAttr, attr, function (oldVal, newVal) {
                            return newVal != null ? newVal : oldVal;
                        });
                    }
                });

                _.each(_rawData.nodeAttrsBase, attrInfo.updateAttrDescForId, attrInfo);
                _rawData.nodeAttrTitleIndex = _.indexBy(_rawData.nodeAttrsBase, 'title');
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated);
                _rawData.nodeAttrs = _rawData.nodeAttrsBase;
                return _rawData.nodeAttrsBase;
            }

            function removeNodeAttrs(attrIds) {
                if (!_.isArray(attrIds)) throw new Error('Attr Ids array expected');
                _.each(attrIds, function (attrId) {
                    var rdAttrIdx = _.findIndex(_rawData.nodeAttrsBase, 'id', attrId);
                    if (rdAttrIdx > -1) _rawData.nodeAttrsBase.splice(rdAttrIdx, 1);
                });
                _rawData.nodeAttrs = _rawData.nodeAttrsBase;
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated);
                return _rawData.nodeAttrsBase;
            }

            function updateEdgeAttrsBase(attrs) {
                var attrInfo = AttrInfoService.getLinkAttrInfoForRG();

                _.each(attrs, function (attr) {
                    var baseAttr = _.find(_rawData.edgeAttrsBase, 'id', attr.id);
                    if (baseAttr) {
                        _.assign(baseAttr, attr, function (oldVal, newVal) {
                            return newVal != null ? newVal : oldVal;
                        });
                    }
                });

                _.each(_rawData.edgeAttrsBase, attrInfo.updateAttrDescForId, attrInfo);
                _rawData.edgeAttrs = _rawData.edgeAttrsBase;
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.linkAttrsUpdated);
                return _rawData.edgeAttrsBase;
            }

            function removeEdgeAttrs(attrIds) {
                if (!_.isArray(attrIds)) throw new Error('Attr Ids array expected');
                _.each(attrIds, function (attrId) {
                    var rdAttrIdx = _.findIndex(_rawData.edgeAttrsBase, 'id', attrId);
                    if (rdAttrIdx > -1) _rawData.edgeAttrsBase.splice(rdAttrIdx, 1);
                });
                _rawData.edgeAttrs = _rawData.edgeAttrsBase;
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.linkAttrsUpdated);
                return _rawData.edgeAttrsBase;
            }

            function updateNodeAttrsOrder() {
                var dataset = dataService.currDataSetUnsafe();
                var network = networkService.getCurrentNetwork();
                var orderedAttrs = [];
                var orderedDSAttrIds = _.pluck(dataset.attrDescriptors, 'id');
                var orderedNWAttrIds = _.pluck(network.nodeAttrDescriptors, 'id');
                var orderedAttrIds = _.union(orderedDSAttrIds, orderedNWAttrIds);
                _.each(orderedAttrIds, function (attrId) {
                    var dgAttr = _.find(_rawData.nodeAttrsBase, 'id', attrId);
                    if (!dgAttr) throw new Error('Attr not found in datagraph attrs - ' + attrId);
                    orderedAttrs.push(dgAttr);
                });
                _rawData.nodeAttrsBase = orderedAttrs;
                _rawData.nodeAttrs = _rawData.nodeAttrsBase;
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated);
                $rootScope.$broadcast(BROADCAST_MESSAGES.project.load, {});
            }

            function updateEdgeAttrsOrder() {
                var network = networkService.getCurrentNetwork();
                var linkAttrIds = _.pluck(network.linkAttrDescriptors, 'id');
                var orderedAttrs = [];
                _.each(linkAttrIds, function (attrId) {
                    var dgAttr = _.find(_rawData.edgeAttrsBase, 'id', attrId);
                    if (!dgAttr) throw new Error('Attr not found in datagraph attrs - ' + attrId);
                    orderedAttrs.push(dgAttr);
                });
                _rawData.edgeAttrsBase = orderedAttrs;
                _rawData.edgeAttrs = _rawData.edgeAttrsBase;
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.linkAttrsUpdated);
            }

            function getNodesForCluster(cluster) {
                if (!cluster) throw new Error('No cluster group passed');
                return _.filter(_rawData.nodes, function (nd) {
                    return nd.attr['Cluster'] == cluster;
                });
            }

            function getNodesForPartition(partition, value) {
                if (!partition) throw new Error('No partition passed');
                return _.filter(_rawData.nodes, function (nd) {
                    return nd.attr[partition] == value;
                });
            }

            function partitionNodesByAttr(attrId) {
                if (!attrId) throw new Error('No attrId given');
                var partition = _.groupBy(_rawData.nodes, 'attr.' + attrId);
                return partition;
            }

            function getNodeAttrTitlesForIds(attrIds) {
                return _.map(_.filter(_rawData.nodeAttrs, function (attr) {
                    return attrIds.indexOf(attr.id) > -1;
                }), 'title');
            }

            function changeNodeCatNames(attrId, oldVal_newValMap) {
                var rd = _rawData;
                if (!rd.nodeAttrIndex[attrId]) {
                    throw new Error("Attrbute not found on node: " + attrId);
                }
                var attr = rd.nodeAttrIndex[attrId];
                if (attr.isNumeric || attr.isInteger) {
                    throw new Error('Attrbute is not categorical!');
                }
                _.each(rd.nodes, function (node) {
                    if (node.attr[attrId] != null) {
                        var oldVal = node.attr[attrId];
                        node.attr[attrId] = oldVal_newValMap[oldVal] != null ? oldVal_newValMap[oldVal] : oldVal;
                    }
                });
                var p = null;
                if (attr.fromDataset) {
                    p = dataService.changeDataPointCatNames(attrId, oldVal_newValMap);
                } else {
                    p = networkService.changeDataPointCatNames(networkService.getCurrentNetwork().id, attrId, oldVal_newValMap);
                }
                // update attrInfos
                p.then(function () {
                    AttrInfoService.loadInfoForNetwork(networkService.getCurrentNetwork());
                    AttrInfoService.loadInfosForRG(_currRenderableGraph, _currRenderableGraph.layout);
                    $rootScope.$broadcast(BROADCAST_MESSAGES.project.dpCatNamesChanged);
                });
                p.catch(function (err) {
                    console.error("Error in updating cat names:", err);
                });
                return p;
            }

            function getBounds(elems) {
                console.assert(_.isArray(elems), "Elems to calculate bounds should be an array");
                var bounds = {
                    minx: elems[0],
                    miny: elems[0],
                    maxx: elems[0],
                    maxy: elems[0]
                };
                _.each(elems, function (elem) {
                    if (elem.x > bounds.maxx.x) {
                        bounds.maxx = elem;
                    }
                    else if (elem.x < bounds.minx.x) {
                        bounds.minx = elem;
                    }

                    if (elem.y > bounds.maxy.y) {
                        bounds.maxy = elem;
                    }
                    else if (elem.y < bounds.miny.y) {
                        bounds.miny = elem;
                    }
                });
                return bounds;
            }


            return API;
        }]);
