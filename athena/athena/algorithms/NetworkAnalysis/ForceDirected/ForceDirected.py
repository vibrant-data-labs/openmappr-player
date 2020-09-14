# force directed layout, optionally using Barnes-Hut approximation
# optionally weight attraction (decrease when intercluster) and
# repulsion (increase when interclsuter) to force named clusters together

import math
import numpy as np
import time

import random
import networkx as nx
from athena.algorithms.NetworkAnalysis.Components import componentIDs
import athena.algorithms.NetworkAnalysis.ComputeProperties as cp
from bhtree import pyBHTree

class _LayoutData:

    interClusterWt = 0.2

    def __init__(self, g, clustering):
        clusterings = {}
        clusIdx = 0
        components = componentIDs(g)
        degrees = g.degree()
        nNodes = len(g)
        self.nodeList = []
        pos = np.zeros([nNodes, 3])
        size = np.zeros(nNodes)
        degree = np.zeros(nNodes)
        component = np.zeros(nNodes, dtype=int)
        clusterIdx = np.zeros(nNodes, dtype=int)
        i = 0
        print("Initializing forceDirected with clustering = " + str(clustering))
        for node, data in g.nodes_iter(data=True):
            if 'posX' not in data:
                data['posX'] = random.uniform(0,100.0)
            if 'posY' not in data:
                data['posY'] = random.uniform(0,100.0)
            if 'size' not in data:
                data['size'] = 5
            pos[i] = [data['posX'], data['posY'], 0]
            size[i] = data['size']
            degree[i] = degrees[node]
            component[i] = components[node]
            # get cluster index from (string) clustering value
            if clustering != None and clustering in data:
                clus = data[clustering]
                if clus != None and clus not in clusterings:
                    clusterings[clus] = clusIdx
                    clusIdx += 1
                clusterIdx[i] = clusterings[clus]
            self.nodeList.append(node)
            i += 1
        self.pos = pos
        self.rawSize = size
        self.size = np.ones(nNodes)
        self.mass = np.ones(nNodes)
        self.massSqrt = np.sqrt(self.mass)
        self.degree = degree
        self.components = component
        self.clusterIdx = clusterIdx
        self.giantSize = np.bincount(component).max()
        linkMatrix = nx.to_scipy_sparse_matrix(g, dtype='f')
        self.links = np.nonzero(linkMatrix)    # (list of source indices, list of target indices)
        self.force = np.zeros([nNodes, 3])
        self.oldForce = np.zeros([nNodes, 3])
        self.swinging = np.zeros(nNodes)
        self.visible = np.ones(nNodes, dtype=bool)
        self.nNodes = nNodes
        self.useBH = True
        # compute inter/intra cluster link weights
        clusDiff = clusterIdx[self.links[0]] - clusterIdx[self.links[1]] # compute whether link is intra- or inter-cluster
        self.clusterWts = np.ones(len(clusDiff))
        self.clusterWts[np.nonzero(clusDiff)] = self.interClusterWt

