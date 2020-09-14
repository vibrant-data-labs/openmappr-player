# -*- coding: utf-8 -*-
"""
Created on Thu Sep 18 09:40:57 2014

@author: rich
"""
import cProfile

import ReadData as rd
import math
import pandas as pd
import numpy as np

from ProcessResponses import processResponses
from ProcessResponses import getSimDataWithTopFeatures
from SimToNetwork import thresholdSimilarityMatrix
from SimToNetwork import adaptiveSimMatThreshold
from SimToNetwork import buildNetworkX
from SimToNetwork import nodeDataFromNetworkX
from ProcessResponses import getDatasetFeatures
from ProcessResponses import computeNodeFeatureSimilarities

from athena.algorithms.NetworkAnalysis.ComputeProperties import computeNetworkProperties
from athena.algorithms.NetworkAnalysis.ComputeProperties import computeClusterAggregateProperties
from athena.algorithms.NetworkAnalysis.ForceDirected.ForceDirected import forceDirectedLayout


class DummyAlgo:
    def setProgress(self, status, pct):
        return


dummyAlgo = DummyAlgo()


def writeFeatureTable(data, outBase, headerID):
    questions = data['data']['questions']['questions']
    responses = data['data']['responses']
    outFile = outBase + 'Features.txt'
    f = open(outFile, 'w')
    f.write('id')
    # get the features to write and write header line
    features = []
    for header in responses.columns:
        # keep if header is not a reserved question or header type
        keep = header != headerID
        if keep:
            if header in questions:
                question = questions[header]
                # headerText = data['data']['questions']['qIDs'][int(question[qID])]
                qType = question[rd.headerQuestionType]
                keep = (qType == rd.qType_Numerical or qType == rd.qType_Ordinal or qType == rd.qType_WtdFeature)
            else:
                keep = False
        if keep:
            features.append(header)
            f.write('\t' + header)
    f.write('\n')  # end of headers line
    idMap = data['responseData']['userIDs']
    for rid, response in responses.iterrows():
        # response not filtered out (for example because too few responses)
        if rid in idMap:
            f.write(str(rid))
            # loop through headers in features list (selected column names in response table)
            for header in features:
                idVal = questions[header][rd.headerQID]
                try:
                    qID = str(int(idVal))
                except ValueError:
                    qID = str(idVal)
                if qID in data['responseData']['responseVectors'][rid]:
                    responseVal = data['responseData']['responseVectors'][rid][qID]
                    val = responseVal['val']
                    f.write('\t' + str(val))
                else:
                    f.write('\t')
            f.write('\n')
    f.close()


def writeResults(results, outBase):
    outFileQ = outBase + "Sim.txt"
    # write processed data out to files
    if type(results['simData']) is dict:  # write sim from question (attribute) level computation
        writeSimilarity(outFileQ, results['simData'])
    if 'responseData' in results:
        answersFile = outBase + 'AnswerKey.txt'
        idkeyFile = outBase + 'IDKey.txt'
        writeAnswerKey(answersFile, results['responseData']['globalAnswers'])
        writeIDKey(idkeyFile, results['responseData']['userIDs'])


def writeSimilarity(outFile, simData):
    f = open(outFile, 'w')
    f.write('id1\tid2\tsimilarity\tlinkingAttributes\n')
    for item in simData:
        if item['similarity'] > 0:
            topAnswers = ''
            if 'linkingAttributes' in item:
                taLen = len(item['linkingAttributes'])
                for i in range(taLen):
                    topAnswers += str(item['linkingAttributes'][i])
                    if i < (taLen - 1):
                        topAnswers += ','
            f.write(str(item['id1']) + '\t')
            f.write(str(item['id2']) + '\t')
            f.write(str(item['similarity']) + '\t')
            f.write(topAnswers + '\n')
    f.close()


def writeAnswerKey(outFile, data):
    f = open(outFile, 'w')
    f.write('key\tanswer\n')
    for key in data:
        f.write(repr(key) + '\t')
        f.write(repr(data[key]) + '\n')
    f.close()


def writeIDKey(outFile, data):
    f = open(outFile, 'w')
    f.write('id\tindex\n')
    for id in data:
        f.write(repr(id) + '\t')
        f.write(repr(data[id]) + '\n')
    f.close()


# def writeNetwork(outBase, nodeData, linkData):
#    outFile = outBase + "Network.txt"
#    writeSimilarity(outFile, linkData)

# build data that is array of nodedata dicts
def buildNodeData(idMap):
    nodeData = []
    for idVal, idx in idMap.iteritems():
        nodeData.append({'id': idx, '__originalId__': idVal, 'dataPointId': idVal})
    return nodeData


