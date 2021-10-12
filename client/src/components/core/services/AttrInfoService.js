/**
 * This service builds intelligence about an attribute in the dataset
 */
angular.module('common')
    .service('AttrInfoService', ['$timeout', '$q', 'networkService', 'dataService',
        function ($timeout, $q, networkService, dataService) {
            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            this.getNodeAttrInfoForNetwork = getNodeAttrInfoForNetwork;
            this.getLinkAttrInfoForNetwork = getLinkAttrInfoForNetwork;
            // if these variables are null, then the system returns AttrInfo for the current network
            this.getNodeAttrInfoForRG = getNodeAttrInfoForRG;
            this.getLinkAttrInfoForRG = getLinkAttrInfoForRG;

            this.loadInfoForNetwork = loadInfoForNetwork;
            this.loadInfosForRG = loadInfosForRG;

            this.genInfoForGrouping = genInfoForGrouping;

            this.clearCaches            = clearCaches;
            this.clearRenderGraphCaches = clearRenderGraphCaches;
            this.clearNetworkCache     = clearNetworkCache;

            this.buildAttrInfoMap = buildAttrInfoMap;

            this.getRenderTypes = getRenderTypes;
            this.getRenderTypesMap = getRenderTypesMap;
            this.getMediaAttrTypes = getMediaAttrTypes;

            this.shouldRendererShowforSN = shouldRendererShowforSN;
            this.isDistrAttr = isDistrAttr;

            this.getClusterInfoFn = getClusterInfoFn; // basically for ScriptAttrib



            /*************************************
    ********* Local Data *****************
    **************************************/
            var logPrefix = "[AttrInfoService] ";
            const SINGLETONE_TAG_FRACTION = 0.8;

    // Render types for individual attr type
    // Note:-
    //   1) Change on server side(datasys/datasys_model.js) and athena(entities.py) as well on updation
    //   2) Each attr type gets first render type as default
    var attrRenderTypesMap = {
        'string': ['tag-cloud', 'wide-tag-cloud','categorylist' ,'categorybar', 'text', 'textlist', 'piechart', 'barchart', 'media', 'link', 'date', 'date-time', 'time', 'email', 'lat,lng', 'longtext', 'horizontal-bars'],
        'json': ['medialist'],
        'twitter': ['twitterfeed'],
        'instagram': ['instagramfeed'],
        'liststring': ['tag-cloud', 'wide-tag-cloud','tags', 'horizontal-bars'],
        'boolean': ['categorybar', 'piechart', 'histogram'],
        'color': ['categorybar', 'piechart', 'histogram'],
        'integer': ['histogram', 'densitybar', 'horizontal-bars'],
        'float': ['histogram', 'densitybar', 'horizontal-bars'],
        'year': ['histogram', 'densitybar', 'horizontal-bars'],
        'picture': ['default'],
        'profile': ['default'],
        'audio_stream': ['default'],
        'video_stream': ['default'],
        'media_link': ['default'],
        'video': ['default'],
        'html': ['default'],
        'url': ['default'],
        'timestamp' : ['histogram', 'default']
    };

            var mediaAttrTypes = ['json', 'twitter', 'instagram', 'picture', 'audio_stream', 'media_link', 'video_stream', 'video', 'html', 'url'];
            var renderableTypes = ['email', 'text', 'media'];

            // Info objs are not built until they are request. Helps in initial load
            var nodeInfoObjForNetwork = {}, // networkId -> Info Obj / func
                nodeInfoObjForRenderGraph = null; // Info Obj for current render graph. can be func

            var linkInfoObjForNetwork = {},
                linkInfoObjForRenderGraph = null;




            /*************************************
    ********* Core Functions *************
    **************************************/
            //
            // classes

            // AttrInfo object. Generated for an entity. Like node, edges
            // It lazily generates info to minimize computation

            function AttrInfo (name,entity_type) {
                this.__cache = {}; // contains the Cache object with 4 keys : attr, entities, infoObj, __refresh__
                this.__attrTitleIdMap = {};
                this.name = name;
                this.entity_type =entity_type;
            }
            AttrInfo.prototype.getForId = function(attrId) {
                var val = this.__cache[attrId];
                if(!val) { // attrInfo does not exist
                    throw new Error("AttrInfo not found for this attr:" + attrId);
                }
                if( _.isObject(val) && val.__refresh__) { // if __refresh__ exists obj, then re-run the calc
                    var infoMap = buildAttrInfoMap(val.attr, val.entities);
                    this.__cache[attrId].infoObj = infoMap.infoObj;
                    this.__cache[attrId].logInfoObj = infoMap.logInfoObj;
                    this.__cache[attrId].__refresh__ = false;
                }
                return this.__cache[attrId].infoObj;
            };
            AttrInfo.prototype.getForLogId = function(attrId) {
                this.getForId(attrId);
                return this.__cache[attrId].logInfoObj;
            }

            AttrInfo.prototype.forId = function(attrId) {
                return this.getForId(attrId);
            };
            AttrInfo.prototype.getForTitle = function(attrTitle) {
                return this.getForId(this.__attrTitleIdMap[attrTitle]);
            };
            // build an infoObj for a particular AttrDesc
            AttrInfo.prototype.setForId = function(attr, entities) {
                this.__cache[attr.id] = {
                    attr : attr,
                    entities : entities,
                    infoObj : null, // lazily generated
                    __refresh__ : true
                };
                this.__attrTitleIdMap[attr.title] = attr.id;
                return this.__cache[attr.id];
            };
            // called when attrs are changed
            AttrInfo.prototype.updateAttrDescForId = function(attr, entities) {
                var val = this.__cache[attr.id];
                val.attr = attr;
                val.infoObj = null;
                val.__refresh__ = true;
                if(entities && entities.length > 0 ) val.entities = entities;

                this.__attrTitleIdMap[attr.title] = attr.id;
                return this;
            };
            AttrInfo.prototype.removeAttrDescForId = function(attrId) {
                delete this.__cache[attrId];
                delete this.__attrTitleIdMap[attrId];
            };

            // Stores per attr value information
            function InfoObj (attr) {
                this.attr = attr;
            }

            function clearCaches () {
                nodeInfoObjForNetwork = {};
                nodeInfoObjForRenderGraph = null;
                linkInfoObjForNetwork = {};
                linkInfoObjForRenderGraph = null;
            }
            function clearNetworkCache (networkId) {
                nodeInfoObjForNetwork[networkId] = null;
                linkInfoObjForNetwork[networkId] = null;
            }
            function clearRenderGraphCaches () {
                nodeInfoObjForRenderGraph = null;
                linkInfoObjForRenderGraph = null;
            }

            function loadInfosForRG (renderGraph) {
                // if the num nodes and edges equal the network nodes and edges, use the network InfoMap
                // otherwise build a new one
                var network = networkService.getCurrentNetwork();
                if(network.nodes.length === renderGraph.graph.nodes.length) {
                    if(nodeInfoObjForNetwork[network.id] == null) {
                        loadInfoForNetwork(network);
                    }
                    nodeInfoObjForRenderGraph = null;
                    console.log(logPrefix + "Same node count.Using Current Network Info Obj for RG");
                } else {
                    console.log(logPrefix + "Nodes have been filtered out. Generating a unique AttrInfo obj for current Render graph");
                    nodeInfoObjForRenderGraph = new AttrInfo('renderGraph', 'nodes');
                    _.each(renderGraph.rawData.nodeAttrs, function (attr) {
                        nodeInfoObjForRenderGraph.setForId(attr,renderGraph.graph.nodes);
                    });
                }
                if(network.links.length === renderGraph.graph.edges.length) {
                    if(linkInfoObjForNetwork[network.id] == null) {
                        loadInfoForNetwork(network);
                    }
                    linkInfoObjForRenderGraph = null;
                    console.log(logPrefix + "Same edge count. Using Current Network Info Obj for RG");
                } else {
                    console.log(logPrefix + "Links have been filtered out. Generating a unique AttrInfo obj for current Render graph");
                    linkInfoObjForRenderGraph = new AttrInfo('renderGraph', 'links');
                    _.each(renderGraph.rawData.edgeAttrs, function (attr) {
                        linkInfoObjForRenderGraph.setForId(attr,renderGraph.graph.edges);
                    });
                }
            }

            function loadInfoForNetwork (network) {
                console.log(logPrefix + "Loading network Attribute info");
                var dataset = dataService.currDataSetUnsafe();
                nodeInfoObjForNetwork[network.id] = new AttrInfo("network:" + network.id, 'nodes');
                linkInfoObjForNetwork[network.id] = new AttrInfo("network:" + network.id, 'links');

                _.each(dataset.attrDescriptors, function(attr) {
                    var dsAttrCopy = _.clone(attr);
                    dsAttrCopy.fromDataset = true;
                    nodeInfoObjForNetwork[network.id].setForId(dsAttrCopy,network.nodes);
                });
                _.each(network.nodeAttrDescriptors, function (attr) {
                    nodeInfoObjForNetwork[network.id].setForId(attr,network.nodes);
                });
                _.each(network.linkAttrDescriptors, function (attr) {
                    linkInfoObjForNetwork[network.id].setForId(attr, network.links);
                });
            }

            function genInfoForGrouping (bunchOfNodes, attrs) {
                // console.log(logPrefix + "Loading Info for a bunchOfNodes", bunchOfNodes);
                var attrInfo = new AttrInfo("bunchOfNodes:" + bunchOfNodes.length, 'bunchOfNodes');

                _.each(attrs, function (attr) {
                    attrInfo.setForId(attr,bunchOfNodes);
                });
                return attrInfo;
            }

            // return a fn which gives the cluster Info for the given node
            function getClusterInfoFn (mergedGraph) {

                var ciIdx = _.groupBy(mergedGraph.nodes, 'attr.Cluster');

                var ci = {};
                var forId = function(node) {
                    var cluster = _.get(node, 'attr.Cluster');
                    if(!cluster) { throw new Error("Cluster not found on NodeId: " + node.id); }

                    if(!ci[cluster]) {
                        ci[cluster] = genInfoForGrouping(ciIdx[cluster], mergedGraph.nodeAttrs);
                    }
                    return ci[cluster];
                };
                return forId;
            }

            function getNodeAttrInfoForNetwork (networkId) {
                var val = nodeInfoObjForNetwork[networkId];
                // if( typeof val === 'function') {
                //     val = nodeInfoObjForNetwork[networkId] = val(); // compute InfoObj and cache it
                // }
                console.assert(val, "AttrInfo should not be null");
                return val;
            }
            function getLinkAttrInfoForNetwork (networkId) {
                var val = linkInfoObjForNetwork[networkId];
                // if( typeof val === 'function') {
                //     val = linkInfoObjForNetwork[networkId] = val(); // compute InfoObj and cache it
                // }
                console.assert(val, "AttrInfo should not be null");
                return val;
            }

            // get complete info object
            function getNodeAttrInfoForRG () {
                var nw = networkService.getCurrentNetwork();
                if(!nw) {
                    console.error("[getNodeAttrInfoForRG] Called for empty network!");
                    return undefined;
                }
                var nsId = nw.id;
                return nodeInfoObjForRenderGraph != null ? nodeInfoObjForRenderGraph : getNodeAttrInfoForNetwork(nsId);
            }
            function getLinkAttrInfoForRG () {
                var nsId = networkService.getCurrentNetwork().id;
                return linkInfoObjForRenderGraph != null ? linkInfoObjForRenderGraph : getLinkAttrInfoForNetwork(nsId);
            }

            function getRenderTypes(attrType) {
                return attrType ? attrRenderTypesMap[attrType] || [] : [];
            }

            function getRenderTypesMap() {
                return _.cloneDeep(attrRenderTypesMap);
            }

            function shouldRendererShowforSN(attrType, renderType) {
                // Dont show distribution for these attr types for grouped node selections
                if(_.contains(mediaAttrTypes, attrType) || _.contains(renderableTypes, renderType)) {
                    return true;
                }
                else {
                    return false;
                }
            }

            function isDistrAttr (attr, attrInfo) {
                if(shouldRendererShowforSN(attr.attrType, attr.renderType)) {
                    return false;
                }
                // always show tag distributions
                if(attr.attrType == 'liststring') {
                    return true;
                }
                // strings with media/info renderTypes such as (text) handled above
                // if reached here, then render as distribution
                if(attr.attrType == 'string') {
                    return true;
                }
                return attrInfo.values.length > 1; // more than 1 value;
            }

            function getMediaAttrTypes() {
                return _.clone(mediaAttrTypes);
            }

            //
            // Support funcs
            //

            function buildAttrInfoMap (attr, entities) {
                var attribId = attr.id;
                var infoObj = new InfoObj(attr);
                
                infoObj.existsOnAll = _.every(entities, function(item) { return item.attr[attribId] != null; });
                infoObj.isNumeric = attr.isNumeric;
                infoObj.isInteger = attr.isInteger;
                infoObj.isTag = attr.isTag;


                var values = _.reduce(entities, function(acc, item) {
                    if(item.attr[attribId] != null ) {
                        acc.push(item.attr[attribId]);
                    }
                    return acc;
                }, []);

                if(attr.isNumeric) {
                    var logInfoObj = {...infoObj, isInteger: false};
                    getNumericAttrInfo(values, infoObj);
                    if (infoObj.stats.min >= 0 && !attr.id.includes('log10') && (attr.attrType === 'float' || attr.attrType === 'integer')) {
                        if (infoObj.stats.min === 0) {
                            values = _.map(values, (val) => val + 0.1);
                        }
                        var logValues = _.map(values, (val) => +Math.log10(val).toFixed(2));
                        getNumericAttrInfo(logValues, logInfoObj);
                        return { infoObj, logInfoObj };
                    }
                } else if(attr.isTag) {
                    getTagAttrInfo(entities, attribId, infoObj);
                } else {
                    getNonNumericAttrInfo(values, infoObj);
                }
                // console.log("Attr Info for attr: %s : %O", attribId, infoObj);
                return { infoObj };
            }

            function getNumericAttrInfo(values, destination) {
                var i, val, valInfo, nVal;
                values = _.map(values).sort(function(a,b){ return a > b ? 1 : -1; });
                nVal = values.length;
                destination.bounds = {
                    max: Math.round(d3.max(values)*100)/100,
                    //quantile_90: Math.round(d3.quantile(values,0.90)*100)/100,
                    quantile_75: Math.round(d3.quantile(values,0.75)*100)/100,
                    quantile_50: Math.round(d3.median(values)*100)/100,
                    quantile_25: Math.round(d3.quantile(values,0.25)*100)/100,
                    //quantile_10: Math.round(d3.quantile(values,0.10)*100)/100,
                    min: Math.round(d3.min(values)*100)/100
                    // mean: Math.round(d3.mean(values)*100)/100
                };
                destination.stats = {
                    max: d3.max(values),
                    min: d3.min(values)
                };

                valInfo = {};
                for (i = 0; i < values.length; i++) {
                    val = values[i];
                    if( valInfo[val] === undefined ) {
                        valInfo[val] = {count: 0, rank: {min: i}};
                    }
                    valInfo[val].count = valInfo[val].count + 1;
                    valInfo[val].rank.max = i;
                }

                destination.values = values;
                destination.valuesCount = valInfo;

                // gen binInfo
                _buildBins(destination);

                // suggest using log axis if likelihood of exponential distr is > likelihood of uniform distr
                destination.useLog = destination.bounds.min > 0 &&
                    nVal*(Math.log(destination.bounds.mean) - 1) >
                    nVal*Math.log(nVal/((nVal+1)*(destination.bounds.max-destination.bounds.min)));
            }

            function _nonNumericHelper(destination, counts) {
                var i,
                    sortedKeys = _.sortBy(_.keys(counts), function(a) {
                        return counts[a];
                    });
                var sortedCounts = {};
                // build sorted histogram. this makes no sense.
                // unless numKeys(counts) > len(sortedKeys)
                // TODO: Investigate
                for (i = sortedKeys.length - 1; i >= 0; i--) {
                    sortedCounts[sortedKeys[i]] = counts[sortedKeys[i]];
                }
                // build rank for each value or tag
                var ranks = {}, rank = 0;
                for (i = 0; i < sortedKeys.length; i++) {
                    var key = sortedKeys[i];
                    ranks[key] = {min: rank, max: rank + counts[key]};
                    rank += counts[key];
                }
                destination.ranks = ranks;
                destination.values = sortedKeys;
                destination.valuesCount = sortedCounts;
            }

            function getNonNumericAttrInfo(values, destination) {
                var i, counts, val;
                counts = {};
                for (i = values.length - 1; i >= 0; i--) {
                    val = values[i];
                    counts[val] = counts[val] ? counts[val]+1 : 1;
                }
                destination.nValues = values.length;
                _nonNumericHelper(destination, counts);
            }

            function getTagAttrInfo(nodes, attribName, destination) {
                // var re = /\s*\|\s*/;     // split on pipe and remove any surrounding spaces
                var i, j, val, valCount = 0, tagFrequency, nodeValsFreq = {};
                tagFrequency = {};        // global frequency of each tag

                for(i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    if(node.attr[attribName] != null) {    // make sure node has a value for this attribute
                        var joinedVal,
                            vals = node.attr[attribName];
                        if(Array.isArray(vals)) {
                            joinedVal = vals.join('|');
                        } else {
                            joinedVal = vals;
                            vals = [vals];
                        }
                        if(vals.length > 0) {
                            if(!nodeValsFreq[joinedVal]) {
                                nodeValsFreq[joinedVal] = 0;
                            }
                            ++nodeValsFreq[joinedVal];
                        }
                        // This should not happen now
                        // if( !(vals instanceof Array) ) {     // if first time called on attribute, convert to array of strings
                        //     throw new Error("Found a liststring! OMG! attrId: " + attribName, node);
                        //     vals = vals.trim();             // remove leading or trailing whitespace
                        //     vals = vals.split(re);          // split
                        //     vals = _.filter(vals, function(val) { return val.length > 0;}); // it is empty or a special char.
                        //     if(vals.length === 0) {
                        //         delete node.attr[attribName];
                        //         continue;
                        //     } else {
                        //         node.attr[attribName] = vals;
                        //     }
                        // }
                        valCount++;
                        for(j = 0; j < vals.length; j++) {
                            val = vals[j];
                            tagFrequency[val] = tagFrequency[val] ? tagFrequency[val]+1 : 1;
                        }
                    }
                }
                var counts = {}, tagCountTotal = 0, maxTagFrequency = 1, nUniqueTags = 0;
                _.forOwn(tagFrequency, function(val, key) {
                    nUniqueTags += 1;
                    tagCountTotal += val;
                    counts[key] = val;
                    maxTagFrequency = maxTagFrequency > counts[key] ? maxTagFrequency : counts[key];
                });
                destination.nAttrValues = valCount; // no of nodes with this attr
                destination.nValues = tagCountTotal; // total occurances of tags with duplicates
                destination.nUniqueTags = nUniqueTags; // no of tags in the data
                destination.maxTagFreq = maxTagFrequency;
                destination.nodeValsFreq = nodeValsFreq;
                destination.isSingleton = nodes.reduce(function(acc, cv) {
                    var attrValue = cv.attr[attribName];
                    if (attrValue && _.isArray(attrValue)) {
                        acc.fraction += (attrValue.length > 1 ? 0 : 1) / nodes.length;
                    } else {
                        acc.fraction += 1 / nodes.length;
                    }
                    return acc;
                }, { fraction: 0 }).fraction > SINGLETONE_TAG_FRACTION;
                _nonNumericHelper(destination, counts);
            }

            // find out the num of bins needed
            function _setNBins(attrInfo) {
                var nBins = 20;           // 5% per bin
                // set bins for integers with a small range of values
                if( attrInfo.isInteger && (attrInfo.bounds.max - attrInfo.bounds.min) < 40 ) {
                    nBins = attrInfo.bounds.max - attrInfo.bounds.min + 1;
                }
                return nBins;
            }

            function _buildBins ( attrInfo) {
                var nBins = _setNBins(attrInfo),
                    max = attrInfo.stats.max, min = attrInfo.stats.min,
                    isInt = attrInfo.isInteger,
                    values = attrInfo.values;
                var i, delta = (max - min)/nBins;
                var binSizes = [];

                for(i = 0; i < nBins; i++) {
                    var binMin = min + i * delta;
                    var binMax = (i == nBins - 1) ? max : (min + (i +1) * delta);
                    if( isInt ) {
                        binMin = Math.ceil(binMin);
                        binMax = Math.floor(binMax);
                    }
                    binSizes[i] = {
                        numFrac: 0, // fraction of max count
                        count: 0, // num of values in this bin
                        min: binMin,
                        max: binMax
                    };
                }
                // count values in each bin and track max count
                var maxCount = 0;
                for( i = 0; i < values.length; i++) {
                    var val = values[i];
                    var binIdx;
                    if( delta > 0 ) {
                        binIdx = Math.floor((val-min)/delta);
                    } else {    // all the same value
                        binIdx = Math.floor(nBins*i/values.length);
                    }
                    // protect against rounding errors
                    if(binIdx == nBins) {
                        binIdx--;
                    } else if( binIdx < 0 ) {
                        binIdx = 0;
                    }
                    var bin = binSizes[binIdx];
                    var count = bin.count += 1;
                    if( count > maxCount ) {
                        maxCount = count;
                    }
                }
                // normalize bin sizes
                for(i = 0; i < nBins; i++) {
                    bin = binSizes[i];
                    bin.numFrac =  bin.count/maxCount;
                }
                attrInfo.nBins = nBins;
                attrInfo.bins = binSizes;
                return binSizes;
            }
        }]);
