# -*- coding: utf-8 -*-
"""
Created on Thu Sep 18 09:25:00 2014

@author: rich
"""

import sys
import re
import ast
import numpy as np
from collections import Counter

headerQuestion = 'Question'
headerQID = 'qID'
headerQuestionType = 'qAnalysisType'
headerQuestionWeight = 'qWeight'
headerPossibleResponses = 'Possible Responses'

# responseOther = 'Other:'  # used in original survey data
responseOther = 'Other'

qType_Metadata = -1
qType_Subjective = 0
qType_Numerical = 1
qType_Ordinal = 2       # pick one from an ordered list of options
qType_MultiCategory = 3 # pick one or more from a list of options
qType_BiCategory = 4    # answers of the form A, B, A and B, (neither), (other)
qType_Category = 5      # pick one
qType_Hierarchical = 6  # pick one or more, each option is hierarchical, colon separated
qType_MultiOrdinal = 7  # pick one or more from an ordered list of options
qType_WtdFeature = 8    # int/float is zero-based feature weight

def isFloat(str):
    try:
        float(str)
        return True
    except ValueError:
        return False

# get attribute list and optional weights for multi-valued attributes
def getAttrValueList(values):
    weights = None
    if values == None or (isinstance(values, float) and np.isnan(values)):
        return ([], weights)
    if values == 'None':
        return (['None'], weights)
    if type(values) != list:
        try:
            values = ast.literal_eval(values)
            if not isinstance(values, list):
                values = [values]
        except:     # in case there's an unparseable string, perhaps multiple values are separated by ; or |
            try:
                values = [x.strip() for x in re.split(";|\|", values)]
            except:
                print values
                values = []
    values = filter(None, values)    # filter out empty strings
    if len(values) > 0 and (type(values[0]) == list or type(values[0]) == tuple):
        valwts = zip(*values)
        values = list(valwts[0])
        weights = list(valwts[1])
    return (values, weights)


def readQuestionAndResponseData(rawData, questionTextHeader, filters = [], doRound = False):
    questionData = rawData['questions']
    responseData = rawData['responses']
    questionTextHeader = questionTextHeader if (questionTextHeader != None and len(questionTextHeader) > 0) else headerQuestion
    # read in and process the questions
    # get questions
    print("[ReadData.readQuestionAndResponseData] Processing %s question rows" % str(len(questionData)))
    #print(questionData)
    qIDs = {int(question[headerQID]): question[questionTextHeader] for idx, question in questionData.iterrows()}
    # read in the responses
    # get headers
    # get responses
    print("[ReadData.readQuestionAndResponseData] Processing %s entity rows" % str(len(responseData)))
    # questions is a data frame of questions and an {ID, question text} dict
    data = {'questions': {'rawQuestions': questionData, 'questions': questionData, 'qIDs' : qIDs},
            'responses': responseData}
    cleanQuestions(data)
    buildAnswerMetadata(data, doRound)
    filterQuestions(data, filters)
    return data

# build metadata about each question's answers
# record question type and possible answer values (numeric range or list of choices)
def buildAnswerMetadata(data, doRound):
    questionData = data['questions']['questions']
    responseData = data['responses']
    gotPossibleResponses = headerPossibleResponses in questionData.columns
    answers = {}
    answerIdx = {}  # map question id and quesion text
    print("[ReadData.buildAnswerMetadata] Processing %s questions" % str(len(questionData)))
    for idx, qData in questionData.iterrows():
        question = qData[headerQuestion]
        qType = int(qData[headerQuestionType])
        qWt = float(qData[headerQuestionWeight]) if headerQuestionWeight in qData else 1.0
        scan = False
        # question sheet has answer metadata
        if gotPossibleResponses and qData[headerPossibleResponses] is not None:
            responses = qData[headerPossibleResponses].split('|')
            if qType == qType_Numerical or qType == qType_WtdFeature:
                if responses[0] == 'numeric' or doRound == True:
                    answer = {'qType': qType, 'qWt': qWt}
                    answer['min'] = sys.float_info.max
                    answer['max'] = sys.float_info.min
                    scan = True
                else:
                    answer = {'qType': qType, 'min': float(responses[0]), 'max': float(responses[1])}
            elif qType == qType_Ordinal:
                nResponses = len(responses)
                answer = {'qType': qType, 'qWt': qWt, 'options': responses, 'nResponses': nResponses}
                answer['hasOther'] = True if 'Other' in responses else False
            # all categorical responses, treat multiOrdinal as categorical for now
            elif qType == qType_MultiCategory or qType == qType_BiCategory or qType == qType_Category or qType == qType_MultiOrdinal:
                nResponses = len(responses)
                if 'Other' in responses:
                    responses.remove(responseOther)
                responseMap = {}
                i = 0
                for response in responses:
                    responseMap[response] = i
                    i += 1
                answer = {'qType': qType, 'qWt': qWt, 'options': responses, 'nResponses': nResponses, 'responseMap': responseMap}
            else:
                answer = {'qType': qType, 'qWt': qWt}
        else:   # no metadata in question sheet, scan all responses to build answer metadata
            scan = True
            # initialize answer metadata
            answer = {'qType': qType, 'qWt': qWt}
            if qType == qType_Numerical or qType == qType_WtdFeature:
                answer['min'] = sys.float_info.max
                answer['max'] = sys.float_info.min
            elif qType == qType_Ordinal or qType == qType_MultiCategory or qType == qType_BiCategory or qType == qType_Category or qType == qType_Hierarchical or qType == qType_MultiOrdinal:
