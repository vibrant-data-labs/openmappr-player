/*jshint unused:false, loopfunc:true */
/**
 * This service builds intelligence about an attribute in the dataset
 */
angular.module('common')
    .service('SelectorService', ['$timeout', '$q', 'dataGraph', 'AttrInfoService', 'subsetService',
        function ($timeout, $q, dataGraph, AttrInfoService, subsetService) {
            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            this.newSelector = function() { return new NodeSelector('NODE'); };



            /*************************************
    ********* CLASSES ********************
    **************************************/
            function NodeSelector (selectorOf) {
                this.selectorOf = selectorOf;
                this.type = 'NONE';
                this.nodeIds = [];

                this.attrId = null;
                this.attrVal = null;
                this.fivePct = null;
                this.attrValMin = Infinity;
                this.attrValMax = -Infinity;
                this.entityId = null; // single select
                this.entityIds = []; // multi select
                this.attrVals = []; // multiple value select
            }
            NodeSelector.prototype.ofAttrValue = function(attrId, attrVal) {
                this.type = 'ATTR_VALUE';
                this.attrId = attrId;
                this.attrVal = attrVal;
                this.stringify = function() {
                    return { values: [this.attrVal] };
                };
                return this;
            };
            NodeSelector.prototype.ofAttrRange = function(attrId, attrValMin, attrValMax) {
                this.type = 'ATTR_RANGE';
                this.attrId = attrId;
                this.attrValMin = attrValMin;
                this.attrValMax = attrValMax;

                this.stringify = function() {
                    var isNumber = function(val) { return !Number.isNaN(Number(val)); };
                    var values = _.filter([this.attrValMin, this.attrValMax], _.identity());
                    var description = '';
                    if (isNumber(this.attrValMin) && isNumber(this.attrValMax)) {
                        description = 'btw';
                    } else if (isNumber(this.attrValMin)) {
                        description = 'ht';
                    } else {
                        description = 'lt';
                    }

                    return { values: values, description: description };
                };

                return this;
            };
            NodeSelector.prototype.ofMultiAttrRange = function(attrId, attrRanges) {
                this.type = 'MULTI_ATTR_RANGE';
                this.attrId = attrId;
                this.attrRanges = attrRanges;
                this.stringify = function() {
                    var isNumber = function(val) { return !Number.isNaN(Number(val))}
                    return _.reduce(this.attrRanges, function(acc, cv) {
                        var description = '';
                        if (isNumber(cv.min) && cv.min > 0 && isNumber(cv.max)) {
                            description = 'btw';
                        } else if (isNumber(cv.min) && cv.min > 0 ) {
                            description = 'ht';
                        } else {
                            description = 'lt';
                        }

                        acc.push({ values: _.filter([cv.min, cv.max], _.identity()), description: description });
                    
                        return acc;
                    }, []);
                }
                return this;
            };
            NodeSelector.prototype.ofCluster = function(clusterAttrId, clusterAttrVal) {
                this.type = 'CLUSTER';
                this.attrId = clusterAttrId;
                this.attrVal = clusterAttrVal;
                this.stringify = function() {
                    return { values: [this.attrVal] };
                };

                return this;
            };
            NodeSelector.prototype.ofNode = function(nodeId) {
                this.type = 'NODE';
                this.entityId = nodeId;
                this.stringify = function() {
                    return { values: [this.entityId] };
                };

                return this;
            };
            NodeSelector.prototype.ofDataPoint = function(dataPointId) {
                this.type = 'DATAPOINT';
                this.entityId = dataPointId;

                this.stringify = function() {
                    return { values: [this.entityId] };
                };
                return this;
            };
            NodeSelector.prototype.ofGeo = function (attrId, attrValue) {
                this.type = 'GEO';
                this.attrId = attrId;
                this.attrValue = attrValue;
                this.stringify = function() {
                    return { values: attrValue.map(x => x.name) }
                }
                return this;
            }
            NodeSelector.prototype.ofMultipleAttrValues = function(attrId, attrVals) {
                this.type = 'MULTI_ATTR_VALUE';
                this.attrId = attrId;
                this.attrVals = attrVals;
                this.stringify = function() {
                    return { values: this.attrVals };
                };
                return this;
            };
            NodeSelector.prototype.ofMultipleNodes = function(nodeIds) {
                this.type = 'MULTI_NODES';
                this.entityIds = nodeIds;
                this.stringify = function() {
                    return { values: this.entityIds };
                };
                return this;
            };
            NodeSelector.prototype.ofMultipleDataPoints = function(dataPointIds) {
                this.type = 'MULTI_DATAPOINTS';
                this.entityIds = dataPointIds;
                this.stringify = function() {
                    return { values: this.entityIds };
                };
                return this;
            };
            // empty selector
            NodeSelector.prototype.ofNone = function(attrId) {
                this.type = 'NONE';
                this.attrId = attrId || this.attrId;
                this.stringify = function() {
                    return { values: []};
                };
                return this;
            };

            // NodeSelector.prototype.select = function(entities, entityAttrDescriptor) {
            //     return [];
            // };
            NodeSelector.prototype.selectfromDataGraph = function() {
                var nodeIds = null,
                    attrId = this.attrId,
                    fivePct = this.fivePct,
                    rd = dataGraph.getRawDataUnsafe();
                switch(this.type) {
                case 'CLUSTER'          :
                case 'ATTR_VALUE'       : nodeIds = this.attrVal != null ? dataGraph.getNodesByAttrib(attrId, this.attrVal, this.fivePct): [];
                    break;
                case 'ATTR_RANGE'       :
                    nodeIds = dataGraph.getNodesByAttribRange(attrId, this.attrValMin, this.attrValMax);
                    break;
                case 'MULTI_ATTR_RANGE':
                    nodeIds = this.attrRanges ? this.attrRanges.map(function(r) {
                        return dataGraph.getNodesByAttribRange(attrId, r.min, r.max);
                    }) : [];
                    nodeIds = _.flatten(nodeIds);
                    break;
                case 'NODE'             : nodeIds = [this.entityId];
                    break;
                case 'DATAPOINT'        : nodeIds = [rd.dataPointIdNodeIdMap[this.entityId]];
                    break;
                case 'MULTI_ATTR_VALUE' : nodeIds = _.uniq(_.flatten(_.map(this.attrVals, function(attrVal) {
                    return dataGraph.getNodesByAttrib(attrId, attrVal, fivePct);
                })));
                    break;
                case 'MULTI_NODES'      : nodeIds = _.filter(this.entityIds, function(id) { return !!rd.nodeIndex[id]; });
                    break;
                case 'MULTI_DATAPOINTS' : nodeIds = _.compact(_.map(this.entityIds, function(id) { return rd.dataPointIdNodeIdMap[id]; }));
                    break;
                case 'GEO':
                    const allNodes = subsetService.subsetNodes.length > 0 ? subsetService.subsetNodes : rd.nodes;
                    const attrValues = this.attrValue;
                    nodeIds = _.filter(allNodes, function(node) {
                        if (!('geodata' in node)) {
                            return false;
                        }

                        const geoValues = Object.values(node.geodata);
                        return geoValues.some(x => attrValues.map(r => r.id).includes(x));
                    }).map(x => x.id)
                    break;
                }
                this.nodeIds = nodeIds;
                return nodeIds;
            };
            NodeSelector.prototype.selectFromNodes = function(nodes) {
                var nodeIds   = null,
                    attrId    = this.attrId,
                    fivePct   = this.fivePct,
                    rd        = dataGraph.getRawDataUnsafe();

                var attrInfo = null, attr = null;
                if(attrId) {
                    attr = rd.getAttrInfo(attrId);
                    if (attr) {
                        attrInfo =  AttrInfoService.buildAttrInfoMap(attr, nodes).infoObj;
                    }
                }
                switch(this.type) {
                case 'CLUSTER':
                case 'ATTR_VALUE':  nodeIds = this.attrVal != null ? filterNodesByAttrib(nodes, attrId, attrInfo, this.attrVal, this.fivePct) : [];
                    console.log(logPrefix + 'filtered selection: ', nodeIds);
                    break;
                case 'ATTR_RANGE'       : nodeIds = filterNodesByAttribRange(nodes, attr, this.attrValMin, this.attrValMax);
                    break;
                case 'MULTI_ATTR_RANGE'       : nodeIds = filterNodesByMultiAttribRange(nodes, attr, this.attrRanges);
                    break;                    
                case 'MULTI_ATTR_VALUE' : nodeIds = _.uniq(_.flatten(_.map(this.attrVals, function(attrVal) {
                    return filterNodesByAttrib(nodes, attrId, attrInfo, attrVal, fivePct);
                })));
                    break;
                case 'GEO':
                    const attrValues = this.attrValue;
                    nodeIds = _.filter(nodes, function(node) {
                        if (!('geodata' in node)) {
                            return false;
                        }

                        const geoValues = Object.values(node.geodata);
                        return geoValues.some(x => attrValues.map(r => r.id).includes(x));
                    }).map(x => x.id)
                    break;
                default:
                    throw new Error(logPrefix + 'selectFromNodes() ' + "Not implemented for " + this.type);
                }
                this.nodeIds = nodeIds;
                return nodeIds;
            };
            NodeSelector.prototype.selectfromDataSet = function() {
                return [];
            };
            NodeSelector.prototype.selectfromNetwork = function() {
                return [];
            };
            NodeSelector.prototype.isCluster  = function() {
                return this.type === 'CLUSTER';
            };
            NodeSelector.prototype.isAttrValSelector  = function() {
                return this.type === 'CLUSTER' || this.type === 'ATTR_VALUE';
            };
            NodeSelector.prototype.getNodes = function() {
                var rg = dataGraph.getRenderableGraph();
                return _.map(this.nodeIds, rg.getNodeById, rg);
            };
            // Only works once a selection happens
            NodeSelector.prototype.getTitle = function() {
                var title = '',
                    rg = dataGraph.getRenderableGraph(),
                    rd = dataGraph.getRawDataUnsafe();
                var numNodeStr = '(' + this.nodeIds.length + ')';
                switch(this.type) {
                case 'CLUSTER'          :
                case 'ATTR_VALUE'       : title = dataGraph.getNodeAttrTitle(this.attrId) + ': ' + this.attrVal + ' ' + numNodeStr;
                    break;
                case 'ATTR_RANGE'       : title = dataGraph.getNodeAttrTitle(this.attrId) + '(' +this.attrValMin + ', ' + this.attrValMax + ')' + ' ' + numNodeStr;
                    break;
                case 'NODE'             : title = rg.getNodeTitle(this.entityId);
                    break;
                case 'DATAPOINT'        : title = rg.getNodeTitle(rd.dataPointIdNodeIdMap[this.entityId]);
                    break;
                case 'MULTI_NODES'      : title = 'nodes ' + numNodeStr;
                    break;
                case 'MULTI_DATAPOINTS' : title = 'dataPoints ' + numNodeStr;
                    break;
                }
                return  title;
            };

            /*************************************
    ********* Local Data *****************
    **************************************/
            var logPrefix = '[SelectorService: ] ';
            // var selectorTypes = ['NONE', 'ATTR_VALUE', 'ATTR_RANGE', 'CLUSTER', 'NODE', 'DATAPOINT', 'MULTI_ATTR_VALUE', 'MULTI_NODES', 'MULTI_DATAPOINTS'];





            /*************************************
    ********* Core Functions *************
    **************************************/

            // fivePct is a boolean to return numeric values in 5% range or quartiles
            function filterNodesByAttrib(nodes, attrId, attrInfo, value, fivePct) {

                if(attrId == null) { return []; }

                if(!attrInfo) {
                    console.warn(logPrefix + 'Unable to find attrInfo for Attribute:' + attrId);
                    return [];
                }
                var selectedNodeIds = [];

                if(attrInfo.isNumeric) {
                    var valLow, valHigh, nBins = fivePct ? 20 : 5;
                    value = parseFloat(value);
                    if( attrInfo.valuesCount[value] == null ) {
                        value = attrInfo.values[_.sortedIndex(attrInfo.values, value)];
                    }
                    var rank = attrInfo.valuesCount[value].rank;
                    var count = attrInfo.values.length, binSize = count / nBins;
                    if( rank.max - rank.min + 1 >= binSize ) {  // lots of nodes with this value
                        valLow = valHigh = value;
                    } else {    // few nodes with value, show bin including this value
                        valLow = attrInfo.values[Math.floor(binSize * Math.floor(rank.min/binSize))];
                        valHigh = attrInfo.values[Math.ceil(binSize * Math.ceil(rank.max/binSize)) - 1];
                    }
                    // find all nodes with the value within the bracket (val >= low && val <= high)
                    selectedNodeIds = _.reduce(nodes, function(chosenOnes, node) {
                        if(node.attr[attrId] != null && node.attr[attrId] >= valLow && node.attr[attrId] <= valHigh) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    },[]);
                } else if(attrInfo.isTag ) {    // find nodes with tag in attribute value array
                    selectedNodeIds = _.reduce(nodes, function(chosenOnes, node) {
                        if(node.attr[attrId] && node.attr[attrId].indexOf(value) !== -1 ) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    },[]);
                } else {
                    // find all nodes with the (categorical) value
                    selectedNodeIds = _.reduce(nodes, function(chosenOnes, node) {
                        if(node.attr[attrId] === value) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    },[]);
                }
                //
                // From these nodes, remove ones which are invalid
                var rg = dataGraph.getRenderableGraph();
                return _.filter(selectedNodeIds, function(nodeId) { return rg.getNodeById(nodeId); });
            }

            function filterNodesByAttribRange (nodes, attr, min, max) {
                if(attr == null) { return []; }
                var attrId = attr.id;
                console.log(logPrefix,'Getting nodes in range: %s, %s for attr: %s', min, max, attrId);

                var selectedNodeIds = [];
                if(attr.isNumeric) {
                    // find all nodes with the value within the bracket (val >= low && val <= high)
                    selectedNodeIds = _.reduce(nodes, function(chosenOnes, node) {
                        if(node.attr[attrId] != null && node.attr[attrId] >= min && node.attr[attrId] <= max) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    },[]);
                }
                var rg = dataGraph.getRenderableGraph();
                return _.filter(selectedNodeIds, function(nodeId) { return rg.getNodeById(nodeId); });
            }

            function filterNodesByMultiAttribRange(nodes, attr, attrRanges) {
                if(attr == null) { return []; }
                var attrId = attr.id;
                console.log(logPrefix,'Getting nodes in ranges: %s for attr: %s', _.map(attrRanges, function(r) { return r.min + ':' + r.max }).join(','), attrId);

                var selectedNodeIds = [];
                if(attr.isNumeric) {
                    // find all nodes with the value within the bracket (val >= low && val <= high) for each range
                    selectedNodeIds = _.reduce(nodes, function(chosenOnes, node) {
                        if (!Number.isFinite(node.attr[attrId])) return chosenOnes;

                        var matches = _.filter(attrRanges, function(r) {
                            return node.attr[attrId] >= r.min && node.attr[attrId] <= r.max;
                        })
                        
                        if(matches.length > 0) {
                            chosenOnes.push(node.id);
                        }
                        return chosenOnes;
                    },[]);
                }
                var rg = dataGraph.getRenderableGraph();
                return _.filter(selectedNodeIds, function(nodeId) { return rg.getNodeById(nodeId); });
            }

            // function toJSON(selector) {
            //     return _.pick(selector, {
            //         selectorOf : selector.selectorOf,
            //         type : selector.type,
            //         attrId : selector.attrId,
            //         attrVal : selector.attrVal,
            //         attrVals : selector.attrVals,
            //         fivePct : selector.fivePct,
            //         attrValMin : selector.attrValMin,
            //         attrValMax : selector.attrValMax,
            //         entityId : selector.entityId,
            //         entityIds : selector.entityIds
            //     });
            // }
            // need to run selectFromX func to fully build the object
            // function fromJSON(selectorJSON) {
            //     var sel = new NodeSelector('NODE');
            //     _.assign(sel, selectorJSON);
            //     return sel;
            // }
        }
    ]);
