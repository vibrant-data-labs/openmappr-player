angular.module('common')
.service('infoPanelService', ['networkService', 'AttrInfoService', 'SelectionSetService', 'dataGraph',
function(networkService, AttrInfoService, SelectionSetService, dataGraph) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getAllNodeGroups = getAllNodeGroups;
    this.getNodesNeighbors = getNodesNeighbors;
    this.getPanelMode = getPanelMode;
    this.getCurrentPanelMode = function() { return panelMode; };

    this.getTopArchetypes = getTopArchetypes;
    this.getTopBridgers = getTopBridgers;



    /*************************************
    ********* Local Data *****************
    **************************************/
    var panelMode;
    var nodeGroups = [];



    /*************************************
    ********* Core Functions *************
    **************************************/

    function getAllNodeGroups(colorByAttr) {
        var groups = [];
        var clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(colorByAttr);
        if(!clusterAttrInfo.isNumeric){
            groups = _getAttrValGroups(colorByAttr);
            groups = groups.concat(_getCustomNodeGroups());
        }
        else {
            console.log(clusterAttrInfo);
            //for numerics just use the legend bins
            groups = _getNumericGroups(colorByAttr);
        }
        nodeGroups = _.clone(groups);
        return groups;
    }

    function getTopArchetypes() {
        var renderableNodesIdx = _.get(dataGraph.getRenderableGraph(), 'graph.nodeIndex', {}),
            clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId('Cluster'),
            clusterInfo = _.get(networkService.getCurrentNetwork(), 'clusterInfo');

        return _.reduce(_.clone(clusterAttrInfo.values).reverse(), function(acc, clusterVal) {
            var topArchs = _.get(clusterInfo[clusterVal], 'topArchetypeNodeIds', []);
            if(_.size(topArchs) > 0) { acc.push(renderableNodesIdx[topArchs[0]]); }
            else { console.warn('Archetypes not found for cluster: ' + clusterVal); }
            return acc;
        }, []);
    }

    function getTopBridgers() {
        var renderableNodesIdx = _.get(dataGraph.getRenderableGraph(), 'graph.nodeIndex', {}),
            clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId('Cluster'),
            clusterInfo = _.get(networkService.getCurrentNetwork(), 'clusterInfo');

        return _.reduce(_.clone(clusterAttrInfo.values).reverse(), function(acc, clusterVal) {
            var topBridgers = _.get(clusterInfo[clusterVal], 'topBridgerNodeIds');
            if(_.size(topBridgers) > 0) { acc.push(renderableNodesIdx[topBridgers[0]]); }
            else { console.warn('Bridgers not found for cluster: ' + clusterVal); }
            return acc;
        }, []);
    }

    function getPanelMode(selNodes, nodeColorAttr) {
        var mode;
        if(!_.isArray(selNodes)) { throw new Error('Array expected for nodes'); }
        if(selNodes.length === 0) {
            mode = 'network';
        }
        else if(selNodes.length === 1) {
            mode = 'node';
        }
        else if(selNodes.length > 1) {
            mode = 'selection';
            if(nodeColorAttr == 'Cluster') {
                var clusterVal = networkService.getSelectionClusterVal(selNodes, nodeColorAttr);
                if(clusterVal && dataGraph.getNodesForPartition('Cluster', clusterVal).length == selNodes.length) {
                    mode = 'cluster';
                }
            }
        }
        panelMode = mode;

        return mode;
    }

    function getNodesNeighbors(nodes) {
        var rawData = dataGraph.getRawDataUnsafe(),
            renderableNodesIdx = _.get(dataGraph.getRenderableGraph(), 'graph.nodeIndex', {});

        return _.reduce(nodes, function(acc, node) {
            var uniqNbrIds = _(rawData.getAllNeighbours(node.id))
                        .filter(function(nbr) { return !acc[nbr.id]; })
                        .map('id')
                        .value();
            _.assign(acc, _.pick(renderableNodesIdx, uniqNbrIds));
            return acc;
        }, {});
    }

    function _getNodeIdsForGroup(attr, groupName) {
        return _(dataGraph.getNodesForPartition(attr, groupName))
                .sortBy('attr.ClusterArchetype')
                .reverse()
                .map('id')
                .value();
    }

    function _getNodeIdsForCustomGroup(groupName) {
        return _.find(SelectionSetService.getSelectionVMs(), 'selName', groupName).getNodeIds();
    }

    function _getNodeIdsForNumericGroup(attr, groupMinVal, groupMaxVal) {
        return dataGraph.getNodesByAttribRange(attr, groupMinVal, groupMaxVal);
    }

    function _filterRenderableNodeIds(nodeIds) {
        console.log('Filtering out nodes which are not in rendered graph');
        var rgNodesMap = _.get(dataGraph.getRenderableGraph(), 'graph.nodeIndex', {});
        return _.filter(nodeIds, function(nodeId) {
            return rgNodesMap.hasOwnProperty(nodeId);
        });
    }

    function _getAttrValGroups(colorByAttr) {
        var clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(colorByAttr);
        var clusterNwProps = ['nIntraClus', 'nLinks', 'nNodes', 'significance'];
        var clustersMap;
        var renderableNodesIdx = _.get(dataGraph.getRenderableGraph(), 'graph.nodeIndex', {});
        var valsCount = clusterAttrInfo.isTag
            ? clusterAttrInfo.nodeValsFreq
            : clusterAttrInfo.valuesCount;
        if(!clusterAttrInfo) { throw new Error('Cluster attr info not found'); }

        if(colorByAttr == 'Cluster') {
            clustersMap = _.get(networkService.getCurrentNetwork(), 'clusterInfo');
        }
        return _.reduce(valsCount, function(acc, val, key) {
            var groupNodeIds = _filterRenderableNodeIds(_getNodeIdsForGroup(colorByAttr, key));
            var groupInfoObj = {
                name: key,
                type: 'cluster',
                nodeCount: val,
                nodeIds: groupNodeIds,
                neighborGroups: _getNeighborGroups(colorByAttr, key),
                clusterInfo: {},
                colorStr: _.get(renderableNodesIdx[groupNodeIds[0]], 'colorStr', '')
            };
            if(colorByAttr == 'Cluster') {
                groupInfoObj.clusterInfo = _.pick(clustersMap[key], clusterNwProps);
            }
            acc.push(groupInfoObj);
            return acc;
        }, []);
    }

    function _getCustomNodeGroups() {
        return _.reduce(SelectionSetService.getSelectionVMs(), function(acc, val) {
            if(val.dpIDs.length !== 0) {
                acc.push({
                    name: val.selName,
                    type: 'customGroup',
                    nodeCount: val.dpIDs.length,
                    nodeIds: _filterRenderableNodeIds(_getNodeIdsForCustomGroup(val.selName)),
                    neighborGroups: []
                });
            }
            return acc;
        }, []);
    }

    function _getNumericGroups(colorByAttr) {
        var clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(colorByAttr);
        var numericBins = ['max', 'quantile_75', 'quantile_50', 'quantile_25', 'min'];
        return _.map(numericBins, function(bin) {
            var max = clusterAttrInfo.bounds[bin];
            var binIdx = numericBins.indexOf(bin);
            var min = binIdx == numericBins.length - 1 ? 0 : clusterAttrInfo[numericBins[numericBins.indexOf(bin) + 1]];
            return {
                name: bin,
                type: 'numericBin',
                max: max,
                min: min,
                nodeIds: _filterRenderableNodeIds(_getNodeIdsForNumericGroup(colorByAttr, min, max)),
                neighborGroups: []
            };
        });
        // return [
        //  {name: 'max', type: 'numericBin', max :clusterAttrInfo.bounds['max'], min :clusterAttrInfo.bounds['quantile_75']},
        //  {name: 'quantile_75', type: 'numericBin', max :clusterAttrInfo.bounds['quantile_75'], min :clusterAttrInfo.bounds['quantile_50']},
        //  {name: 'quantile_50', type: 'numericBin', max :clusterAttrInfo.bounds['quantile_50'], min :clusterAttrInfo.bounds['quantile_25']},
        //  {name: 'quantile_25', type: 'numericBin', max :clusterAttrInfo.bounds['quantile_25'], min :clusterAttrInfo.bounds['min']},
        //  {name: 'min', type: 'numericBin', max :clusterAttrInfo.bounds['min'], min : 0}
        // ];
    }

    function _getNeighborGroups(colorByAttr, groupVal) {
        var clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(colorByAttr);
        if(!clusterAttrInfo) { throw new Error('Cluster attr info not found'); }
        var rawData = dataGraph.getRawDataUnsafe();

        var neighborGroups = _(dataGraph.getNodesForPartition(colorByAttr, groupVal))
                                .map(function(node) { return rawData.getAllNeighbours(node.id); })
                                .flatten()
                                .indexBy('id')
                                .values()
                                .reject(function(node) { return node.attr[colorByAttr] == groupVal; })
                                .map(function(node) { return node.attr[colorByAttr]; })
                                .uniq()
                                .value();

        // console.log('Neighbor groups for group ' + groupVal + ' : ', neighborGroups);
        return neighborGroups;
    }

}
]);
