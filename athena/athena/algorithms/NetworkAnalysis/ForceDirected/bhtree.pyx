from libcpp cimport bool
import numpy as np
cimport numpy as np
cimport cython

ctypedef np.int_t itype_t    

cdef extern from "bhtree.h":    
    cdef cppclass BHTree:
        BHTree()
        void init(unsigned long n, double *pos, double *mass, double *sz, itype_t *comp, itype_t *clus)
        void computeRepulsion(double *force, double repulseK, unsigned long giantComponent, bool isCircular, bool avoidCollisions)

cdef class pyBHTree:
    cdef BHTree* thisptr # hold a C++ instance

    def __cinit__(self):
        self.thisptr = new BHTree()

    def __dealloc__(self):
        del self.thisptr

    @cython.boundscheck(False)
    @cython.wraparound(False)
    def computeRepulsion(self, nPts, pos, mass, sz, comp, clus, repulseK, giantComponent, isCirc, avoidColl):
        cdef np.ndarray[np.float64_t, ndim=2, mode='c'] _pos = np.ascontiguousarray(pos)
        cdef np.ndarray[np.float64_t, ndim=1, mode='c'] _mass = np.ascontiguousarray(mass)
        cdef np.ndarray[np.float64_t, ndim=1, mode='c'] _sz = np.ascontiguousarray(sz)
        cdef np.ndarray[itype_t, ndim=1, mode='c'] _comp = np.ascontiguousarray(comp)
        cdef np.ndarray[itype_t, ndim=1, mode='c'] _clus = np.ascontiguousarray(clus)
        cdef np.ndarray[np.float64_t, ndim=2, mode='c'] force = np.ascontiguousarray(np.zeros((nPts, 3), dtype=np.float64))
        self.thisptr.init(nPts, &_pos[0,0], &_mass[0], &_sz[0], &_comp[0], &_clus[0])
        self.thisptr.computeRepulsion(&force[0,0], repulseK, giantComponent, isCirc, avoidColl)
        return force
