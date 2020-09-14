# -*- coding: utf-8 -*-
"""
Created on Wed Aug 13 14:32:47 2014

@author: rich
"""

import ast
import math
import networkx as nx
from athena.algorithms.NetworkAnalysis.ComputeTrophicLevel import computeTL
from athena.algorithms.NetworkAnalysis.Components import componentIDs
from athena.algorithms.NetworkAnalysis.ClusteringProperties import basicClusteringProperties
from athena.algorithms.NetworkAnalysis.Louvain import generate_dendrogram
from athena.algorithms.NetworkAnalysis.Louvain import partition_at_level
from athena.algorithms.NetworkAnalysis.Louvain import modularity
from athena.algorithms.DataToNetwork.ClusterInfo import getClusterInfo
from athena.algorithms.DataToNetwork.ClusterInfo import addClusterPropertyInfo

#################################################################
# given a networkX graph, build list of node data including all attributes
#
def nodeDataFromNetworkX(g):
    nodeData = []
    for node, nodeDat in g.nodes_iter(data=True):
        newData = nodeDat.copy()
        newData['id'] = node
        nodeData.append(newData)
    return nodeData

# given a networkX graph, build list of link data including all attributes
#
def linkDataFromNetworkX(g):
    la = 'linkingAttributes'
    linkData = []
    for n1, n2, linkDat in g.edges_iter(data=True):
        newData = linkDat.copy()
        if la in newData:
            newData[la] = [tuple(val) for val in ast.literal_eval(newData[la])]
        newData['id1'] = n1
        newData['id2'] = n2
        linkData.append(newData)
    return linkData

################################################################
#
# basic network methods
#
def nodeCount(network):
    return len(network)

def linkCount(network):
    return len(network.edges())

def linksPerNode(network):
    nodes = nodeCount(network)
    return 0 if nodes == 0 else float(linkCount(network))/nodes

# return connectance for directed and undireted networks
#
def connectance(network):
    nodes = nodeCount(network)
    links = linkCount(network)
    if nodes == 0:
        return 0
    if isinstance(network, nx.DiGraph):
        if nodes == 1:
            return 0
        return float(2*links)/(nodes*(nodes-1))
    return float(links)/(nodes*nodes)

################################################################
#
# network property computation
#
networkPropertyFns = {
    'linkspernode': linksPerNode,
    'connectance': connectance,
    'links' : linkCount,
    'clustering' : nx.average_clustering,
    'avgshortestpath' : nx.average_shortest_path_length,
}

# network is a networkx network
# property is a property name
#
def computeNetworkProperty(network, prop):
    try:
        return networkPropertyFns[prop](network)
    except (nx.NetworkXError, AttributeError):
        return None

# network is a networkx network
# properties is an array of property names
#
def addNetworkProperties(network, properties):
    if len(properties) == 0:
        properties = networkPropertyFns.keys()
    for prop in properties:
        result = computeNetworkProperty(network, prop)
        if result is not None:
            # add results to network attributes
            network.graph[prop] = result

#####################################################################
#
# node property computation
# if 'directed' is True, network must be a directed,
# otherwise property is computed on either directed or undirected network
#

def degree(g):
    return g.degree()

def in_degree(g):
    return g.in_degree()

def out_degree(g):
    return g.out_degree()

nodePropertyFns = {
    'degree': dict(fn=degree, type='any', default=True),
    'inDegree': dict(fn=in_degree, type='directed', default=True),
    'outDegree': dict(fn=out_degree, type='directed', default=True),
    'clusterCoeff': dict(fn=nx.clustering, type='undirected', default=True),
    'triangles': dict(fn=nx.triangles, type='undirected', default=True),
    'betweennessCentrality' : dict(fn=nx.betweenness_centrality, type='any', default=False),
    'closenessCentrality' : dict(fn=nx.closeness_centrality, type='any', default=False),
    'componentId' : dict(fn=componentIDs, type='any', default=True),
    'trophicLevel' : dict(fn=computeTL, type='directed', default=True),
    'pagerank' : dict(fn=nx.pagerank_scipy, type='directed', default=True)
}

