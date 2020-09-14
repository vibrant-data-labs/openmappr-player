# -*- coding: utf-8 -*-
"""
Created on Tue May 20 08:18:47 2014

@author: rich
"""

import sys
import math
import ReadData as rd
import numpy as np
import scipy as sp
from scipy.sparse import csr_matrix
from scipy.sparse import vstack

from .. import ResponseDataCache

headerFLAG = 'FLAG'

useFlag = '__use__'

def _writeStatusLine(s):
    sys.stdout.write(s + '\r')
    sys.stdout.flush()

def strisempty(strVal):
    return isinstance(strVal, basestring) and len(strVal) == 0

# build response data for a particular (filtered) set of questions and responses
# for each respondent, build a dict of responses:
# {questionID, value} for numeric responses
# {questionID, [{answerID, value}] for categorical responses
# also adds an answerHistog object to each question's answerInfo
def buildResponseData(data, minAnsweredFrac, keepDisconnected, responseFilters, headerID, buildHistog):
    nbins = 5
    def buildResponse(wt, qType, qWt):
        return {'val': wt, 'qType': qType, 'qWt': qWt}
        
    # add value to question answer histogram
    # val is integer >= 0, histog is a list
    def addValue(histog, val):
        if buildHistog :
            while val >= len(histog):
                histog.append(0)
            histog[val] = histog[val] + 1
    
    # add answer and value to global answer histogram
    def addAnsValue(histog, ans, val):
        try:
            histog[val]['count'] = histog[val]['count'] + 1
        except:
            histog[val] = {'answer': ans, 'count': 1}
    
    responses = data['responses']
    questions = data['questions']['questions']
    # find min number of questions that must be answered to include an entity
    # entities with no attributes are always disconnected
    nQues = 0
    for qid, ques in questions.iterrows():
        qType = int(ques[rd.headerQuestionType])
        if qType != rd.qType_Subjective and qType != rd.qType_Metadata:
            nQues += 1
    minAnswered = int(minAnsweredFrac*nQues)
    # make sure at least one question is answered if minAnsweredFrac > 0
    if nQues > 0 and minAnswered == 0 and minAnsweredFrac > 0:
        minAnswered = 1
    # analyze responses
    responseVectors = {}
    globalAnswers = {}
    responseHistogs = {}    # dict of question ID and response histogram
    # for each respondent
    i = 0
    for rid, response in responses.iterrows():
        # _writeStatusLine('Processing Response ' + str(i))
        i += 1
        skip = False
        # ignore filtered responses
        for rFilter in responseFilters:
            if rFilter(response) == False:
                skip = True
                break
        if skip == True:
            continue
        responseVec = {}    # dict of question id and response value
        nAnswered = 0
        # loop through headers in response table
        for header in responses.columns:     
            if header in questions.index and header in data['answers']:
                question = questions.loc[header]
                # header is a question
                answerInfo = data['answers'][header]
                answer = response[header]
                empty = answer is None or (isinstance(answer, basestring) and len(answer) == 0) or (isinstance(answer, float) and np.isnan(answer))
                qType = answerInfo['qType']
                qWt = answerInfo['qWt']
                if empty == False and qType != rd.qType_Subjective and qType != rd.qType_Metadata:     # answer is not empty
                    nAnswered += 1
                    qID = int(question[rd.headerQID])
                    qIDStr = str(qID)
                    if qIDStr not in responseHistogs:
                        responseHistogs[qIDStr] = {'histog': answerInfo['histog']}
                    # add to response vector for each question type
                    if qType == rd.qType_Numerical or qType == rd.qType_WtdFeature:
                        if rd.isFloat(answer):
                            answer = float(answer)
                            range = answerInfo['max'] - answerInfo['min']
                            if range > 0:
                                # normalize the response value so that median = 0.5 
                                if answer <= answerInfo['median']:
                                    if answerInfo['median'] > answerInfo['min']:
                                        val = 0.5 * (answer - answerInfo['min'])/(answerInfo['median'] - answerInfo['min'])
                                    else:
                                        val = 0.0
                                else:
                                    if answerInfo['median'] < answerInfo['max']:
                                        val = 0.5 * (1 + (answer - answerInfo['median'])/(answerInfo['max'] - answerInfo['median']))
                                    else:
                                        val = 1.0
                                #val = (answer - answerInfo['min'])/range
                            else:
                                val = 0
                            val = max(min(1.0, val), 0.0)