class ForceDirectedHelper:
    def __init__(self, info, layoutData):
        self.info = info
        self.layoutData = layoutData
        self.jitterTol = 0
        self.bhInfo = {
            'pos': layoutData.pos,
            'size': layoutData.size,
            'mass': layoutData.mass,
            'massSqrt': layoutData.massSqrt,
            'degree': layoutData.degree,
            'components': layoutData.components,
            'clusterIdx': layoutData.clusterIdx,
            'nNodes': layoutData.nNodes,
        }
        if self.info['circular']:
            clumpiness = 10.0
            k = math.sqrt(5e9/layoutData.giantSize)
            rk = 1000.0
            info['attractK'] = self.info['attract'] / k
        else:
            if np.any(layoutData.clusterIdx):
                clumpiness = math.pow(10, 4 * info['clumpiness'])
            else:
                clumpiness = math.pow(10, 4 * (1.0 - info['clumpiness']))
            k = math.sqrt(5e8/layoutData.giantSize)
            rk = clumpiness
            info['attractK'] = 10.0 * self.info['attract'] / (clumpiness * k)
        info['gravityK'] = self.info['gravity'] * clumpiness * k
        info['repulseK'] = rk * k * k
        print("Circular" if self.info['circular'] else "Standard")
        print("Repulsion: " + str(info['repulseK']))
        print("Attraction: " + str(info['attractK']))
        print("Gravity: " + str(info['gravityK']))

    def get_scale(self):
        rng = np.ptp(self.layoutData.pos, axis=0).max()  # get max position range, x or y
        return max(rng/1000.0, 1.0)     # scale to fit in 1000 units

    def rescale(self):
        self.layoutData.size = self.get_scale()*self.layoutData.rawSize      # rescale node sizes

    def _computeForcing(self):
        # report if any values that are nan and convert nan to zero
        def checkNan(x, msg):
            if( np.isnan(np.min(x))):
                print("Bad forcing in " + msg)
                x[np.isnan(x)] = 0

        ld = self.layoutData
        ld.oldForce = ld.force
        if ld.useBH == True:
            bhTree = pyBHTree()
            repulse = bhTree.computeRepulsion(ld.nNodes,
                                ld.pos,
                                ld.mass,
                                ld.size,
                                ld.components,
                                ld.clusterIdx,
                                self.info['repulseK'],
                                self.info['maxComponentId'],
                                self.info['circular'],
                                self.info['avoidCollisions'])
        else:
            repulse = self._computeRepulsion()
        ld.force = repulse
        checkNan(ld.force, "repulsion")
        ld.force += self._computeGravity()
        checkNan(ld.force, "gravity")
        ld.force += self._computeAttraction()
        checkNan(ld.force, "attraction")

    def _move(self):
        ld = self.layoutData
        if ld.nNodes > 0:
            # rate is lowered when the node swings
            factor = self.info['rate'] / (1 + self.info['rate'] * np.sqrt(ld.swinging))
            f = ld.force
            df = np.sqrt(np.multiply(f,f).sum(axis=1))
            factor = 100 * np.minimum(factor, 10/df)
            # reposition proportional to net force on each node
            delta = ld.force * factor.reshape(len(factor),1)
            pos = ld.pos + delta
            # get extents of node positions
            minPos = np.amin(pos, axis=0)
            maxPos = np.amax(pos, axis=0)
            # get "size" of layout
            delta = maxPos - minPos
            sz = np.sqrt(np.multiply(delta, delta).sum())
            # scale force by layout size
            self.info['maxForce'] /= sz
            ld.pos = pos

    def _adjustSpeed(self):
        ld = self.layoutData
        nNodes = ld.giantSize
        rate = self.info['rate']
        diff = ld.oldForce - ld.force    # compute difference between forcing at adjacent steps
        ld.swinging = np.sqrt(np.multiply(diff, diff).sum(axis=1))     # compute magnitude of forcing difference
        sumF = ld.oldForce + ld.force    # compute sum of forces at adjacent steps
        traction = np.sqrt(np.multiply(sumF, sumF).sum(axis=1))
        totalSwinging = np.sum(ld.mass * ld.swinging)   # If the node has a burst change of direction, then it's not converging.
        totalEffectiveTraction = np.sum(ld.mass * traction)
        self.info['maxForce'] = np.max(traction)
        if totalSwinging > 0:
            # We want that swingingMovement < tolerance * convergenceMovement
            jitterTol = nNodes * nNodes * self.jitterTol
            targetSpeed = 0.005 * jitterTol * jitterTol * totalEffectiveTraction / totalSwinging
            # But the speed shoudn't rise too much too quickly, since it would make the convergence drop dramatically.
            maxRise = 0.5   # Max rise: 50%
            self.info['rate'] = rate + min(targetSpeed - rate, maxRise * rate) #, -rate*maxRise)

    def step(self):
        self.info['nSteps'] += 1
        self.jitterTol = 1e-5
        self._computeForcing()
        self._adjustSpeed()
        self._move()

    def _computeRepulsion(self):
        ld = self.layoutData
        repulse = self.info['repulseK']
        pos = ld.pos
        delta = np.zeros((pos.shape[0],pos.shape[0],pos.shape[1]) ,dtype=pos.dtype)
        for i in range(pos.shape[1]):
            delta[:,:,i] = pos[:,i,None]-pos[:,i]
        rSq = (delta*delta).sum(axis=2)
        rSq[rSq==0] = 1e-10 # make sure diagonal elements are > 0 so can take reciprocal
        diffComponent = ld.components.reshape(ld.nNodes,1) != ld.components
        massFactor = np.maximum(np.sqrt(ld.mass.reshape(ld.nNodes,1)*ld.mass), 1)
        # mass factor set to 1 if components are different
        massFactor[diffComponent] = 1
        factor = massFactor * repulse / rSq
        # compute force components
        repulsionForce = -(delta * factor.reshape(factor.shape[0],factor.shape[1],1)).sum(axis=0)
        return repulsionForce

    def _computeGravity(self):
        ld = self.layoutData
        factor = self.info['gravityK'] * ld.mass
        delta = ld.pos
        dist = np.sqrt(np.multiply(delta, delta).sum(axis=1))  # compute distance to origin of each node
        # compute gravity factor for nodes in giant component
        idx = np.logical_and(dist > 0, ld.components == self.info['maxComponentId'])
        maxdist = max(dist[idx])    # get max dist from center of giant component nodes
        if self.info['circular']:
            factor[idx] = factor[idx]/maxdist
        else:
            factor[idx] = factor[idx]/np.maximum(dist[idx], maxdist/2)

        # compute gravity factor for nodes not in giant component
        # repulsive gravity at center, standard at edge, to force isolated/small components to periphery
        idx = np.logical_and(dist > 0, ld.components != self.info['maxComponentId'])
        relDist = dist[idx]/maxdist
        factor[idx] = factor[idx]*relDist*(relDist - 1)/maxdist

        # compute net gravity on each node; reshape factor to allow numpy broadcasting
        gravityForce =  -delta * factor.reshape(len(factor),1)
        return gravityForce

    def _computeAttraction(self):
        ld = self.layoutData
        clusWts = ld.clusterWts # weight of each link, = 1 if intracluster, < 1 if intercluster
        pos = ld.pos
        nNodes = ld.nNodes
        links = ld.links
        delta = pos[links[0]] - pos[links[1]] # compute length components of each link (distance between nodes that are endpoints)
        dist = np.sqrt(np.multiply(delta, delta).sum(axis=1))   # compute length of each link
        attract = self.info['attractK'] / ld.massSqrt           # compute "spring constant" of each link
        if self.info['avoidCollisions'] == True:
            size1 = ld.size[links[0]]
            size2 = ld.size[links[1]]
            edgeDist = dist - size1 - size2
            edgeDist[edgeDist < 0] = 0
        else:
            edgeDist = dist
        k = edgeDist
        # edgeDist is distance from the border of each node
        idx = (edgeDist > 0)             # get links where dist > 0 so force > 0
        nodeIdx = links[0][idx]          # get list of node indices that the spring force acts on
        delta = delta[idx]               # get force direction for all non-zero forces
        k = (k*clusWts)[idx]             # weight k and get values for all non-zero forces
        # compute forces for each link
        linkForces = -delta * (attract[nodeIdx] * k).reshape(len(nodeIdx),1)
        # accumulate forces for each node
        nfx = np.bincount(nodeIdx, linkForces[:,0], minlength=nNodes)
        nfy = np.bincount(nodeIdx, linkForces[:,1], minlength=nNodes)
        nfz = np.bincount(nodeIdx, linkForces[:,2], minlength=nNodes)
        attractionForce = np.array([nfx, nfy, nfz]).T
        return attractionForce

    def updateVisibility(self, viz):
        for i in range(len(self.nodeData)):
            self.nodeData[1][i].visible = viz[i]

    def getPositions(self):
        ld = self.layoutData
        return dict(zip(ld.nodeList, ld.pos))

