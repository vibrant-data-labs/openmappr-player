#import time

import math
import random
import numpy as np
from collections import Counter

# randomization test of sample of numerical values
# return true if sample is unlikely to have been drawn from the distribution
# test by computing mean and variance of nIter (100) random draws from the full distribution 
# and comparing sample mean and variance to the mean and variance of these random draws.
# Draws are done without replacement.
# Returns true if mean or variance of sample is an outlier compared 
# to the mean or variance of the random draws.
#
# sample is an array of numbers
# distr is an array of numbers
# significance is < 1, typically 0.05
def isSignificantNumeric(sample, distr, significance = 0.05, nIter=100):
#    start = time.time();
    sigInfo = {}
    distrSz = len(distr)
    sampleSz = len(sample)
    if sampleSz < distrSz:
    	sample = np.array(sample)
    	distr = np.array(distr)
    	sum = sample.sum()
    	sumsq = (sample*sample).sum()
        # compute sample mean and variance
        sampleMn = sum/sampleSz
        sampleVar = sumsq/sampleSz - sampleMn*sampleMn
        # compute mean and variance of nIter random draws and sort
        vals = np.array([random.sample(distr, sampleSz) for i in range(nIter)])
        means = np.sum(vals, axis=1)/sampleSz
        vars = np.sum(np.multiply(vals, vals), axis=1)/sampleSz - np.multiply(means, means)        
        means.sort()
        vars.sort()
        # find place of sample in sorted lists of random draws
        meanIdx = np.searchsorted(means, sampleMn)
        varIdx = np.searchsorted(vars, sampleVar)
        loSig = significance*nIter/2
        hiSig = (1 - significance/2)*nIter
        # sample is an outlier if either mean or variance is an outlier
        sigInfo['meanpct'] = float(100)*meanIdx/nIter
        if meanIdx <= loSig:
        	sigInfo['mean'] = 'low'
        elif meanIdx >=hiSig:
        	sigInfo['mean'] = 'high'
        if varIdx <= loSig:
        	sigInfo['var'] = 'low'
        elif varIdx >= hiSig:
        	sigInfo['var'] = 'high'
#    print("numeric (Done) time: " + str(time.time()-start))
    return sigInfo

# randomization test of sample of categorical values
# return true if sample is unlikely to have been drawn from the distribution.
# Test by computing log likelihood of 100 random draws from the full distribution 
# and comparing sample log likelihood to the log likelihood of these random draws.
# Draws are done without replacement.
# Returns true if sample is very likely or unlikely (higher/lower log likelihood than most of the draws)
#
# distr is [{val: count}]
# sample is [{val:count}]
# significance is < 1, typically 0.05
def _likelihoodRatioRandomization(sample, distr, significance, nIter=100):
    # function to compute log likelihood of a sample (array of values)
    def lnLike(s, lnp):
        return sum([lnp[v] for v in s])

    def lnLikeIdx(s, vals, lnp):
        return sum([lnp[vals[idx]] for idx in s])

#    start = time.time();
    sigInfo = {}
    lnp = {}
    nVal = 0
    distrVals = []
    # use distribution to compute probability of each value
    # and accumulate values into an array
    nVal = sum(distr.values())
    distrVals = np.empty(nVal, dtype=int)
    vals = [None]*len(distr)
    total = 0
    idx = 0
    for val, count in distr.iteritems():
        distrVals[total:total+count].fill(idx)
        total += count
        vals[idx] = val
        idx += 1
    distrVals = np.array(distrVals)
    lnp = {val: math.log(float(count)/nVal) for val, count in distr.iteritems()}
    # compute sample log likelihood
    sampleLnL = lnLike(sample, lnp);
    # compute log likelihood of nIter draws from distr
    sampleSz = len(sample)
    rndVals = [random.sample(distrVals, sampleSz) for i in range(nIter)]
    lnLs = np.array([lnLikeIdx(rndVals[i], vals, lnp) for i in range(nIter)])
    lnLs.sort()
    # find place of sample in sorted list of random draws
    idx = np.searchsorted(lnLs, sampleLnL)
    # sample is an outlier if log-likelihood of drawing that sample is an outlier
    if idx <= nIter * significance/2 or idx >= nIter * (1 - significance/2):
        # get up to 5 most frequent sample values
        temp = sample.items()
        temp.sort(key=lambda x: x[1], reverse=True)
        topValues = []
        minCount = max((temp[0][1]+1)/2, 2)
        for info in temp:
            if len(topValues) == 5:
                break
            if info[1] >= minCount:
                topValues.append(repr(info[0]))
        if len(topValues) > 0:
            sigInfo['topValues'] = topValues
        sigInfo['nonRandom'] = True
#    print("likelihood (Done) time: " + str(time.time()-start))
    return sigInfo

# distr is [{val: count}]
# sample is [{val:count}]
# significance is < 1, typically 0.05
def isSignificantCategorical(sample, distr, significance=0.05, nIter=100):
    sampleSz = sum(sample.values())
    if sampleSz > 1 and sampleSz < sum(distr.values()):
        return _likelihoodRatioRandomization(sample, distr, significance, nIter)
    return {}

# test whether vals are likely to have been a random draw from allVals
#
def sigTest(sample, distr, type, sig=0.05):
    if type == 'numeric':
        return isSignificantNumeric(sample, distr, significance=sig)
    elif type == 'string':
        return isSignificantCategorical(Counter(sample), Counter(distr), significance=sig)
    elif type == 'tag':
        def Flatten(values):
            #values = [val.split('|') for val in values]
            return Counter([item for sublist in values for item in sublist])
        return isSignificantCategorical(Flatten(sample), Flatten(distr), significance=sig)
    return {}