# network is a networkx network
# property is a property name
#
def computeNodeProperty(nw, unw, prop, defaultsOnly):
    try:
        propFn = nodePropertyFns[prop]
        typeMatches = propFn['type'] == 'any' \
                      or (propFn['type'] == 'directed' and isinstance(nw, nx.DiGraph)) \
                      or (propFn['type'] == 'undirected' and not isinstance(nw, nx.Graph))
        if (not defaultsOnly or propFn['default']) and typeMatches:
            # use undirected version for some properties
            if isinstance(nw, nx.DiGraph) and propFn['type'] == 'any':
                nw = unw
            return propFn['fn'](nw)
        else:
            return None
    except AttributeError:
        return None

# network is a networkx network
# properties is an array of property names
#
def addNodeProperties(network, properties):
    if len(properties) == 0:
        properties = nodePropertyFns.keys()
        defaultsOnly = True
    else:
        defaultsOnly = False
    added = []
    undirectedNw = nx.Graph(network) if isinstance(network, nx.DiGraph) else network
    for prop in properties:
        result = computeNodeProperty(network, undirectedNw, prop, defaultsOnly)
        if result is not None:
            # add results to networkx node attributes
            for nodeId, attrs in network.node.iteritems():
                attrs[prop] = result[nodeId]
            added.append(prop)
    return added
#####################################################################
louvainName = 'Cluster'

def louvain(g, clusterLevel):
    def mergePartitionData(g, p, name):
        for node,data in g.nodes_iter(data=True):
            if node in p:
                lVal = name + '_' + str(p[node])
                data[name] = lVal
            else:
                data[name] = None

    def getPartitioning(i, g, results, dendo, clusterings):
        p = partition_at_level(dendo, len(dendo) - 1 - i )
        clustering = "Cluster"
        mod = "modularity"
        mergePartitionData(results, p, clustering)
        clusterings.append(clustering)
        results.graph[mod] = modularity(p, g)

    if isinstance(g, nx.DiGraph):
        gg = nx.Graph(g)
    else:
        gg = g
    clusterings = []
    dendo = generate_dendrogram(gg)
#    for i in range(len(dendo)):
#        getPartitioning(i, g, dendo, clusterings)
    depth = min(clusterLevel, len(dendo) - 1)
    getPartitioning(depth, gg, g, dendo, clusterings)
    return clusterings

#
# cluster property computation
#
clusteringFns = {
    'louvain': louvain
}

clusterPropertyFns = {
    'basic': basicClusteringProperties
}

# network is a networkx network
# clustering is a property name
#
def computeClustering(network, clustering, clusterLevel=0):
    try:
        return clusteringFns[clustering](network, clusterLevel)
    except AttributeError:
        return None

# network is a networkx network
# property is a property name
#
def _computeClusterProperty(network, prop, clusterProp):
    try:
        return clusterPropertyFns[prop](network, clusterProp)
    except AttributeError:
        return None

# network is a networkx network
# properties is an array of property names
# properties are computed for a particular clustering
#
def addClusterProperties(network, properties, clusterProp):
    if len(properties) == 0:
        properties = clusterPropertyFns.keys()
    failed = []
    for prop in properties:
        results = _computeClusterProperty(network, prop, clusterProp)
        if results is not None:
            # add results to networkx node attributes
            for resultProp, result in results.iteritems():
                for nodeId, attrs in network.node.iteritems():
                    attrs[resultProp] = result[nodeId]
        else:
            failed.append(prop)
    return failed

###########################################################################
def computeClusterMean(clusterNodes, prop, clusterProp):
    for cl, nodes in clusterNodes:
        tot = 0
        count = 0
        for node in nodes:
            val = node[prop]
            if val != None and isinstance(val, (int, float)) and not math.isnan(val):
                tot += val
                count += 1
        val = 0 if count == 0 else float(tot)/count
        pName = prop + '_' + clusterProp + '_' + 'Mean'
        for node in nodes:
            node[pName] = val

def computeClusterMedian(clusterNodes, prop, clusterProp):
    return None

def computeClusterMode(clusterNodes, prop, clusterProp):
    for cl, nodes in clusterNodes:
        valCount = {}
        for node in nodes:
            val = node[prop]
            if val != None:
                val = str(val)
                if val not in valCount:
                    valCount[val] = 0
                valCount[val] += 1
        maxVal = None
        maxCount = 0
        for val, count in valCount:
            if count > maxCount:
                maxVal = val
        pName = prop + '_' + clusterProp + '_' + 'Mode'
        for node in nodes:
            node[pName] = maxVal

