# -*- coding: utf-8 -*-
"""
Created on Fri Jun 27 20:55:51 2014

@author: richwilliams
"""

import bisect
from athena.algorithms.Util.SignificanceTest import sigTest

# find cluster significance (internal vs external links) and dominant terms in each cluster
# inputs:
# nodes with cluster assignments 
# links with linkingAttributes
# clustering to compute info for
# for each cluster, build list of most common linkingAttributes for all intracluster links
# return dict of {clusterVal:{nLinks, nIntraClus, significance, terms: [commonAttrVals]}
def getClusterLinkingInfo(nodeData, linkData, clusterName):
    def addToHistog(histog, item, wt):
        if isinstance(item, dict):
            ansStr = item['answer']
            count = wt * item['count']
        else:
            ansStr = item
            count = wt
        if ansStr not in histog:
            histog[ansStr] = 0
        histog[ansStr] += count

    def addClusterLinks(fromCl, toCl, clusterLinks):
        if fromCl not in clusterLinks:
            clusterLinks[fromCl] = {}
        l = clusterLinks[fromCl]
        if toCl not in l:
            l[toCl] = 0
        l[toCl] += 1
    
    print("[findCommonClusterTerms] " + str(clusterName) + " start")   
    globalHistog = {}
    globalNLinks = 0
    # dict of (clusterName, termHistog), where termHistog is {term, termCount}
    clusterTerms = {}
    # dict of {cluster: {cluster:nLinks}}
    clusterLinks = {}
    # build dict of {nodeId, nodeData}
    nodeMap = {n['id']: n for n in nodeData}
    # scan all links and build cluster term histograms
    print("[findCommonClusterTerms] build cluster term histograms")   
    nIntraClus = {}
    nTotal = {}
    for linkItem in linkData:
        cluster = nodeMap[linkItem['id1']][clusterName]
        cluster2 = nodeMap[linkItem['id2']][clusterName]
        if cluster not in nTotal:
            nTotal[cluster] = 0.0
        nTotal[cluster] += 1.0
        if cluster not in clusterTerms:
            clusterTerms[cluster] = {}
        if cluster == cluster2:
            # keep count of number of intracluster links in each cluster
            if cluster not in nIntraClus:
                nIntraClus[cluster] = 0
            nIntraClus[cluster] += 1
            globalNLinks += 1
            if 'linkingAttributes' in linkItem and len(linkItem['linkingAttributes']) > 0:
                linkingAttributes = linkItem['linkingAttributes']
                terms = clusterTerms[cluster];
                for la in linkingAttributes:    # linking attr is (attr, val, wt)
                    av = la[:2]
                    addToHistog(terms, av, la[2])
                    addToHistog(globalHistog, av, la[2])
        else:   # track intercluster links
            addClusterLinks(cluster, cluster2, clusterLinks)
            addClusterLinks(cluster2, cluster, clusterLinks)

    # normalize global histogram
    for qa in globalHistog.iterkeys():
        globalHistog[qa] = float(globalHistog[qa])/globalNLinks
    tot = sum(globalHistog.itervalues())
    globalTot = len(globalHistog)
    meanGlobalFreq = 0 if globalTot == 0 else tot/globalTot
    # sort each cluster term histogram and extract the most common terms
    # build array of {clusterName, term(q and a), termFreq measures}
    print("[findCommonClusterTerms] extract common cluster terms")   
    clusterInfo = {}
    for cluster, histog in clusterTerms.iteritems():
        #print("[findCommonClusterTerms] extract terms from " + cluster + ", nItems = " + str(len(histog)))   
        clusTerms = []
        nIntra = nIntraClus[cluster] if cluster in nIntraClus else 1
        # item is (term, freq)
        items = [item for item in histog.iteritems()]
        # save common terms for the cluster
        for item in items:
            qa = item[0]
            globalFreq = globalHistog[item[0]]
            freq = float(item[1])/nIntra       # fraction of intracluster links that have this as a linkingAttribute
            wtdFreq = freq/(globalFreq + meanGlobalFreq)    # denominator prevents low global freq terms from being too important
            clusTerms.append({'cluster': cluster, 
                              'value': qa,
                              'freq': freq, 
                              'globalFreq': globalFreq,
                              'wtdFreq': wtdFreq,
                              'importance': freq*wtdFreq})  # important terms are common in the cluster and rare globally
        if len(clusTerms) > 1:
            # ascending sort
            clusTerms.sort(key=lambda x: x['importance'])
            # keep only more important terms
            minImp = clusTerms[len(clusTerms)-1]['importance'] / 10.0
            # extract list of importance values
            keys = [c['importance'] for c in clusTerms]
            # find index to bisect at
            idx = bisect.bisect_right(keys, minImp)
            clusTerms = clusTerms[idx:]
            # remove terms that are subsets of others (unigrams that make bigrams etc)
            termDict = {}
            for term in clusTerms:
                ignore = False
                delKeys = []
                val = term['value']
                for t in termDict.iterkeys():
                    if t[0] == val[0]:      # term is associated with the same attribute
                        if val[1] in t[1]:  # attribute value is a subset of term already in termDict
                            ignore = True
                            term['importance'] = termDict[t]['importance'] = max(term['importance'], termDict[t]['importance'])
                            break
                        elif t[1] in val[1]: # term in termDict is a subset of attribute value, remove it from termDict
                            term['importance'] = termDict[t]['importance'] = max(term['importance'], termDict[t]['importance'])
                            delKeys.append(t)
                for k in delKeys:
                    del termDict[k]
                if not ignore:
                    termDict[val] = term
            clusTerms = termDict.values()
            clusTerms.sort(key=lambda x: x['importance'], reverse = True)
        # add info on links and linking attr from this cluster to global list
        clusterInfo[cluster] = {'cluster': cluster,
                                'nLinks': nTotal[cluster],
                                'nIntraClus': nIntraClus[cluster],
                                'significance': 0 if nTotal[cluster] == 0 else (2.0*(nIntraClus[cluster]/nTotal[cluster]) - 1.0),
                                'linkingAttr': clusTerms,
                                'clusterLinks': clusterLinks[cluster] if cluster in clusterLinks else {}}    
    clusters = getClustersOfNodes(nodeData, clusterName)
    for clus, nodes in clusters.iteritems():
        if len(nodes) > 1:
            clusterInfo[clus]['nNodes'] = len(nodes)
        else:
            clusterInfo[clus] = {'cluster': clus, 'nNodes': 1, 'nLinks': 0, 'nIntraClus': 0, 'significance': 0}
    return clusterInfo