#                            if val < 0.0 or val > 1.0:
#                               print("Response " + str(rid) + " Numerical data error.  Question: " + qIDStr + ", answer " + str(answer) + " is out of range")
#                              print(answerInfo)
                            valBin = int(math.floor(val*nbins) if val < 1 else nbins-1)
                            answerVec = buildResponse(val, qType, qWt)
                            answerVec['answer'] = answer
                            answerVec['bin'] = valBin
                            responseVec[qIDStr] = answerVec
                            addValue(answerInfo['histog'], valBin)
                            addAnsValue(globalAnswers, valBin, (qIDStr, valBin))
                        else:
                            print("Response " + str(response[headerID]) + " Numerical data error.  Question: " + qIDStr + ", answer " + repr(answer) + " is not a number")
                    elif qType == rd.qType_Ordinal:
                        if isinstance(answer, float) and int(answer) == answer:
                            answer = str(int(answer))
                        else:
                            answer = str(answer)
                        if answer not in answerInfo['options'] and answerInfo['hasOther'] is True:
                            answer = rd.responseOther
                        if answer in answerInfo['options']: # protect against bad data
                            idx = answerInfo['options'].index(answer)
                            val = float(idx)/(len(answerInfo['options']) - 1)
                            answerVec = buildResponse(val, qType, qWt)
                            answerVec['answer'] = answer
                            answerVec['idx'] = idx
                            responseVec[qIDStr] = answerVec
                            addValue(answerInfo['histog'], idx)
                            addAnsValue(globalAnswers, answer, (qIDStr, idx))
                        else:
                            print("Response " + str(rid) + " Ordinal data error.  Question: " + qIDStr + ", couldn't find response " + str(answer))
                    elif qType == rd.qType_MultiCategory or qType == rd.qType_MultiOrdinal:
                        nResp = len(answerInfo['options'])
                        valwts = rd.getAttrValueList(answer)
                        values = zip(valwts[0], valwts[1]) if valwts[1] != None else zip(valwts[0], [1]*len(valwts[0]))
                        nAnswer = len(values)
                        if nAnswer > 0:
                            wt = 0.5*math.sqrt(1.0/answerInfo['avgResponses'])  # normalize by average number of responses
                            answers = []
                            answerVec = {
                                'qType': qType,
                                'qWt': qWt,
                                'answers': answers,
                                'nResponse': nResp     # total number of responses (tags)
                            }
                            responseMap = answerInfo['responseMap']
                            for valwt in values:
                                responseOption = valwt[0]
                                thiswt = valwt[1]*wt
                                if responseOption in responseMap:
                                    idx = responseMap[responseOption]
                                    answers.append((idx, thiswt))   # store answers as index,val as is usually sparse
                                    addValue(answerInfo['histog'], idx)
                                    addAnsValue(globalAnswers, responseOption, (qIDStr, idx))
                            responseVec[qIDStr] = answerVec
                    elif qType == rd.qType_BiCategory:
                        if answer in answerInfo['options']:
                            idx = answerInfo['options'].index(answer)
                            wt = 0.25 if idx == 2 else 0.5
                            nAnswer = 2 if idx == 2 else 1
                            addValue(answerInfo['histog'], idx)
                            addAnsValue(globalAnswers, answer, (qIDStr, idx))
                        else:
                            wt = 0.0
                        answers = []
                        answerVec = {}
                        answerVec['answers'] = answers
                        answerVec['qType'] = qType
                        answerVec['qWt'] = qWt
                        # add weight for option A
                        if idx == 0 or idx == 2:
                            answers.append(wt)
                        else:
                            answers.append(0)
                        # add weight for option B
                        if idx == 1 or idx == 2:
                            answers.append(wt)
                        else:
                            answers.append(0)
                        responseVec[qIDStr] = answerVec
                    elif qType == rd.qType_Category:
                        wt = 0.5
                        answers = np.zeros(len(answerInfo['options']))
                        answerVec = {
                            'answers': answers,
                            'qType': qType,
                            'qWt': qWt
                        }
                        if answer in answerInfo['responseMap']:
                            idx = answerInfo['responseMap'][answer]
                            answerVec['idx'] = idx
                            answers[idx] = wt
                            addValue(answerInfo['histog'], idx)
                            addAnsValue(globalAnswers, answer, (qIDStr, idx))
                        responseVec[qIDStr] = answerVec
                    elif qType == rd.qType_Hierarchical:
                        nResp = len(answerInfo['options'])
                        valwts = rd.getAttrValueList(answer)
                        values = valwts[0]
                        nAnswer = len(values)
                        idx = 0
                        answers = []
                        answerVec = {
                            'qType': qType,
                            'qWt': qWt,
                            'answers': answers,
                            'nResponse': nResp
                        }
                        for responseOption in answerInfo['options']:
                            if responseOption in values:
                                answers.append(idx)
                                addValue(answerInfo['histog'], idx)
                                addAnsValue(globalAnswers, responseOption, (qIDStr, idx))
                            idx += 1
                        responseVec[qIDStr] = answerVec
        if nAnswered >= minAnswered or keepDisconnected:
            if nAnswered < minAnswered:
                responseVec = {}
            responseVectors[rid] = responseVec
    #wtConst = 0.5
    for qIDStr, histogData in responseHistogs.iteritems():
        h = np.array(histogData['histog'])
        hvals = h[h!=0]
        if len(hvals) > 0:
            med = np.median(hvals)
            # weight is normalized inverse of value frequency in each histogram bin
            # common values are downweighted
            wtConst = 0.7
            relh = h/med                # compute relative frequency of each value
            relh[relh < wtConst] = wtConst      # don't upweight rare values
            #histogData['weights'] = (1.0 + wtConst)/(wtConst + relh)
            histogData['weights'] = 1.0/relh
        else:
            histogData['weights'] = np.ones(len(h))
    globalUserIDs = {}    # hash id and index
    for userID in responseVectors.iterkeys(): 
        globalUserIDs[userID] = len(globalUserIDs)
    responseData = {}
    responseData['responseVectors'] = responseVectors
    responseData['userIDs'] = globalUserIDs
    responseData['globalAnswers'] = globalAnswers
    responseData['responseHistogs'] = responseHistogs
    print("[ProcessResponses.buildResponseData] Got %s entities" % str(len(responseVectors)))
    return responseData