def forceDirectedLayout(g, options = {}, maxSteps=1000, clumpiness = 0.3, avoidCollisions=True, addToGraph=False, clustering=None, algo=None):
    info = {
        'avoidCollisions': avoidCollisions,
        'layoutAll': True,            # all nodes or only visible nodes
        'use3d': 0,                   # 1 or 0 so can be used as a multiplier
        'repulse': 1.0 if clustering == None else 10.0,
        'attract': 100.0 if clustering == None else 10.0,
        'gravity': 1.0 if clustering == None else 10.0,
        'connectivity': cp.linksPerNode(g),
        'connectance': cp.connectance(g),
        'rate': 1e5,
        'maxForce': 0,
        'maxComponentId': 0,          # id of giant component
        'nSteps': 0,
        'clumpiness': clumpiness               # 0-1, 0 is "circular", 1 has tight clusters
    }
    info['circular'] = True if info['clumpiness'] == 0 else False
    if avoidCollisions:
        print("Avoid collisions")
    # initialize layoutData
    layoutData = _LayoutData(g, clustering)
    # build helper class
    fdHelper = ForceDirectedHelper(info, layoutData)
    fdHelper.rescale()
    # iterate the layout
    delta = int(maxSteps/20)
    while True:
        # time.sleep(0.1)
        fdHelper.step()
        force = info['maxForce']
        nSteps = info['nSteps']
        if np.isnan(force):
            print("ERROR in force computation during step " + str(info['nSteps']))
            return []
        if nSteps % delta == 0:
            print("scale: %f" % fdHelper.get_scale())
            print("Step " + str(nSteps) + ' Step size: ' + str(force))
            if algo is not None and nSteps <= maxSteps:
                completion = int((10 * nSteps) / maxSteps)
                algo.setProgress("Running Force directed layout, step %s ..." % str(nSteps), 70 + completion)
        if force == 0 or abs(force) < 0.00001 or nSteps >= maxSteps:
            break
    # get the results and copy to graph
    newpos = fdHelper.getPositions()
    if addToGraph == True:
        print("Adding new node positions to the network")
        for node, pos in newpos.iteritems():
            g.node[node]['posX'] = pos[0]
            g.node[node]['posY'] = pos[1]
    return newpos