# builds link-based cluster info data and then
# updates nodeData with cluster names based on linking attributes
#
def _nameClustersByLinkingAttrs(clusterData, nodeData, cl, nLinkingAttr, attrs, mergeDuplicates=False):
    maxTerms = 6    # max number of terms in cluster name
    attrs = {a['name']:a['type'] for a in attrs}
    if len(clusterData) > 0:
        clusterNames = {}   # final {cluster value, cluster name} dict
        nameCounts = {}  # dict of unique names and counts
        for clVal, clData in clusterData.iteritems(): 
            if 'linkingAttr' not in clData or len(clData['linkingAttr']) == 0:
                clusterNames[clVal] = clVal
                continue
            # get term data and aggregate attribute values for each attribute
            vals = [val['value'] for val in clData['linkingAttr']]
            parts = {}
            seen = {}
            for val in vals:
                # skip if this attr,val pair has been seen before
                if val in seen: 
                    continue
                seen[val] = 1
                # skip if is a mid-value numeric and already at least one "part" in cluster name
                if len(parts) > 0 and val[1] == 'Mid' and val[0] in attrs and attrs[val[0]] == 'number': 
                    continue
                if val[0] not in parts:
                    parts[val[0]] = []
                parts[val[0]].append(val[1])
            # make cluster name
            if nLinkingAttr == 1:     # don't output attribute name if only one linking attribute 
                vals = [(val if isinstance(val, basestring) else repr(val)) for val in parts.values()[0]]
                vals = vals[:maxTerms]
                nameTxt = ', '.join(vals)
            else:
                vals = [', '.join(v[:maxTerms]) + ' ' + k for k,v in parts.iteritems()]
                #vals = vals[:maxTerms]
                nameTxt = '; '.join(vals)
            if len(nameTxt) == 0:
                nameTxt = clVal
            # make sure cluster names are unique
            if nameTxt in nameCounts:
                nameCounts[nameTxt] += 1
                if not mergeDuplicates:
                    nameTxt += " (" + str(nameCounts[nameTxt]) + ")"
            else:
                nameCounts[nameTxt] = 1
            clData['linkingAttrName'] = clusterNames[clVal] = nameTxt
            del clData['linkingAttr']           # done with cluster-level linkingAttr info, remove it because it can be large
        for nd in nodeData:
            if cl in nd and nd[cl] in clusterNames:
                nd[cl] = clusterNames[nd[cl]]