def computeClusterMin(clusterNodes, prop, clusterProp):
    return None

def computeClusterMax(clusterNodes, prop, clusterProp):
    return None

def computeClusterTop2(clusterNodes, prop, clusterProp):
    return None

def computeClusterTop3(clusterNodes, prop, clusterProp):
    return None

def _GetNodeGroups(network, clusterProp):
    clusterNodes = {}
    for node in network:
        cl = node[clusterProp]
        if cl not in clusterNodes:
            clusterNodes[cl] = []
        clusterNodes[cl].append(node)
    return clusterNodes

clusterPropertyAggregationFns = {
    'Mean': computeClusterMean,
    'Median': computeClusterMedian,
    'Mode': computeClusterMode,
    'Min': computeClusterMin,
    'Max': computeClusterMax,
    'Top2': computeClusterTop2,
    'Top3': computeClusterTop3
}

# network is a networkx network
# property is a property name
# agg is an aggregation operation
#
def _computeClusterAggregateProperty(network, prop, agg, clusterProp):
    try:
        return clusterPropertyFns[prop](network, clusterProp)
    except AttributeError:
        return None

# network is a networkx network
# properties is an array of node property names
# aggregation is one or more aggregation operation
# properties are aggregated for a particular clustering
#
def computeClusterAggregateProperties(network, aggData, clusterings):
    failed = []
    if len(aggData) == 0:
        return failed
    for prop, data in aggData:
        if data['aggregationOp'] in clusterPropertyAggregationFns:
            aggName = data['aggregationOp']
            agg = clusterPropertyAggregationFns[aggName]
            for clusterProp in clusterings:
                results = _computeClusterAggregateProperty(network, prop, agg, clusterProp)
                if results is not None:
                    # add results to networkx node attributes
                    for resultProp, result in results.iteritems():
                        resultProp = resultProp + '_' + aggName
                        for nodeId, attrs in network.node.iteritems():
                            attrs[resultProp] = result[nodeId]
                else:
                    failed.append(prop + '_' + aggName)
    return failed

# get clusterInfo data for each clustering
#
def addClusterInfo(nw, clusterings, clusterProperties, nLinkingAttr, clusterInfo, nodeAttrs, exclude, algo, mergeDuplicates=False, sigAttr=False):
    # get attributes to test for significance
    # if type is unknown scan data for each attribute to determine type
    # if type is string, scan to see whether it needs to be processed (all-unique strings can be ignored)
    # excludeAttrs are computed network attributes (degree etc)
    ignoreAttr = ['__originalId__', 'id', 'dataPointId', 'componentId', 'Cluster', 'Cluster1', 'Cluster2', \
                    'Cluster3', 'Cluster4', 'Cluster5', 'InterclusterFraction', 'ClusterDiversity', \
                    'ClusterBridging', 'ClusterArchetype', 'ParentNetworkColor']
    ignorePrefix = ['centrality_', 'bridging_', 'diversity_', 'fracIntergroup_', 'Original']
    def getAttributes(nodeData, nodeAttrs, excludeAttr):
        finalAttr = []
        # get attributes in nodeData
        a = set(nodeData[0].keys())
        for i in range(1, min(100, len(nodeData))):
            a.update(nodeData[i].keys())
        # scan each attribute to determine its type
        for attr in a:
            if ((nodeAttrs and attr not in nodeAttrs) or
              attr in ignoreAttr or
              attr in excludeAttr or
              len([s for s in ignorePrefix if attr.startswith(s)]) > 0):
                continue
            aType = nodeAttrs[attr] if (nodeAttrs and attr in nodeAttrs) else None
            if aType == None or aType == 'string':
                # extract values from the first 100 records
                values = [node[attr] for node in nodeData[:100] if attr in node and node[attr] != None]
                if len(values) > 20:        # at least 20% must have values
                    if all(isinstance(x, (int, long, float)) for x in values):
                        aType = 'numeric'
                    elif all(isinstance(x, basestring) for x in values):
                        nUnique = len(set(values))
                        nVal = len(values)
                        # look for | delimiter in tag values
                        if aType == None and len([x for x in values if '|' in x]) > 0:
                            aType = 'tag'
                        # analyze string values that are not mostly different
                        elif nUnique < 0.9*nVal:
                            aType = 'string'
                        else:
                            aType = None
            if aType != None:
                finalAttr.append({'name' : attr, 'type': aType})
        return finalAttr

    def mergeDuplicateClusters(clInfo, nodeData, clName):
        names = set([info['linkingAttrName'] for info in clInfo if 'linkingAttrName' in info])
        if len(names) < len(clInfo):    # less names than clusters means there are duplicates
            nameIdx = dict(zip(names, range(len(names))))
            clusterMap = {info['linkingAttrName']: 'cluster'+str(nameIdx[info['linkingAttrName']]) for info in clInfo if 'linkingAttrName' in info}
            print("ClusterMap")
            print(clusterMap)
            for nd in nodeData:
                if nd[clName] in clusterMap:
                    nd[clName] = clusterMap[nd[clName]]
            return True
        return False

    print('Adding cluster info')
    nodeData = nodeDataFromNetworkX(nw)
    linkData = linkDataFromNetworkX(nw)
    attrs = getAttributes(nodeData, nodeAttrs, exclude)
    for cl in clusterings:
        clusterInfo[cl] = getClusterInfo(nodeData, linkData, cl, nLinkingAttr, attrs, algo, mergeDuplicates=mergeDuplicates).values()
        if mergeDuplicates and mergeDuplicateClusters(clusterInfo[cl], nodeData, cl):
            addClusterProperties(nw, clusterProperties, cl)
            clusterInfo[cl] = getClusterInfo(nodeData, linkData, cl, nLinkingAttr, attrs, algo).values()
        addClusterPropertyInfo(nodeData, clusterInfo[cl], cl, attrs, algo, sigAttr=sigAttr)
    # move names from nodeData to nw by copying all node attrs back into nw
    for data in nodeData:
        node = nw.node[data['id']]
        for attr in data:
            if attr != 'id':
                node[attr] = data[attr]