def buildFeatureVectors(responseData, globalIDs, globalAnswers, weightByFreq=False):
    # each item is a [] of attribute values - a numpy array of values
    # entities is []
    # globalIDs maps {attributeValueId, index}
    # globalAnsList is [attributeValueId] so index can get attribute value
    nan = float('nan')  # used to indicate missing value
    def addGlobalID(idStr):
        if idStr not in globalIDs:
            globalIDs[idStr] = len(globalIDs)
            globalAnswers.append(idStr)

    def extendAnswerVec(n, featureVec):
        n += featureVec.shape[0]
        featureVec.resize(n, refcheck=False)
    
    print("[buildFeatureVectors] processing %s items" % len(responseData['responseVectors']))
    featureVectors = {}
    i = 0
    #iterate over each entity
    for item in responseData['responseVectors'].iteritems():
        # _writeStatusLine('Building Feature Vector ' + str(i))
        i += 1
        rid = item[0]    # respondent id
        responses = item[1]
        if len(responses) == 0: # empty response
            featureVec = np.array([])
        else:
            featureVec = np.full(len(globalIDs), nan)
        # iterate over each question in a response
        for responseItem in responses.iteritems():
            qIDStr = responseItem[0]
            weights = responseData['responseHistogs'][qIDStr]['weights']
            response = responseItem[1]
            qType = response['qType']
            qWt = response['qWt']
            if qType == rd.qType_Numerical or qType == rd.qType_Ordinal:
                wt = qWt * (weights[response['bin']] if weightByFreq else 1.0)
                id0 = (qIDStr, "Low")
                id1 = (qIDStr, "Mid")
                id2 = (qIDStr, "High")
                if id0 not in globalIDs:
                    extendAnswerVec(3, featureVec)
                    addGlobalID(id0)
                    addGlobalID(id1)
                    addGlobalID(id2)
                val = response['val']
                if val == 0:
                    featureVec[globalIDs[id0]] = wt
                    featureVec[globalIDs[id1]] = 0.0
                    featureVec[globalIDs[id2]] = 0.0
                elif val < 0.5:
                    featureVec[globalIDs[id0]] = wt*math.cos(math.pi*val) 
                    featureVec[globalIDs[id1]] = wt*math.sin(math.pi*val)
                    featureVec[globalIDs[id2]] = 0.0
                elif val == 0.5:
                    featureVec[globalIDs[id0]] = 0.0
                    featureVec[globalIDs[id1]] = wt
                    featureVec[globalIDs[id2]] = 0.0
                elif val < 1:
                    featureVec[globalIDs[id0]] = 0.0
                    featureVec[globalIDs[id1]] = wt*math.sin(math.pi*val)
                    featureVec[globalIDs[id2]] = -wt*math.cos(math.pi*val)
                elif val == 1:
                    featureVec[globalIDs[id0]] = 0.0
                    featureVec[globalIDs[id1]] = 0.0
                    featureVec[globalIDs[id2]] = wt
            elif qType == rd.qType_WtdFeature:
                id0 = (qIDStr, "")
                if id0 not in globalIDs:
                    extendAnswerVec(1, featureVec)
                    addGlobalID(id0)
                featureVec[globalIDs[id0]] = qWt * response['val']
            elif qType == rd.qType_MultiCategory or qType == rd.qType_MultiOrdinal:
                idVal = (qIDStr, 0)
                nResp = response['nResponse']
                # add to globalIDs and featureVec if needed
                if idVal not in globalIDs:
                    extendAnswerVec(nResp, featureVec)
                    for idx in range(nResp):
                        addGlobalID((qIDStr, idx))
                else:
                    start = globalIDs[idVal]
                    featureVec[start:start+nResp] = 0

                # add response values
                idx = globalIDs[idVal]
                for a in response['answers']:
                    wt = qWt * (weights[a[0]] if weightByFreq else 1.0)
                    featureVec[idx + a[0]] = wt*a[1]
            else:   # categorical
                wt = qWt * (weights[response['idx']] if weightByFreq else 1.0)
                idVal = (qIDStr, 0)
                nAns = len(response['answers'])
                # add to globalIDs and featureVec if needed
                if idVal not in globalIDs:
                    extendAnswerVec(nAns, featureVec)
                    for idx in range(nAns):
                        addGlobalID((qIDStr, idx))
                else:   # clear out the section of the feature vector
                    start = globalIDs[idVal]
                    featureVec[start:start+nAns] = 0
                # add response values
                idx = globalIDs[idVal];
                indices = np.nonzero(response['answers'])[0]
                for ii in indices:
                    val = response['answers'][ii]
                    featureVec[idx + ii] = wt * val
        featureVectors[rid] = featureVec
    # pad any short vectors to full length and fill empty features with 0
    nFeatures = len(globalIDs)
    for vecKey, vec in featureVectors.iteritems():
        nf = vec.shape[0]
        if nf == 0:     # empty - disconnected because no data
            vec = np.zeros(nFeatures)
        elif nf < nFeatures:      # vector is short, pad it with nan (missing value)
            print("Padding vector %s "% repr(vecKey))
            vec = np.pad(vec, (0,nFeatures-nf), mode='constant', constant_values=(nan,))
        featureVectors[vecKey] = csr_matrix(vec)    # store as sparse 1xn matrix
    print("Feature vectors have %s components" % str(len(globalAnswers)))
    responseData['featureVectors'] = featureVectors
    responseData['globalAnsList'] = globalAnswers
    responseData['globalAnswerIDs'] = globalIDs