#                answer['options'] = set()
                answer['options'] = Counter()
                if qType == qType_Ordinal:
                    answer['hasOther'] = False
        if scan == True:
            # scan all responses to fill in answer metadata
            responses = responseData[question]
            if qType == qType_Numerical or qType == qType_WtdFeature:
                responses = responses.replace('', float('nan'))
                res = responses[~np.isnan(responses)]
                if len(res) > 0:
                    answer['min'] = min(res)
                    answer['max'] = max(res)
                else:       # skip attribute if it has no values
                    continue
                if doRound:
                    responses = responses.round()
                if qType == qType_WtdFeature:   # force feature min to zero
                    answer['min'] = max(answer['min'], 0)
                answer['median'] = np.median(res)
                #print("Attribute: " + question + " info: " + str(answer))
            elif qType == qType_MultiCategory or qType == qType_BiCategory or qType == qType_Hierarchical or qType == qType_MultiOrdinal:
                tot = 0
                ntot = 0
                for response in responses:
                    ans = getAttrValueList(response)[0]
                    answer['options'].update(ans)
                    if len(ans) > 0:
                        tot += len(ans)
                        ntot += 1
                answer['avgResponses'] = float(tot)/ntot
            elif qType == qType_Ordinal or qType == qType_Category:
                for response in responses:
                    answer['options'].update([response])
            # finalize answer metadata
            if qType == qType_Ordinal:
                responses = sorted(answer['options'])
                answer['options'] = responses
                answer['nResponses'] = len(responses)
            # all other categorical responses
            elif qType == qType_MultiCategory or qType == qType_BiCategory or qType == qType_Category or qType == qType_Hierarchical or qType == qType_MultiOrdinal:
                minTags = 1 if qType == qType_MultiCategory else 0
                responses = [k for k, v in answer['options'].iteritems() if v > minTags]  # keep tags that occur more than once
                answer['options'] = responses
                answer['nResponses'] = len(responses)
                responseMap = {}
                i = 0
                for response in responses:
                    responseMap[response] = i
                    i += 1
                answer['responseMap'] = responseMap
                # build answer similarity for each pair of hierarchical answers
                if qType == qType_Hierarchical:
                    answer['responseSim'] = buildResponseSimilarityMatrix(responses)
        elif qType == qType_Numerical or qType == qType_WtdFeature:
            responses = responses.replace('', float('nan'))
            responses = responseData[question]
            res = responses[~np.isnan(responses)]
            answer['median'] = np.median(res)
        answer['histog'] = []
#        qID = int(qData[0])
        qID = int(qData[headerQID])
        answers[qData[headerQuestion]] = answer
        answerIdx[qID] = qData[headerQuestion]
    data['answers'] = answers
    data['answerIdx'] = answerIdx

# remove any questions (attributes) that are not in the response data
def cleanQuestions(data):
    questions = data['questions']['rawQuestions']
    responseData = data['responses']
    dropList = []
    for idx, qData in questions.iterrows():
        question = qData[headerQuestion]
        if question not in responseData:
            dropList.append(idx)
    data['questions']['questions'] = questions.drop(dropList)

# run one or more filters on the questions to select the questions to process
# questionFilters is an array of functions with arguments (questionData)
# that return boolean True if question is used
def filterQuestions(data, questionFilters):
    questions = data['questions']['rawQuestions']
    dropList = []
    for idx, question in questions.iterrows():
        for qFilter in questionFilters:
            if qFilter(question) == False:
                dropList.append(idx)
    newQuestions = data['questions']['questions'] = questions.drop(dropList)
    print("Processing %s filtered questions" % str(newQuestions.shape[0]))

# compute similarity for each pair of hierarchical responses
def buildResponseSimilarityMatrix(responses):
    n = len(responses)
    simmat = np.empty([n,n])
    maxLen = 0
    for i in range(0,n):
        ans1 = [x.strip() for x in responses[i].split(':')]
        len1 = len(ans1)
        if len1 > maxLen:
            maxLen = len1
        for j in range(i,n):
            if i is j:
                simmat[i][j] = len1
            else:
                ans2 = [x.strip() for x in responses[j].split(':')]
                len2 = len(ans2)
                for k in range(0, min(len1, len2)):
                    if ans1[k] != ans2[k]:
                        break
                simmat[i][j] = k
                simmat[j][i] = k
    # normalize with longest hierarchical term
    if maxLen > 1:
        maxLen = maxLen - 1
    maxLen = float(maxLen)
    for i in range(0,n):
        for j in range(0,n):
            simmat[i][j] /= maxLen
    return simmat

def getClusterAggregationData(rawData):
    propName = 'attribute'
    propType = 'type'
    aggOps = 'summary_stats'    # comma separated list of aggregation operations
    try:
        aggData = rawData['aggregation']
        aggDataFinal = {}
        # read in and process the sheet
        # get headers
        aggHeaders = {}
        headerRow = aggData[0]
        for idx in range(len(headerRow)):
            aggHeaders[headerRow[idx].value] = idx
        # get column indices and read data
        propIdx = aggHeaders[propName]
        typeIdx = aggHeaders[propType]
        aggIdx = aggHeaders[aggOps]
        for aggRow in aggData:
            aggOpList = [x.strip() for x in aggRow[aggIdx].split(',')]
            for aggOp in aggOpList:
                aggDataFinal[aggRow[propIdx]] = {propType: aggRow[typeIdx], aggOp: aggOp}
    except:
        aggDataFinal = None
    return aggDataFinal
