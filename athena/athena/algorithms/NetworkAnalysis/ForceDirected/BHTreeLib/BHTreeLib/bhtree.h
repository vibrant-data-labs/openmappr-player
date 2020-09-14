/*
 *  BHTreeNode.h
 *  BHTreeNode
 *
 *  Created by Rich Williams on 12/29/14.
 *  Copyright (c) 2014 Rich Williams. All rights reserved.
 *
 */

#ifndef BHTreeNode_
#define BHTreeNode_

#include <array>
#include <vector>
#include <set>
using namespace std;

const int NDIM = 2;
const int NDIMMAX = 3;
const int NQUADS = 4;

const int INTERCLUSTERREPULSION = 5;

/* The classes below are exported */
#pragma GCC visibility push(default)

struct LayoutInfo {
    double repulseK;
    bool isCircular = false;
    bool avoidCollisions = false;
    double theta = 0.85;      // padding factor around nodes
    unsigned long giantComponent;
};

// quadtree is n-dimensional, to support 2d and 3d layouts
//
struct BHTreeInfo {
    unsigned long nCalls;
    unsigned long nPts;
    double *pos;
    double *mass;
    double *size;
    long *components;
    long *clusterIdx;

    BHTreeInfo(unsigned long n, double *pos, double *mass, double *sz, long *comp, long * clus);
};

class BHTreeNode
{
    BHTreeInfo *info;
    double centerOfMass[NDIM];
    vector<int> *indices;
    set<long> components;
    set<long> clusterIdx;
    unsigned long nPts;
    double nodeSize;
    double nodeMass;
    array<BHTreeNode *, NQUADS> quads;
    bool isLeaf;
    int depth;
public:
    BHTreeNode(void);
    BHTreeNode(BHTreeInfo *info, vector<int> *indices, int depth, bool buildSubtrees=true);
    ~BHTreeNode();
    
    void computeRepulsion(double *force, int i, LayoutInfo *lInfo);
    void init(BHTreeInfo *info, vector<int> *indices, int depth, bool buildSubtrees=true);
    void done(void);
    
private:
    
    void _computeCenterOfMass(void);
    void _computeSize(void);
    bool _computeQuads(void);
    void _repulsionFn(double *force, int i, int j, BHTreeNode *node, bool sameComponent, bool sameCluster, LayoutInfo *lInfo);
    bool containsComponent(long id);
    bool containsCluster(long id);
};

class BHTree
{
    BHTreeInfo *info;
    BHTreeNode root;
public:
    BHTree();
    ~BHTree();
    void init(unsigned long n, double *p, double *mass, double *sz, long *comp, long * clus);

    void computeRepulsion(double *force, LayoutInfo *lInfo);
    void computeRepulsion(double *force, double repulseK, unsigned long giantComponent, bool isCircular=false, bool avoidCollisions=false);
};

#pragma GCC visibility pop
#endif