# compute similarity using cosine similarity
# if features contain NaN, then there was some missing data so feature vectores have different lengths
# in this case, fill missing values with mean so there is no net effect on similarity
def computePairwiseFeatureSimilarities(responseData):
    items = responseData['featureVectors'].items()
    nItems = len(items)
    print("[ProcessResponses.computePairwiseFeatureSimilarities] Computing similarities for %s entities" % str(nItems))
    # build feature matrix from feature vectors
    itemVecs = [item[1][0] for item in items]
# NOTE: test whether the following line works:
#    itemVecs = [item[1] for item in items]
    featureMatrix = vstack(itemVecs)
    if np.isnan(featureMatrix.sum()): # featureMatrix contains Nan, fill missing values with mean
        print("[ProcessResponses.computePairwiseFeatureSimilarities] Filling missing values")
        fm = featureMatrix.todense()
        missing = np.asarray(np.isnan(fm))
        colMean = np.nanmean(fm, axis=0)    # column mean of feature values
        colMean = np.repeat(colMean, nItems, axis=0)
        np.asarray(fm)[missing] = np.asarray(colMean)[missing]       # fill missing with mean
        featureMatrix = csr_matrix(fm)
    # cosine similarity computation
    # feature dot product
    print("[ProcessResponses.computePairwiseFeatureSimilarities] Computing similarity from features %s" % repr(featureMatrix.shape))
    print("Compute dot product")
    featureDot = np.array(featureMatrix.dot(featureMatrix.T).todense())
    # compute inverse feature lengths
    print("Compute inverse feature lengths")
    inverseFeatureLenSq = 1.0/np.diag(featureDot)
    inverseFeatureLenSq[np.isinf(inverseFeatureLenSq)] = 0
    inverseFeatureLen = np.sqrt(inverseFeatureLenSq)
    # normalize dot product to get cosine sim
    print("Normalize dot product to get cosine sim")
    sim = (featureDot * inverseFeatureLen).T * inverseFeatureLen
    print("Clean nan values and clear diagonal")
    sim[np.isnan(sim)] = 0.0  # convert nans produced by empty feature vectors
    np.fill_diagonal(sim, 0.0)
    print("Done computing similarity matrix")
    return sim

