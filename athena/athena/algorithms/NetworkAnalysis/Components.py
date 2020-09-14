# -*- coding: utf-8 -*-

# -*- coding: utf-8 -*-
"""
Created on Wed Aug 13 15:35:50 2014

@author: rich
"""

import networkx as nx

# assign component IDs to graph components, id=0 is giant component
def componentIDs(network):
	# networkx algo only works on undirected network
    if isinstance(network, nx.DiGraph):
        network = nx.Graph(network)    
    cIDs = {}
    components = sorted(nx.connected_components(network), key = len, reverse=True)
    # assign ids to node properties
    for i in range(len(components)):
        component = components[i]
        cIDs.update(dict(zip(component, len(component)*[i])))
    return cIDs
    