//
//  BHTreeNode.cpp
//  BHTree
//
//  Keeps track of graph component and optionally cluster of each node.
//  Nodes in the same component are repelled more so that isolated components don't get pushed too far away
//  Nodes in the same clusters can be repelled less, helping clusters aggregate in the layout
//
//  Created by Rich Williams on 12/29/14.
//  Copyright (c) 2014 Rich Williams. All rights reserved.
//

#include <iostream>
#include "bhtree.h"
#include <cmath>

BHTree::BHTree()
{
    info = nullptr;
}

BHTree::~BHTree()
{
    delete info;
}

void BHTree::init(unsigned long n, double *pos, double *mass, double *sz, long *comp, long *clus)
{
    root.done();
    delete info;
    info = new BHTreeInfo(n, pos, mass, sz, comp, clus);
    // allocate and initialize indices for all points
    vector<int> *indices = new vector<int>(n);
    for(int i = 0; i < n; i++) {
        (*indices)[i] = i;
    }
    // initialize root node, which in turn builds sub-nodes
    root.init(info, indices, 0);
}

// compute repulsion on each point
//
void BHTree::computeRepulsion(double *force, LayoutInfo *lInfo)
{
    for(int i = 0; i < info->nPts; i++) {
        root.computeRepulsion(force, i, lInfo);
        force += NDIMMAX;
    }
//    std::cout << "NCalls: " << info->nCalls << "\n";
}

void BHTree::computeRepulsion(double *force, double repulseK, unsigned long giantComponent, bool isCircular, bool avoidCollisions)
{
    //std::cout << (isCircular ? "Computing repulsion for circular layout" : "Computing repulsion for standard layout") << '\n';
    LayoutInfo li;
    li.giantComponent = giantComponent;
    li.repulseK = repulseK;
    li.isCircular = isCircular;
    li.avoidCollisions = avoidCollisions;
    li.theta = isCircular ? 0.6 : 0.7;
    computeRepulsion(force, &li);
}

BHTreeInfo::BHTreeInfo(unsigned long n, double *p, double *mass, double *sz, long *comp, long * clus)
{
    nCalls = 0;
    this->nPts = n;
    this->pos = p;
    this->mass = mass;
    this->size = sz;
    this->components = comp;
    this->clusterIdx = clus;
}

// constructor
//
BHTreeNode::BHTreeNode(void)
{
    indices = nullptr;
    nPts = 0;
    isLeaf = false;
    for( int i = 0; i < NQUADS; i++) {
        quads[i] = nullptr;
    }
}

BHTreeNode::BHTreeNode(BHTreeInfo *info, vector<int> *indices, int depth, bool buildSubtrees)
{
    init(info, indices, depth, buildSubtrees);
}

// destructor
//
BHTreeNode::~BHTreeNode()
{
    done();
}

void BHTreeNode::init(BHTreeInfo *info, vector<int> *indices, int depth, bool buildSubtrees)
{
    for( int i = 0; i < NQUADS; i++) {
        quads[i] = nullptr;
    }
    this->depth = depth;
    this->info = info;
    this->indices = indices;
    this->nPts = indices->size();
    // initialize set of components and clusters in this bhtree node
    for(int i = 0; i < nPts; i++) {
        components.insert(info->components[(*indices)[i]]);
        clusterIdx.insert(info->clusterIdx[(*indices)[i]]);
    }
    this->_computeCenterOfMass();
    this->_computeSize();
    if(buildSubtrees) {
        isLeaf = this->_computeQuads();
    }
}

void BHTreeNode::done()
{
    for( int i = 0; i < NQUADS; i++) {
        delete quads[i];
        quads[i] = nullptr;
    }
    delete indices;
    indices = nullptr;
}

// compute repulsion between a point and either a bhTree node or another point
void BHTreeNode::_repulsionFn(double *force, int i, int j, BHTreeNode *node, bool sameComponent, bool sameCluster, LayoutInfo *lInfo)
{
    info->nCalls++;
    int k;
    double repulse = lInfo->repulseK;
    double mass1 = info->mass[i];
    double size2, mass2;
    double dpos[NDIM];     // difference in position
    double rSq = 0;
    if( node != nullptr ) {             // repulsion from bhTree node
        for(k = 0; k < NDIM; k++) {
            dpos[k] = info->pos[NDIMMAX*i+k] - node->centerOfMass[k];
            rSq += dpos[k]*dpos[k];
        }
        mass2 = node->nodeMass;
        size2 = 0;
    } else {                            // repulsion from a single point (leaf)
        for(k = 0; k < NDIM; k++) {
            dpos[k] = info->pos[NDIMMAX*i+k] - info->pos[NDIMMAX*j+k];
            rSq += dpos[k]*dpos[k];
        }
        mass2 = info->mass[j];
        size2 = info->size[j];
    }
    if( lInfo->isCircular ) {
        repulse *= (sameComponent ? fmax(1, mass2/mass1) : 0.0001);
    }  else {
        repulse *=  (sameComponent ? fmax(1, (mass1*mass2)) : 0.001);
    }
    repulse *=  (sameCluster ? 1 : INTERCLUSTERREPULSION);
    if( rSq != 0 ) {
        double factor, r = sqrt(rSq);
        if( lInfo->avoidCollisions && size2 != 0 ) {     // avoid overlapping nodes
            double edgeDist = r - (info->size[i] + size2);
            if( edgeDist > 1e-3 ) { // edge to edge distance is > 0 - no overlap
                factor = repulse / (edgeDist * edgeDist);
            } else {       // nodes overlap and avoidCollision
                factor = 1e6*repulse;
            }
//            if( edgeDist > 0 ) { // edge to edge distance is > 0 - no overlap
//                factor = repulse / (r * edgeDist);
//            } else {       // nodes overlap and avoidCollision
//                factor = -repulse * edgeDist / rSq;
//            }
        }
        else {                  // overlapping nodes ok or repulsion from bhTree node
            factor = repulse / rSq;
        }
        if( lInfo->isCircular && sameComponent ) {
            factor /= r;
        }
        for(k = 0; k < NDIM; k++) {
            force[k] += dpos[k] * factor;
        }
    }
}