# get top features for a pair of feature vectors
# top features are those that contribute most to the vectors' similarity (dot product)
# feature vectors are 1xn sparse matrices
#
def getTopFeatures(answerList, data1, data2):
    # convert to arrays so the following works
    data1 = np.asarray(data1.todense())[0]
    data2 = np.asarray(data2.todense())[0]
    # convert nan values so the following works
    data1[np.isnan(data1)] = 0      
    data2[np.isnan(data2)] = 0
    # compute dot product
    prod = data1*data2
    mx = np.amax(prod)
    if mx > 0:
        topAnsIdx = np.argwhere(prod >= 0.05*mx).flatten().tolist()
        topAnsIdx.sort(key=lambda i: prod[i], reverse=True)
        #print("Top answer values: " + str([prod[i] for i in topAnsIdx]))
    else:
        topAnsIdx = []
    # get text strings of the top features, add normalized weight
    topFeatures = [(answerList[x], prod[x]/mx) for x in topAnsIdx]
    return topFeatures

# for each nonzero similarity, get relevant top answers and add to list
# linkingAttribute is (question, answer) pair, dereferenced to give readable values
# used when computing feature-based (not whole-attribute based) similarity   
# topFeature is (attribute, value, weight)
def getSimDataWithTopFeatures(data, responseData, simMat):
    simData = []
    qIDs = data['questions']['qIDs']
    ga = responseData['globalAnswers']
    if np.count_nonzero(simMat) > 0:
        items = responseData['featureVectors'].items()
        userIDs = responseData['userIDs']
        # loop through each pair of respondents
        indices = np.transpose(np.nonzero(simMat))
        print("[ProcessResponses.getSimDataWithTopFeatures] processing " + str(len(indices)) + " links" )
        for idx in indices:
            # i = idx[0][0]
            # j = idx[0][1]
            i = idx[0]
            j = idx[1]
            topFeatures = getTopFeatures(responseData['globalAnsList'], items[i][1], items[j][1])
            # convert from indices to text representations
            newTF = []
            for tf in topFeatures:
                if tf[0] in ga:
                    newTF.append((qIDs[int(tf[0][0])], ga[tf[0]]['answer'], tf[1]))
                else:
                    newTF.append((qIDs[int(tf[0][0])], tf[0][1], tf[1]))
            simData.append({'i': i,
                            'j': j,
                            'id1': userIDs[items[i][0]],
                            'id2': userIDs[items[j][0]],
                            'similarity': simMat[i,j],
                            'linkingAttributes': newTF})
        print("[ProcessResponses.getSimDataWithTopFeatures] Done" )
    return simData
    
