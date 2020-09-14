# -*- coding: utf-8 -*-
"""
Created on Wed Aug 13 15:35:50 2014

@author: rich
"""

import networkx as nx
import numpy as np
from scipy.sparse import identity
from scipy.sparse import issparse
from scipy.linalg import inv
from scipy.sparse.linalg import inv as inv_sp

# computes trophic level and returns dict of {nodeId:TLValue}
def computeTL(network):
    if not isinstance(network, nx.DiGraph):
        return None
    n = len(network.node)
    a = nx.adjacency_matrix(network).astype('float64')
    # normalize the adjacency matrix (divide each row by row sum)
    asum = np.array(a.sum(axis=1).T)[0]  # force matrix to array
    asum = [(1 if val == 0 else 1./val) for val in asum]    
    b = a.copy()
    for row in range(len(asum)):
        b[row] *= asum[row]
    try: 
        # use normalized matrix b in tl computation
        m = identity(n) - b
        if issparse(m):
            mInv = inv_sp(m)
        else:
            mInv = inv(m)
        tl = mInv.sum(axis=1)
        # return results as {node, tl}
        results = dict(zip(network.nodes(), tl))
        return results
    except:
        return None
    