# merge id map and communities
def mergePartitionData(nodeData, partition, partitionName):
    for node in nodeData:
        idx = node['id']
        if idx in partition:
            lVal = partitionName + '_' + str(partition[idx])
            node[partitionName] = lVal
        else:
            node[partitionName] = None


# merge attributes (columns that are not id or questions) from the original raw data
#
def mergeNodeAttributes(nodeData, data, headerID, keepquestions):
    questions = data['questions']['questions']
    attrTable = data['responses']
    dataDict = {}
    dataAttr = []
    for node in nodeData:
        dataDict[node['__originalId__']] = node
    for rid, response in attrTable.iterrows():
        # response not filtered out (for example because too few responses)
        if rid in dataDict:
            # loop through headers in attribute value table
            for header in attrTable.columns:
                headerText = header
                # add to attribute list
                if header != headerID and headerText not in dataAttr:
                    dataAttr.append(headerText)
                # keep if header is not a reserved question or header type
                keep = header != headerID
                if keep and not keepquestions and header in questions.index:
                    question = questions.loc[header]
                    headerText = data['questions']['qIDs'][int(question[rd.headerQID])]
                    qType = question[rd.headerQuestionType]
                    keep = qType == rd.qType_Subjective or qType == rd.qType_Metadata
                if keep == True and response[header] != None:  # keep and got a value
                    val = response[header]
                    dataDict[rid][headerText] = val if not isinstance(val, float) or not math.isnan(val) else None
    return dataAttr


# keepQuestions keeps question columns as node properties
#
def runResponseAnalysis(rawData, params, layoutSteps=500, mergeAttr=False, algo=dummyAlgo):
    # pr = cProfile.Profile()
    # pr.enable()
    # move param values to local variables
    headerID = params['headerID']
    LinksPer = params['linksPer']
    fixedThreshold = params['fixedThreshold']
    keepquestions = params['keepQuestions']
    questionTextHeader = params['qTextHeader']
    minAnsweredFrac = params['minAnsweredFrac']
    doRound = params['doRound']
    keepDisconnected = params['keepDisconnected']
    clusterLevel = params.get('clusterLevel', 0)
    weightByFreq = params['weightByFreq']
    mergeDuplicates = params.get('mergeClusters', False)
    sigAttr = params.get('sigAttr', False)
    filters = None
    # process responses and compute similarities
    # if keepDisconnected == True:
    #    minAnsweredFrac = 0
    algo.setProgress("Analyzing Similarities..", 30)
    data = processResponses(rawData, headerID, questionTextHeader, filters, minAnsweredFrac, keepDisconnected, doRound,
                            weightByFreq)
    if data == None:
        return None
    print("Thresholding similarities to build network")
    # build basic node data to add attributes to
    nodeData = buildNodeData(data['responseData']['userIDs'])
    algo.setProgress("Thresholding similarities to build network...", 40)
    if LinksPer > 0:
        simMat = thresholdSimilarityMatrix(data['simData'], LinksPer, fixed=fixedThreshold)
    else:
        simMat = adaptiveSimMatThreshold(data['simData'], nodeData, fixed=fixedThreshold)

    algo.setProgress("Getting linking attributes values...", 50)
    linkData = getSimDataWithTopFeatures(data['data'], data['responseData'], simMat)

    print("[BuildResponseNetwork.runResponseAnalysis] Thresholded network contains %s links" % str(len(linkData)))
    # build basic node data to add attributes to
    nodeData = buildNodeData(data['responseData']['userIDs'])
    print("[BuildResponseNetwork.runResponseAnalysis] Network contains %s nodes" % str(len(nodeData)))
    print("Merging attributes into network")
    dataAttr = mergeNodeAttributes(nodeData, data['data'], headerID, keepquestions)

    # compute clustering and network properties, including naming and other cluster info
    print('Computing network properties')
    algo.setProgress("Computing network properties...", 60)
    g = buildNetworkX(linkData, nodeData, la='linkingAttributes')
    nodeAttrs = rawData['nodeAttrs'] if 'nodeAttrs' in rawData else None
    clusterData = computeNetworkProperties(g, algo,
                                           ctrlparams={'nLinkingAttr': len(data['data']['questions']['questions']),
                                                       'nodeAttrs': nodeAttrs, 'clusterLevel': clusterLevel,
                                                       'mergeDuplicates': mergeDuplicates, 'sigAttr': sigAttr})
    aggData = rd.getClusterAggregationData(rawData)
    if aggData != None and len(aggData) > 0:
        computeClusterAggregateProperties(g, aggData)

    # pr.disable()
    # pr.dump_stats("profile_stats.prof")
    # pr.print_stats()

    algo.setProgress("Running Force directed layout...", 70)
    print(clusterData)
    if layoutSteps > 0:
        if len(clusterData) > 0:
            cl = 'Clusters'
            if cl not in [val['name'] for val in clusterData]:
                cl = clusterData[0]['name']
            forceDirectedLayout(g, maxSteps=layoutSteps, addToGraph=True, clustering=cl, algo=algo)
        else:
            forceDirectedLayout(g, maxSteps=layoutSteps, addToGraph=True, algo=algo)
    algo.setProgress("Pruning graph...", 81)
    # prune graph if needed
    if keepDisconnected == False:
        g.remove_nodes_from([n for n, d in g.degree_iter() if d == 0])
    # rebuild nodeData with computed properties and possibly with attributes from raw data
    nodeData = nodeDataFromNetworkX(g, excludeAttr=(None if mergeAttr else dataAttr))
    return {'data': data, 'network': g, 'nodeData': nodeData, 'linkData': linkData, 'clusterInfo': clusterData}