def responseFilterFlag(response):
    if headerFLAG in response:
        return response[headerFLAG] < 2
    return True

def questionFilterPersonality(qData):
    return qData['Personality'] != 0
    
def questionFilterCreativity(qData):
    return qData['Creativity'] != 0

# buid response vectors and compute similarity matrix
#
def processResponses(rawData, headerID, questionTextHeader, filters = None, minAnsweredFrac = 0.5, keepDisconnected=False, doRnd=False, weightByFreq=False):
    # read in and prepare raw data
    print("Reading and preparing raw data, minFrac = "  + str(minAnsweredFrac))
    data = rd.readQuestionAndResponseData(rawData, questionTextHeader, doRound=doRnd)
    data['questions']['questions'] = data['questions']['questions'].set_index(rd.headerQuestion)
    data['responses'] = data['responses'].set_index(headerID)
    
    if filters == None:
        filters = [responseFilterFlag]
    # response data contains filtered data used in subsequent analysis
    print("Building response data")
    responseData = buildResponseData(data, minAnsweredFrac, keepDisconnected, filters, headerID, True)
    if len(responseData['responseVectors']) == 0:
        return None
    #print(responseData['responseVectors'])
    # compute similarity matrix
    print("Computing similarity matrix")
    print("Building feature vectors")
    buildFeatureVectors(responseData, {}, [], weightByFreq=weightByFreq)
    #print(responseData['featureVectors'])
    print("Computing feature similarity")
    simData = computePairwiseFeatureSimilarities(responseData)
    return {'data': data, 'responseData': responseData, 'simData': simData}

# compute similarity of one node against all nodes in the network using cosine similarity
# if features contain NaN, then there was some missing data so feature vectores have different lengths
# in this case, fill missing values with mean so there is no net effect on similarity
# returns array of {'id', 'sim', 'linkingAttributes'} where is if node id, sim is similarity
def computeNodeFeatureSimilarities(responseData, nodeData):
    nodeFeatures = nodeData['featureVectors'].items()[0][1]
    items = responseData['featureVectors'].items()
    nItems = len(items)
    print("[ProcessResponses.computeNodeFeatureSimilarities] Computing similarities for %s entities" % str(nItems))
    # build feature matrix from feature vectors
    itemVecs = [item[1] for item in items]
    featureMatrix = vstack(itemVecs)
    fmHasNan = np.isnan(featureMatrix.sum())
    nfHasNan = np.isnan(nodeFeatures.sum())
    if fmHasNan or nfHasNan: # featureMatrix contains Nan, fill missing values with mean
        print("[ProcessResponses.computeNodeFeatureSimilarities] Filling missing values")
        fm = featureMatrix.todense()
        colMean = np.nanmean(fm, axis=0)    # column mean of feature values
        if fmHasNan:
            missing = np.asarray(np.isnan(fm))
            colMeanMat = np.repeat(colMean, nItems, axis=0)
            np.asarray(fm)[missing] = np.asarray(colMeanMat)[missing]       # fill missing with mean
            featureMatrix = csr_matrix(fm)
        if nfHasNan:
            print("Fill missing node features")
            nf = nodeFeatures.todense()
            missing = np.asarray(np.isnan(nf))
            nf[missing] = np.asarray(colMean)[missing]  # fill missing with mean
            nodeFeatures = csr_matrix(nf)

    # cosine similarity computation
    # feature dot product
    print("[ProcessResponses.computeNodeFeatureSimilarities] Computing similarity from features %s" % repr(featureMatrix.shape))
    print("[ProcessResponses.computeNodeFeatureSimilarities] Compute dot product")
    featureDot = np.array(featureMatrix.dot(nodeFeatures.T).todense()).flatten()
    # compute inverse feature lengths
    print("[ProcessResponses.computeNodeFeatureSimilarities] Compute feature lengths")
    featureLen = np.squeeze(np.asarray(np.sqrt(featureMatrix.multiply(featureMatrix).sum(1).flatten())))
    nodeFeatureLen = sp.sparse.linalg.norm(nodeFeatures)
    # normalize dot product to get cosine sim
    print("[ProcessResponses.computeNodeFeatureSimilarities] Normalize dot product to get cosine sim")
    sim = featureDot/(featureLen*nodeFeatureLen)
    # Clean nan values
    sim[np.isnan(sim)] = 0.0  # convert nans produced by empty feature vectors
    # build sorted array of (id, similarity) tuples
    simInfo = [{'id': items[i][0], 'sim': sim[i], 'idx': i} for i in range(nItems)]
    simInfo.sort(key=lambda info: info['sim'], reverse=True)
    # truncate to at most 8 items
    maxSim = simInfo[0]['sim']
    maxNodes = 8
    i = 0
    if maxSim > 0:
        for i in range(nItems):
            sim = simInfo[i]['sim']
            if sim < maxSim and (i == maxNodes or sim < maxSim/2):
                break
    simInfo = simInfo[:i]
    # add linkingAttribute info
    print("[ProcessResponses.computeNodeFeatureSimilarities] Get linking attributes" )
    qIDs = responseData['qIDs']
    ga = responseData['globalAnswers']
    linkingAttributes = {}
    for si in simInfo:
        topFeatures = getTopFeatures(responseData['globalAnsList'], nodeFeatures, items[si['idx']][1])
        # convert from indices to text representations
        newTF = []
        for tf in topFeatures:
            if tf[0] in ga:
                newTF.append((qIDs[int(tf[0][0])], ga[tf[0]]['answer'], tf[1]))
            else:
                newTF.append((qIDs[int(tf[0][0])], tf[0][1], tf[1]))
        sim = si['sim']
        si['linkingAttrs'] = newTF[:4]