// compute repulsion on point i and store result in force
//
void BHTreeNode::computeRepulsion(double *force, int i, LayoutInfo *lInfo)
{
    if( isLeaf ) {      // at leaf in tree
        for(int j = 0; j < indices->size(); j++) {
            int idx = (*indices)[j];
            bool sameComp = (info->components[i] == info->components[idx]);
            // no self-self repulsion; repel if in same component or not in giant component
            if( i != idx && (sameComp || info->components[i] != lInfo->giantComponent)) {
                _repulsionFn(force, i, idx, nullptr, sameComp, info->clusterIdx[i] == info->clusterIdx[idx], lInfo);
            }
        }
    } else if( nPts > 0) {
        // compute distance from node to quad center of mass
        double rSq = 0;
        for(int k = 0; k < NDIM; k++) {
            double dpos = info->pos[NDIMMAX*i+k] - centerOfMass[k];
            rSq += dpos*dpos;
        }
        double dist = lInfo->theta * sqrt(rSq);
        // compute forcing or go deeper into quads
        if( dist > nodeSize ) {    // node is far from this quad - compute approx forcing
            bool sameComp = containsComponent(info->components[i]);
            if( sameComp || info->components[i] != lInfo->giantComponent ) { // repel if in same component or not in giant component
                _repulsionFn(force, i, -1, this, sameComp, containsCluster(info->clusterIdx[i]), lInfo);
            }
        } else {    // quad is close to node, go one layer deeper into the tree
            for(int k = 0; k < NQUADS; k++) {
                if(quads[k]) {
                    quads[k]->computeRepulsion(force, i, lInfo);
                }
            }
        }
    }
}

bool BHTreeNode::containsComponent(long id)
{
    return components.find(id) != components.end();
}

bool BHTreeNode::containsCluster(long id)
{
    return clusterIdx.find(id) != clusterIdx.end();
}

void BHTreeNode::_computeCenterOfMass(void)
{
    // compute center of mass
    int k;
    double tot = 0;
    double sumD[NDIM] = {0,0};
    for(int i = 0; i < nPts; i++) {
        int idx = (*indices)[i];
        double m = info->mass[idx];
        for(k = 0; k < NDIM; k++) {
            sumD[k] += m * info->pos[NDIMMAX*idx+k];
        }
        tot += m;
    }
    if(tot == 0) {
        for(k = 0; k < NDIM; k++) {
            centerOfMass[k] = 0;
        }
    } else {
        for(k = 0; k < NDIM; k++) {
            centerOfMass[k] = sumD[k]/tot;
        }
    }
    nodeMass = tot;
}

void BHTreeNode::_computeSize(void)
{
    // compute region size (max distance of a node from ctr of mass)
    double sz = 0;
    for(int i = 0; i < nPts; i++) {
        int idx = (*indices)[i];
        double rSq = 0;
        for(int k = 0; k < NDIM; k++) {
            double dpos = info->pos[NDIMMAX*idx+k] - centerOfMass[k];
            rSq += dpos*dpos;
        }
        sz = fmax(sz, rSq);
    }
    nodeSize = sqrt(sz);
}

// return isLeaf
//
bool BHTreeNode::_computeQuads(void)
{
    // build subregions
    int i, k, idx;
    if( nPts > 1 ) {
        array<vector<int>, NQUADS> ptLoc;
        // assign points to one of the quadrants
        double dpos[NDIM];
        for(i = 0; i < nPts; i++) {
            idx = (*indices)[i];
            for(k = 0; k < NDIM; k++) {
                dpos[k] = info->pos[NDIMMAX*idx+k] - centerOfMass[k];
            }
            int quadIdx = 0;
            for(k = 0; k < NDIM; k++) {
                quadIdx += (dpos[k] < 0) ? 0 : pow(2, k);
            }
            ptLoc[quadIdx].push_back(idx);
        }
        // build child subtrees
        for(i = 0; i < NQUADS; i++) {
            if(ptLoc[i].size() == nPts ) {
                // all points on top of each other
                quads[0] = new BHTreeNode(info, new vector<int>(*indices), depth+1, false);
                return true;
            }
        }
        for(i = 0; i < NQUADS; i++) {
            if(ptLoc[i].size() > 0 ) {
                quads[i] = new BHTreeNode(info, new vector<int>(ptLoc[i]), depth+1);
            }
        }
        return false;
    }
    return true;
}
