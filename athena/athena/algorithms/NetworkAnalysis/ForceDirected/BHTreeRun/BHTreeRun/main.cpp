//
//  main.cpp
//  RunBHTree
//
//  Created by Rich Williams on 1/1/15.
//  Copyright (c) 2015 Rich Williams. All rights reserved.
//

#include <iostream>
#include <stdlib.h>
#include <time.h>
#include "../../BHTreeLib/BHTreeLib/BHTree.h"

int main(int argc, const char * argv[]) {
    const int maxNdim = 3;              // allow 2 or 3 dimensional trees (quad or oct)
    int i, j;
    srand((unsigned int)time(NULL));
    LayoutInfo li;
    int nPts = 10;
    int nDim = 2;
    double *pos = new double[maxNdim*nPts];
    double *mass = new double[nPts];
    double *size = new double[nPts];
    long *component = new long[nPts];
    for(i = 0; i < nPts; i++) {
        for(j = 0; j < nDim; j++) {
            pos[maxNdim*i + j] = 100*((double)rand()/(double)RAND_MAX);
        }
        for(j = nDim; j < maxNdim; j++) {
            pos[maxNdim*i + j] = 0;
        }
        mass[i] = 1;
        size[i] = 1;
        component[i] = i;
    }
    double *force = new double[nDim*nPts];
    std::cout << "Building BHTree\n";
    BHTree *bhTree = new BHTree();
    bhTree->init(nPts, pos, mass, size, component);
    std::cout << "Starting to compute repulsion\n";
    for(i = 0; i < 10; i++ ) {
        bhTree->computeRepulsion(force, &li);
        cout << i << '\n';
    }
    std::cout << "Done\n";
    delete pos;
    delete size;
    delete mass;
    delete component;
    delete force;
    delete bhTree;
    return 0;
}