#        for la in newTF:
#            if la[0] not in linkingAttributes:
#                linkingAttributes[la[0]] = {}
#            val = linkingAttributes[la[0]]
#            if la[1] not in val:
#                val[la[1]] = 0
#            val[la[1]] += la[2]*sim
    # assemble and sort linking attributes, and take the top 4
#    linkingAttributes = [(attr, k, v) for attr, val in linkingAttributes.iteritems() for k, v in val.iteritems()]
#    linkingAttributes.sort(key=lambda la: la[2], reverse=True)
#    linkingAttributes = linkingAttributes[:4]
#    print linkingAttributes
    print("[ProcessResponses.computeNodeFeatureSimilarities] Done computing similarities")
#    return [(si['id'], si['sim'], si['linkingAttrs']) for si in simInfo]
    return [(si['id'], si['sim']) for si in simInfo]

# get feature vectors of dataset, or of a single node with associated dataset information
# precomputed feature data might be stored in a cache
#
def getDatasetFeatures(rawData, datasetId, networkId, headerId, minAnsweredFrac = 0.5, weightByFreq=False, globalIDs = None, globalAnswers = None, answers = None):
    buildHistog = True
    if globalIDs is None or globalAnswers is None:
        globalIDs = {}
        globalAnswers = []
    responseData = rawData['responseData'] if 'responseData' in rawData else None
    if responseData == None:
        # read in and prepare raw data
        print("[getDatasetFeatures] Reading and preparing raw data, minFrac = "  + str(minAnsweredFrac))
        data = rd.readQuestionAndResponseData(rawData, None, doRound=False)
        data['questions']['questions'] = data['questions']['questions'].set_index(rd.headerQuestion)
        data['responses'] = data['responses'].set_index(headerId)
        # add full answer histogram data
        if answers:
            data['answers'] = answers
            buildHistog = False
    
        # response data contains filtered data used in subsequent analysis
        print("[getDatasetFeatures] Building response data")
        responseData = buildResponseData(data, minAnsweredFrac, True, [], headerId, buildHistog)
        if len(responseData['responseVectors']) == 0:
            return None
        # compute feature vectors
        print("[getDatasetFeatures] Building feature vectors")
        buildFeatureVectors(responseData, globalIDs, globalAnswers, weightByFreq=weightByFreq)
        responseData['answers'] = data['answers']
        responseData['qIDs'] = data['questions']['qIDs']
        attrs = data['questions']['questions'].reset_index()
        responseData['attrs'] = [dict(attrs.iloc[i]) for i in range(len(attrs))]
        ResponseDataCache.addCachedResponseData(responseData, datasetId, networkId)
    return responseData
