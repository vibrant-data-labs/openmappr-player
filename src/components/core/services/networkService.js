/**
* APIs describing/manipulating the current network and info about other networks in the project
*/
angular.module('common')
.service('networkService',['$http', '$q', '$timeout', '$rootScope', 'projFactory', 'AttrSanitizeService', 'BROADCAST_MESSAGES' , 'extAPIService',
function ($http, $q, $timeout, $rootScope, projFactory, AttrSanitizeService, BROADCAST_MESSAGES, extAPIService) {
    'use strict';



    /*************************************
    *************** API ******************
    **************************************/
    this.clear = function() {
        loadedNetworks = {};
        currentNWId = null;
    };
    this.fetchProjectNetworksLocally = fetchProjectNetworksLocally;
    this.fetchProjectNetwork = fetchProjectNetwork;
    this.refreshAllNetworks = refreshAllNetworks;
    this.loadNetworksFromS3= loadNetworksFromS3;
    this.getDefault = getDefault;
    this.exist = exist;
    this.getNetworks=function() { return loadedNetworks; };
    this.getCurrentNetwork= function() {
        return loadedNetworks[currentNWId];
    };
    this.setCurrentNetwork= function(nwId) {
        currentNWId = nwId;
        _currentNetworkDefer.resolve(loadedNetworks[currentNWId]);
    };
    this.createSubNetwork = createSubNetwork;
    this.changeDataPointCatNames = extAPIService.processInQueue(changeDataPointCatNames);
    this.getNetworksByProject= getNetworksByProject;
    this.switchNetwork= switchNetwork;
    this.deCacheNetwork= deCacheNetwork;
    this.updateNetwork = updateNetwork;
    this.updateNetworkAttrs= extAPIService.processInQueue(updateNetworkAttrs);
    this.deleteNetwork= deleteNetwork;
    this.getLastModifiedNetwork= getLastModifiedNetwork;
    this.getNetworkAttrs= getNetworkAttrs;
    this.currNetNeedsReGen= currNetNeedsReGen;
    this.hasNetworkProps= hasNetworkProps;
    this.getSelectionClusterVal= getSelectionClusterVal;
    this.updateNetworks = updateNetworks;
    this.getCurrentNetworkPromisified = function() {
        if(currentNWId) {
            return $q.when(loadedNetworks[currentNWId]);
        } else {
            return _currentNetworkDefer.promise;
        }
    }


    /*************************************
    ********* Local Data *****************
    **************************************/
    var loadedNetworks = {};
    var currentNWId = null;
    var _currentNetworkDefer = $q.defer();
    // var logPrefix = 'networkService: ';

    // Copied from DataUtils.js
    var reserved_nw_attr_names = ['Cluster', 'Cluster1', 'Cluster2', 'Cluster3', 'Cluster4',
        'ClusterArchetype', 'centrality_Clusters', 'centrality_Cluster1', 'centrality_Cluster2', 'centrality_Cluster3', 'centrality_Cluster4',
        'ClusterDiversity', 'diversity_Clusters', 'diversity_Cluster1', 'diversity_Cluster2', 'diversity_Cluster3', 'diversity_Cluster4',
        'InterclusterFraction', 'fracIntergroup_Clusters', 'fracIntergroup_Cluster1', 'fracIntergroup_Cluster2', 'fracIntergroup_Cluster3', 'fracIntergroup_Cluster4',
        'ClusterBridging','bridging_Clusters', 'bridging_Cluster1', 'bridging_Cluster2', 'bridging_Cluster3', 'bridging_Cluster4'
    ];


    /*************************************
    ********* Core Functions *************
    **************************************/
    function getNetworkUrl(networkId) {
        var proj = projFactory.currProjectUnsafe();

        var url = '/api/orgs/' + proj.org.ref + '/projects/' + proj._id + '/networks/' + networkId;
        return url;
    }

    function updateNetworks (networks) {
        console.log("Got networks:", networks);
        // console.log('network json: ', JSON.stringify(networks[0].clusterInfo[0].clusters));
        _.each(networks, function(nw) {
            loadedNetworks[nw.id] = nw;
            _tackleNetworkData(nw);
            _sanitizeClusterInfo(nw);
        });
    }

    function refreshAllNetworks() {
        var networkIds = _.keys(loadedNetworks);
        return $q.all(_.map(networkIds, fetchProjectNetwork));
    }

    // fetch a single network
    function fetchProjectNetwork(networkId) {
        var url = getNetworkUrl(networkId);
        return $http.get(url)
        .then(
            function(result){
                console.log("----------- getting project network: %s", networkId);
                console.log("result", result);
                loadedNetworks[networkId] = result.data;
                _tackleNetworkData(loadedNetworks[networkId]);
                _sanitizeClusterInfo(loadedNetworks[networkId]);
                return loadedNetworks[networkId];
            },
            function(err) {
                console.log("[networkService.fetchProjectNetwork] Unable to fetch network:", err);
                return $q.reject(err);
            }
        );
    }

    function fetchProjectNetworksLocally() {
        return $http.get(DATA_PATH + 'links.json')
            .then(
                function(result){
                    return result.data;
                },
                function(err) {
                    return [];
                }
            );
    }

    function loadNetworksFromS3(playerUrl) {
        return $http.get(playerUrl + 'networks.json')
        .then(function(response) {
            var data = response.data;
            console.log('S3 networks obj: ', data);
            updateNetworks(data);
            return loadedNetworks;
        });
    }

    // Just returns a project's networks. Doesn't effect loaded networks
    function getNetworksByProject(orgId, projId) {
        var url = '/api/orgs/' + orgId + '/projects/' + projId + '/networks';
        return $http.get(url)
        .then(
            function(result){
                console.log("----------- getting project networks");
                console.log("result", result);
                return result.data.networks;
            },
            function(err) {
                console.log("[networkService.getNetworksByProject] Unable to fetch networks:", err);
                loadedNetworks = {};
                return $q.reject(err);
            }
        );
    }

    function hasNetworkProps(networkId) {
        var network = loadedNetworks[networkId];
        if(!network) throw new Error('Network not found');
        var networkProps = _.pluck(network.nodeAttrDescriptors, 'id');
        return _.intersection(networkProps, reserved_nw_attr_names).length > 0;
    }

    function getSelectionClusterVal(nodes, nodeColorAttr) {
        if(!_.isArray(nodes)) throw new Error('Array expected');
        var clusterVal = null;
        if(nodes.length === 0) return clusterVal;

        var refAttrVal = nodes[0].attr[nodeColorAttr];
        var isCluster = _.every(nodes, function(node) {
            return node.attr[nodeColorAttr] == refAttrVal;
        });
        if(isCluster) {
            clusterVal = refAttrVal;
        }
        return clusterVal;
    }

    function getDefault () {
        var nw = _.find(loadedNetworks, 'name', 'default');
        return nw ? nw : _.sample(loadedNetworks);
    }

    function exist (networkId) {
        return !!loadedNetworks[networkId];
    }

    function updateNetwork(networkId, opts) {
        var network = loadedNetworks[networkId];
        var updations = _.pick(opts, ['name', 'description', 'networkInfo']);
        var url = getNetworkUrl(network.id);
        return $http.post(url, updations)
        .then(function(result) {
            var updatedValues = result.data.updatedValues;
            var updatedNWSnapsMap = result.data.updatedNWSnapsMap || {};
            _.assign(loadedNetworks[network.id] , updatedValues);
            $rootScope.$broadcast(BROADCAST_MESSAGES.network.updated, {updatedNWSnapsMap: updatedNWSnapsMap});
            return loadedNetworks[network.id];
        });
    }

    function updateNetworkAttrs(networkId, postObj) {
        var url = getNetworkUrl(networkId) + '/nwattrs';
        return $http.post(url, postObj)
        .then(function(result) {
            return result.data;
        }, function(err) {
            return $q.reject(err);
        });
    }

    function getLastModifiedNetwork() {
        if(_.keys(loadedNetworks).length === 0) throw new Error('No loaded networks');
        return _.reduce(loadedNetworks, function(prev, curr) {
            return curr.dateModified > prev.dateModified ? curr : prev;
        });
    }

    function currNetNeedsReGen() {
        if(!currentNWId) throw new Error('Current network not set');
        return loadedNetworks[currentNWId].needsRegen === true ? true : false;
    }

    // Retuns attrs from network.generator info. Most probably attr IDs
    function getNetworkAttrs(networkId) {
        var result = [];
        var network = loadedNetworks[networkId];
        if(!network) throw new Error('Network not found');
        var genInfo = network.generatorInfo;
        if(_.isObject(genInfo) && genInfo.links_FromAttributes) {
            result = _.pluck(genInfo.links_FromAttributes.questions, 'Question');
        }
        return result;
    }

    function deleteNetwork(networkId, newNetworkId) {
        var url = getNetworkUrl(networkId);
        if(newNetworkId) url += '?newNetworkId=' + newNetworkId;
        return $http.delete(url)
        .then(function(resp) {
            if(_.isObject(resp.data) && resp.data.delNetworkId === networkId) {
                // Network deleted
                delete loadedNetworks[networkId];
                _removeNetworkLayouts(networkId);
                return resp.data;
            }
            else {
                return $q.reject('Network could not be deleted');
            }
        }, function(err) {
            return $q.reject(err);
        });
    }

    function _removeNetworkLayouts(networkId) {
        // Remove network layouts from project settings
        var settings = projFactory.getProjectSettings();
        var settingsChanged = false;
        settings.layouts = _.mapValues(settings.layouts, function(val) {
            var newLayoutsList = _.cloneDeep(_.reject(val, 'networkId', networkId));
            if(val.length !== newLayoutsList.length) {
                settingsChanged = true;
            }
            return newLayoutsList;
        });
    }

    function deCacheNetwork(networkId) {
        loadedNetworks[networkId] = undefined;
    }
    // the network to switch to, alongwith the snapshot to load with
    function switchNetwork(networkId, snapshot, subdueEvent){
        console.log('Switching to network with id: %O', networkId);
        var network = loadedNetworks[networkId];
        var onAvailable = $q.when(network);
        if(!network) {
            // fetch the network
            onAvailable = fetchProjectNetwork(networkId);
        }

        return onAvailable
        .then(function(network) {
            console.log('Switching to network: %O', network);
            currentNWId = network.id;
            if(!subdueEvent) {
                $rootScope.$broadcast(BROADCAST_MESSAGES.network.changed, { network : network , snapshot : snapshot });
            }
            return network;
        });
    }

    function createSubNetwork(parentNwId, nodeIds, linkIds, nodeColorMap) {
        var currentSubNwCount = _.filter(loadedNetworks, "generatorInfo.subGraph.parentNWId", parentNwId).length;
        currentSubNwCount++;

        var url = getNetworkUrl(parentNwId) + '/sub_graph';
        return $http.post(url, {
            parentNwId : parentNwId,
            nodeIds : nodeIds,
            linkIds : linkIds,
            networkName: loadedNetworks[parentNwId].name + "_sub_" + currentSubNwCount,
            nodeColorMap : nodeColorMap
        }).then(function(respData) { return respData.data.networkId; });
    }
    function changeDataPointCatNames(networkId, attrId, oldVal_newValMap) {
        var network = loadedNetworks[networkId];
        _.each(network.nodes, function(dp) {
            if(dp.attr[attrId] != null) {
                var oldVal = dp.attr[attrId];
                dp.attr[attrId] = oldVal_newValMap[oldVal] != null ? oldVal_newValMap[oldVal] : oldVal;
            }
        });

        // Update cluster names in cluster info object
        _.each(oldVal_newValMap, function(newClusterName, oldClusterName) {
            var clusterInfo = network.clusterInfo;
            clusterInfo[newClusterName] = clusterInfo[oldClusterName];
            clusterInfo[newClusterName].title = newClusterName;
            delete clusterInfo[oldClusterName];
        });

        var url = getNetworkUrl(networkId) + '/nodes/update_attr_cat_names';
        return $http.post(url, {
            networkId : networkId,
            attrId : attrId,
            updationMap : oldVal_newValMap
        })
        .then(function(respData) {
            console.log("Updation successful.", respData.data);
            return respData.data;
        });
    }

    function _tackleNetworkData(network) {
        _.each(network.nodeAttrDescriptors, function(attrDesc) {
            AttrSanitizeService.sanitizeAttr(attrDesc, network.nodes);
        });
        _.each(network.linkAttrDescriptors, function(attrDesc) {
            AttrSanitizeService.sanitizeAttr(attrDesc, network.links);
        });

        // Generate attrs values count
        var attrsMap = {};
        _.each(network.nodes, function(node) {
            _.each(node.attr, function(val, key) {
                if(_.has(attrsMap, key)) {
                    attrsMap[key]++;
                }
                else {
                    attrsMap[key] = 1;
                }
            });
        });

        _.each(network.nodeAttrDescriptors, function(attrDesc) {
            attrDesc.valuesCount = attrsMap[attrDesc.id];
        });
        // remove duplicate links
        var linkIdx = _.indexBy(network.links, 'id');
        network.links = _.reduce(network.links, function(acc, link) {
            if(linkIdx[link.id]) {
                delete linkIdx[link.id];
                acc.push(link);
            }
            return acc;
        }, []);

        if(_.isObject(network.networkInfo) && network.networkInfo.hideArchsBridgers == null) {
            network.networkInfo.hideArchsBridgers = true;
        }
        return network;
    }

    function _sanitizeClusterInfo(network) {
        var clustersList = _.get(network, 'clusterInfo[0].clusters');
        var clusterInfo = {};

        if(_.isEmpty(clustersList)) { return console.warn('Network doesn\'t have clusterInfo'); }

        var defClusterInfo = clustersList[0].linkingAttrName != null
            ? _.indexBy(clustersList, 'linkingAttrName')
            : _.indexBy(clustersList, 'label');
        _.each(defClusterInfo, function(cluster, clusterName) {
            var newClusterObj = _.omit(cluster, ['MostCentral', 'Bridgers', 'id', 'title']);

            // Sanitize cluster property names
            if(cluster.MostCentral) { newClusterObj.topArchetypeNodeIds = cluster.MostCentral; }
            if(cluster.Bridgers) { newClusterObj.topBridgerNodeIds = cluster.Bridgers; }
            newClusterObj.id = cluster.label;
            newClusterObj.title = cluster.linkingAttrName;

            clusterInfo[clusterName] = newClusterObj;
        });

        if(_.keys(clusterInfo).length === 0) { throw new Error('Cluster Info generated is empty.'); }

        network.clusterInfo = clusterInfo;
    }

}]);