####################################################################
#
# entry point for property computations on networkx network
# nodeProperties and networkProperties are lists of property names
# clusterProperties is a list of property names that are computed across each cluster
# clusterings is a list of clustering names
# if lists are empty, then all known properties in that category are computed
# except for betweennessCentrality and clusterCoeff, as these are slow
#
def computeNetworkProperties(network, algo, propertyparams=None, ctrlparams=None):
    clusterInfo = {}
    addedProperties = []
    if propertyparams == None or len(propertyparams) == 0:  # compute all properties if none are specified
        propertyparams = {'networkProperties': [], 'nodeProperties': [], 'clusterProperties': [], 'clusterings': []}
    if ctrlparams == None or 'clusterLevel' not in ctrlparams:
        ctrlparams = {'clusterLevel': 0}
    if 'networkProperties' in propertyparams:
        print('Computing network properties')
        addNetworkProperties(network, propertyparams['networkProperties'])
    if 'nodeProperties' in propertyparams:
        print('Computing node properties')
        addedProperties = addNodeProperties(network, propertyparams['nodeProperties'])
    if 'clusterProperties' in propertyparams and 'clusterings' in propertyparams:
        clusterings = propertyparams['clusterings']
        if len(clusterings) == 0:
            clusterings = clusteringFns.keys()
        print('Computing cluster properties ' + str(clusterings))
        for clustering in clusterings:
            clProps = computeClustering(network, clustering, ctrlparams['clusterLevel'])
            print("[computeNetworkProperties]")
            print clProps
            if clProps != None:
                for clProp in clProps:
                    addClusterProperties(network, propertyparams['clusterProperties'], clProp)
                addClusterInfo(network,
                    clProps,
                    propertyparams['clusterProperties'],
                    ctrlparams['nLinkingAttr'] if 'nLinkingAttr' in ctrlparams else None,
                    clusterInfo,
                    ctrlparams['nodeAttrs'],
                    addedProperties,
                    algo,
                    mergeDuplicates=ctrlparams['mergeDuplicates'],
                    sigAttr=ctrlparams.get('sigAttr', False))
    return [{'name': k, 'clusters': v} for k, v in clusterInfo.iteritems()]

# return lists of the different properties available
#
def getAvailableProperties():
    return {'networkProperties': networkPropertyFns.keys(),
            'nodeProperties': nodePropertyFns.keys(),
            'clusterings': clusteringFns.keys(),
            'clusterProperties': clusterPropertyFns.keys(),
            }