# for a particular clustering and set of attributes, 
# determine which attribute value distributions for the cluster are significantly different from the global distribution 
# attrs is [{attrName, attrType}] where attrType is ('numeric', 'string', tag')
#
def getClusterAttrInfo(nodeData, clusters, cl, attrs, algo):
    def addInfo(clusterInfo, cl, attr, sigInfo):
        if cl not in clusterInfo:
            clusterInfo[cl] = []
        if len(sigInfo) > 0:
            sigInfo['attr'] = attr
            clusterInfo[cl].append(sigInfo)

    print('[NameClusters.getClusterAttrInfo] getting info for ' + str(len(attrs)) + ' attributes, cluster ' + cl)
    clusterInfo = {}
    # for each attribute
    for attr in attrs:
        def getValues(nodeList, aName, aType):
            return [node[aName] for node in nodeList if aName in node and node[aName] != None]

        attrName = attr['name']
        print("[ClusterInfo.getClusterAttrInfo] attribute: %s, %d clusters"%(attrName, len(clusters)))
        # extract global attribute values
        globalVals = getValues(nodeData, attrName, attr['type'])
        # for each cluster, get attribute values of nodes in the cluster
        # and test their significance against the global distribution
        algo.setProgress( "Computing significance for %s..." % attrName, 70)        
        for cluster, nodes in clusters.iteritems():
            clVals = getValues(nodes, attrName, attr['type'])
            sigInfo = sigTest(clVals, globalVals, attr['type'])
            addInfo(clusterInfo, cluster, attrName, sigInfo)
    return clusterInfo
    
def getClusterAttrHighlights(clusterInfo, nodeData, clusters, attr, infoName):
    def sortFn(n):
        return n[attr]
    for clus, nodes in clusters.iteritems():
        if clus not in clusterInfo:
            clusterInfo[clus] = {}
        if len(nodes) > 4:
            nodes.sort(key=sortFn, reverse=True)
            maxVal = sortFn(nodes[0])/2.0
            nodes = [node for node in nodes if node[attr] >= maxVal][:min(len(nodes)/2, 5)]
#            clusterInfo[clus][infoName] = [n['__originalId__'] for n in nodes]
            clusterInfo[clus][infoName] = [n['dataPointId'] for n in nodes]

# build dict of {clusterVal: [nodes]}
def getClustersOfNodes(nodeData, cl):
    clusters = {}
    for node in nodeData:
        clVal = node[cl]
        if clVal not in clusters:
            clusters[clVal] = []
        clusters[clVal].append(node)
    return clusters

# build clusterInfo data for clustering cl
# attrs are data attributes that should be tested for significance
# mergeDuplicates - merge identically named clusters
#
def getClusterInfo(nodeData, linkData, cl, nLinkingAttr, attrs, algo, mergeDuplicates=False):
    # get cluster naming data (attribute,value) pairs for each cluster
    clusterData = getClusterLinkingInfo(nodeData, linkData, cl)
    print('[NameClusters.nameClusters] clusterData contains ' + str(len(clusterData)))
    # run naming by linking attr
    if nLinkingAttr != None:
        _nameClustersByLinkingAttrs(clusterData, nodeData, cl, nLinkingAttr, attrs, mergeDuplicates=mergeDuplicates)
    return clusterData

def addClusterPropertyInfo(nodeData, clusterInfo, cl, attrs, algo, sigAttr=False):
    # get cluster label based on significant attributes
    def getSigAttrLabel(info):
        label = ""
        for sigInfo in info:
            if len(label) > 0:
                label += ", "
            if 'mean' in sigInfo:
                label += sigInfo['mean'] + ' ' + sigInfo['attr']
            elif "nonRandom" in sigInfo and "topValues" in sigInfo:
                label += sigInfo['attr'] + ': ' + ', '.join(sigInfo['topValues'])
        return label

    clusters = getClustersOfNodes(nodeData, cl)
    # get attribute significance info and add to cluster info
    attrInfo = getClusterAttrInfo(nodeData, clusters, cl, attrs, algo) if sigAttr else {}
    # set cluster label
    for info in clusterInfo:
        info['label'] = info['linkingAttrName'] if 'linkingAttrName' in info else info['cluster']
    # build {name:info}
    clusInfo = {(info['label']):info for info in clusterInfo}
    for clus, info in attrInfo.iteritems():
        clusInfo[clus]['attrSignificance'] = info
        clusInfo[clus]['sigAttrName'] = getSigAttrLabel(info)
    # get most central and most bridging nodes
    getClusterHighlights(clusInfo, nodeData, clusters, cl)

def getClusterHighlights(clusterInfo, nodeData, clusters, cl):
    # get top central and bridgers
    attr = 'ClusterArchetype' if cl == 'Cluster' else 'centrality' + '_' + cl
    getClusterAttrHighlights(clusterInfo, nodeData, clusters, attr, 'MostCentral')
    attr = 'ClusterBridging' if cl == 'Cluster' else 'bridging' + '_' + cl
    getClusterAttrHighlights(clusterInfo, nodeData, clusters, attr, 'Bridgers') 