def runNodeSimilarity(rawData, node, params, datasetId=None, networkId=None):
    # build a one-line dataset using node, node must have and 'id'
    print("[runNodeSimilarity]")
    # print(node)
    if 'id' not in node:
        node['id'] = 0
    nodeData = {'responses': pd.DataFrame(node, index=[0]),
                'questions': rawData['questions'],
                'responseData': None
                }

    # build or retrieve feature matrix for network and node
    print('[runNodeSimilarity] getting features for network')
    responseData = getDatasetFeatures(rawData, datasetId, networkId, params['headerID'],
                                      minAnsweredFrac=params['minAnsweredFrac'], weightByFreq=params['weightByFreq'])
    print('[runNodeSimilarity] getting features for node')
    nodeData = getDatasetFeatures(nodeData, None, None, params['headerID'], minAnsweredFrac=0,
                                  weightByFreq=params['weightByFreq'], globalIDs=responseData['globalAnswerIDs'],
                                  globalAnswers=responseData['globalAnsList'], answers=responseData['answers'])
    return computeNodeFeatureSimilarities(responseData, nodeData)


def writeResponseFeatureTable(data, outBase, headerID):
    # write feature table
    print("Writing feature table")
    writeFeatureTable(data, outBase, headerID)


## THis function is called by the 1st to params only.
# simMat - entity x entity Matrix of cosine similarities. generally of similar users.
# nodeData - entity and its data. Like Merchant, brands and so on.
def simMatrixToNetwork(simMat, nodeData, nodeAttrs=[], linksPer=3, fixedThreshold=False, layoutSteps=500,
                       keepDisconnected=False, directed=False, algo=dummyAlgo):
    algo.setProgress("Processing similarity matrix...", 20)
    if not directed:
        np.fill_diagonal(simMat, 0)
    # TODO: Explain
    simMat = thresholdSimilarityMatrix(simMat, linksPer, fixedThreshold)
    # TODO: Explain
    linkData = [{
                    'id1': item[0],
                    'id2': item[1],
                    'similarity': simMat[item[0], item[1]]
                } for item in np.transpose(np.nonzero(simMat))]

    print("[BuildResponseNetwork.simMatrixToNetwork] Thresholded network contains %s links" % str(len(linkData)))
    print("[BuildResponseNetwork.simMatrixToNetwork] Network contains %s nodes" % str(len(nodeData)))
    # compute clustering and network properties, including naming and other cluster info
    print('Computing network properties')
    algo.setProgress("Computing network properties...", 40)
    # TODO: Explain
    g = buildNetworkX(linkData, nodeData, la='linkingAttributes', directed=directed)
    # TODO: Explain
    clusterData = computeNetworkProperties(g, algo,
                                           ctrlparams={'nLinkingAttr': 0, 'nodeAttrs': nodeAttrs, 'clusterLevel': 0,
                                                       'mergeDuplicates': False, 'sigAttr': False})
    algo.setProgress("Running Force directed layout...", 70)

    if layoutSteps > 0:
        if len(clusterData) > 0:
            cl = 'Clusters'
            if cl not in [val['name'] for val in clusterData]:
                cl = clusterData[0]['name']
            forceDirectedLayout(g, maxSteps=layoutSteps, addToGraph=True, clustering=cl, algo=algo)
        else:
            forceDirectedLayout(g, maxSteps=layoutSteps, addToGraph=True, algo=algo)

    # prune graph if needed
    if keepDisconnected == False:
        g.remove_nodes_from([n for n, d in g.degree_iter() if d == 0])

    # rebuild nodeData with computed properties and possibly with attributes from raw data
    nodeData = nodeDataFromNetworkX(g, excludeAttr=None)
    return {
        'network': g,
        'nodeData': nodeData,
        'linkData': linkData,
        'clusterInfo': clusterData
    }
