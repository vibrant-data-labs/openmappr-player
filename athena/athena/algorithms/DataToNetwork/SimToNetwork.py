# -*- coding: utf-8 -*-
"""
Created on Wed Jun 25 09:49:22 2014

@author: richwilliams
"""

import networkx as nx
import math
import numpy as np
import numpy.random as rnd
import scipy.stats as sps

from athena.algorithms.NetworkAnalysis.ComputeProperties import computeNetworkProperties
from athena.algorithms.NetworkAnalysis.ComputeProperties import computeClustering
from athena.algorithms.NetworkAnalysis.ForceDirected.ForceDirected import forceDirectedLayout
from athena.algorithms.DataToNetwork.ClusterInfo import getClusterLinkingInfo

# locally adaptive threshold based on local link weight distribution, inspired by Foti et al 2011
#
def _locallyAdaptiveThreshold(simMat, nLinks):
    nNodes = simMat.shape[0]
    # normalize each row
    norms = np.linalg.norm(simMat, axis=1, keepdims=True)
    # get number of non-zero in each row
    nnz = (simMat != 0).sum(1)
    # scale link weights: normalize and then multiply by number that are non-zero
    # so links with val > 1 are more likely than random
    scaledSim = np.multiply((simMat / norms), nnz)
    # find threshold in the scaled weights
    idx = nNodes * nNodes - nLinks - 1
    thr = scaledSim.flatten()
    thr.partition(idx)
    threshold = float(thr[:, idx])
    # threshold the scaled matrix and then de-scale
    simMat = np.multiply(np.matrix(sps.threshold(scaledSim, threshold, None, 0)), norms) / nnz
    return simMat


def _minmaxThreshold(simMat, targetL):
    nNodes = simMat.shape[0]
    targetL *= 0.75  # heuristic adjustment to get roughly the right number of (undirected) links
    # maxVals = simMat.copy()
    maxVals = simMat.max(axis=1)
    # print("MaxVals: " + str(maxVals))
    maxVals[maxVals == 0.0] = 1.0  # set max of empty rows to max possible sim value
    threshold = float(min(maxVals))
    thrSimMat = sps.threshold(simMat, threshmin=threshold, threshmax=None, newval=0)
    nLinks = np.count_nonzero(thrSimMat)
    print("Thresholded to %d links" % nLinks)
    if nLinks < targetL:  # thresolding cut off too many links, use full matrix
        print("Using full matrix")
        thrSimMat = sps.threshold(simMat, threshmin=-1, threshmax=None, newval=0)
        nLinks = np.count_nonzero(thrSimMat)
    if nLinks > targetL:  # thresholding cut off too few links
        newSimMat = np.matrix(np.zeros(simMat.shape))
        frac = float(targetL) / nLinks
        print("Keep frac = %f of the links" % frac)
        # keep frac links in each row
        nLinksRow = [np.count_nonzero(row) for row in thrSimMat]
        for i in range(nNodes):
            rowSim = thrSimMat[i].ravel()
            linksTarget = int(math.floor(frac * nLinksRow[i])) + 1;
            idx = nNodes - linksTarget
            threshold = np.partition(rowSim, idx)[idx]
            rowLinks = sps.threshold(rowSim, threshmin=threshold, threshmax=None, newval=0)
            nRowLinks = np.count_nonzero(rowLinks)
            if nRowLinks > 1.1 * linksTarget:  # got too many, select at random, set unselected to zero
                linkIdx = np.nonzero(rowLinks)[0]  # get indices of nonzero row elements
                linkVals = rowLinks[linkIdx]  # compute link weights  - 0.5*threshold
                topIdx = np.argsort(linkVals)[len(linkVals) - linksTarget:]  # get highest similarity links
                linkIdx = linkIdx[topIdx]
                # linkIdx = rnd.choice(linkIdx, linksTarget, replace=False, p=linkVals/np.sum(linkVals))  # (weighted) random draw the ones to keep
                linkVals = rowLinks[linkIdx]  # save the selected links
                rowLinks = np.zeros(nNodes)  # new links, all zero
                rowLinks[linkIdx] = linkVals  # assign the ones that were saved
            newSimMat[i] = rowLinks
            # print("Row %i contains %f links, should have %d.  Threshold = %f"%(i, np.count_nonzero(newSimMat[i]), frac*nLinksRow[i], threshold))
        simMat = newSimMat
    else:
        simMat = thrSimMat
    return simMat


# keep link if it is in top rank similarities of either end-node
def rankThreshold(simMat, rank):
    count = simMat.shape[0]
    rowidx = np.argpartition(-simMat[i], rank)[:rank]
    colidx = np.argpartition(-simMat.T[i], rank)[:rank]


