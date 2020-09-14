import math
import datetime
import networkx as nx
import scipy.stats as sps

from athena.algorithms.DataToNetwork.SimToNetwork import simMatToArray

# find events in eventNW built from nw, assign event IDs etc to nodes in nw
def _findEvents(nw, eventNW):
    print("Event network has %d of %d links"%(eventNW.number_of_edges(), nw.number_of_edges()))
    # find event components and assign event IDs in original graph
    eventID = 1
    for comp in sorted(nx.connected_components(eventNW), key=len, reverse=True):
        evSz = len(comp)
        if evSz > 1:
            print("Event size: %d"%evSz)
            for node in comp:
                nw.node[node]['eventID'] = eventID
                nw.node[node]['eventSize'] = evSz
            eventID += 1
    print("Detected %d events"%(eventID-1))

# detect network events (groups of connected nodes that are also close in time)
# timeAttr is the node attribute that contains the time of the node
# tDelta is the decay time scale used when re-weighting links, in seconds
#
def DetectNetworkEvents(nw, timeAttr='date', clusterAttr=None, tDelta=24*3600.0, threshold=0.7):
    eventNW = nx.Graph(nw)    # shallow copy network structure but not attributes
    # downweight edges based on time difference and remove weak edges
    for l in nw.edges_iter():
        n1 = nw.node[l[0]]
        n2 = nw.node[l[1]]
        t1 = datetime.datetime.strptime(n1[timeAttr], '%Y-%m-%dT%H:%M:%SZ')
        t2 = datetime.datetime.strptime(n2[timeAttr], '%Y-%m-%dT%H:%M:%SZ')
        dt = abs((t1-t2).total_seconds())
        wt = math.exp(-dt/tDelta)
        # if using cluster to distinguish events, set threshold higher when nodes are in different clusters
        if clusterAttr != None and (clusterAttr not in n1 or clusterAttr not in n2 or n1[clusterAttr] != n2[clusterAttr]):
            thr = threshold + (1.0 - threshold)/2.0
        else:
            thr = threshold
        if wt < thr:
            eventNW.remove_edge(l[0], l[1])

    # find event components and assign event IDs in original graph
    _findEvents(nw, eventNW)

# detect events (groups of connected nodes that are also close in time)
# using a partially thresholded similarity matrix
# this allows similarities that are thresholded away during standard netgen 
# but are very close in time to remain for the event calculation
# timeAttr is the node attribute that contains the time of the node
# tDelta is the decay time scale used when re-weighting links
#
def DetectSimilarityEvents(nw, simMat, timeAttr, tDelta, threshold=0.7):
    # find min max and threshold to that level
    maxVals = simMat.max(axis=1)
    maxVals[maxVals == 0.0] = 1.0       # set max of empty rows to max possible sim value
    simThr = float(min(maxVals))
    linkData = simMatToArray(sps.threshold(simMat, threshmin=simThr, threshmax=None, newval=0))
    # for each potential link, compute time downweighting and threshold
    eventNW = nx.Graph()
    eventNW.add_nodes_from(nw)
    for l in linkData:
        n1 = eventNW.node[l['id1']]
        n2 = eventNW.node[l['id2']]
        dt = math.abs(n1[timeAttr] - n2[timeAttr])
        wt = math.exp(-dt/tDelta)
        if wt > threshold:
            eventNW.add_edge(l['id1'], l['id2'])

    # find event components and assign event IDs in original graph
    _findEvents(nw, eventNW)