# threshold similarity matrix computed from feature matrix
# matrix is symmetric, dense
def thresholdSimilarityMatrix(simMat, targetLS, fixed=False, directed=False):
    nNodes = simMat.shape[0]
    targetL = min(targetLS * nNodes, nNodes * (nNodes - 1) / 2)
    nNonZero = np.count_nonzero(simMat)
    print("[SimToNetwork.thresholdSimilarityMatrix] targetL nNonZero " + str(targetL) + ' ' + str(nNonZero))
    if nNonZero > 0:  # sim matrix must have at least one non-zero entry
        targetL *= 2
        if fixed or nNonZero <= targetL:  # keep links with sim above some value
            idx = nNodes * nNodes - (min(targetL, nNonZero) - 1) - 1
            threshold = simMat.flatten()
            threshold.partition(idx)
            print(threshold.shape)
            threshold = float(threshold[idx])
            print("partitioned threshold " + str(threshold))
            simMat = np.matrix(sps.threshold(simMat, threshold, None, 0))
        else:  # threshold by min max sim so all nodes have at least one link, then threshold preserving relative number of links
            simMat = _minmaxThreshold(simMat, targetL)
            # simMat = _locallyAdaptiveThreshold(simMat, targetL)
    if not directed:
        # combine upper and lower triangles into final upper triangular similarity matrix
        upper = np.triu(simMat, 1)  # upper triangle
        lower = np.tril(simMat, -1).T  # transposed lower triangle
        simMat = np.maximum(upper, lower)  # take max
    print("[SimToNetwork.thresholdSimilarityMatrix] newSimMat nNonZero " + str(np.count_nonzero(simMat)))
    return simMat


# build array of non-zero similarities
#
def simMatToArray(simMat):
    nNodes = simMat.shape[0]
    simObj = []
    for i in range(nNodes):
        for j in range(nNodes):
            if simMat[i, j] != 0:
                simObj.append({'id1': i, 'id2': j, 'similarity': simMat[i, j]})
    return simObj


# simObj is array of {id1, id2, similarity}
# and potentially a linkingAttribute that must be forced to a parseable string representation
# nodeData is array of {id, other properties}
def buildNetworkX(simObj, nodeData=None, edgeWtName='similarity', la=None, directed=False):
    g = nx.DiGraph() if directed else nx.Graph()
    # build edges and nodes
    for item in simObj:
        id1 = item['id1']
        id2 = item['id2']
        if not g.has_edge(id1, id2) and not g.has_edge(id2, id1):
            g.add_edge(id1, id2, edgeWtName=item[edgeWtName])
            if la != None and la in item:
                edge = g.edge[id1][id2]
                edge[la] = repr(item[la])
    # add node properties
    if nodeData != None:
        for data in nodeData:
            nodeId = data['id']
            if not g.has_node(nodeId):
                g.add_node(nodeId)
            node = g.node[nodeId]
            for prop, val in data.iteritems():
                if prop != 'id':
                    node[prop] = val
    return g


# input numpy similarity 2d array and list of nodeIds
# output node and link data
def simMatrixToNetwork(simMat, nodeIds, linksPer=4, maxSteps=1000, clumpiness=0.5, doLayout=True, directed=False):
    linkData = simMatToArray(thresholdSimilarityMatrix(simMat, linksPer, directed=directed))
    nodeData = []
    i = 0
    for id in nodeIds:
        nodeData.append({'id': i, 'label': id})
        i += 1
    g = buildNetworkX(linkData, nodeData)
    computeNetworkProperties(g)
    if doLayout == True:
        forceDirectedLayout(g, maxSteps=maxSteps, clumpiness=clumpiness, addToGraph=True)
    # rebuild nodeData with computed properties
    nodeData = nodeDataFromNetworkX(g)
    return (nodeData, linkData)


# given a networkX graph, build list of node data
# include all attributes if mergeData is True
# otherwise remove dataAttr
#
def nodeDataFromNetworkX(g, excludeAttr=None):
    nodeData = []
    for node, nodeDat in g.nodes_iter(data=True):
        if excludeAttr != None:
            newData = {attr: val for attr, val in nodeDat.iteritems() if attr not in excludeAttr}
        else:
            newData = nodeDat.copy()
        newData['id'] = node
        nodeData.append(newData)
    return nodeData


def adaptiveSimMatThreshold(simMat, nodeData, clustering='louvain', fixed=False):
    linksPer = 1.0
    while linksPer < 8.0:
        thrMat = thresholdSimilarityMatrix(simMat, linksPer, fixed=fixed)
        linkData = [{'id1': item[0], 'id2': item[1], 'similarity': thrMat[item[0], item[1]]} for item in
                    np.transpose(np.nonzero(thrMat))]
        print("[SimToNetwork.adaptiveSimMatThreshold] Thresholded network contains  %s nodes and %s links" % (
        str(len(nodeData)), str(len(linkData))))
        # compute clustering and network properties, including naming and other cluster info
        g = buildNetworkX(linkData, nodeData)
        clInfo = computeClustering(g, clustering)
        nodeData = nodeDataFromNetworkX(g)
        clusterInfo = getClusterLinkingInfo(nodeData, linkData, clInfo[0])
        nClus = len(clusterInfo)
        nIsolated = len([info for info in clusterInfo.values() if info['nIntraClus'] == info['nLinks']])
        sig = sum([info['significance'] * info['nNodes'] for info in clusterInfo.values()]) / len(
            nodeData)  # average weighted by cluster size
        print("linksPer: %f, nClus: %d, nIsolated: %d, sig: %f" % (linksPer, nClus, nIsolated, sig))
        linksPer += 1.0
    return thrMat
