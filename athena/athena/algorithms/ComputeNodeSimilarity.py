import pandas as pd
from ..algoBase import AlgorithmBase
from DataToNetwork.BuildResponseNetwork import runNodeSimilarity

"""compute similarity of node attributes (a set of attribute value pairs) to all nodes in the network
and return a sorted list of (nodeid, similarity) pairs, most similar first.  Nodes returned have similarity greater than half
the maximum similarity, up to a maximum of eight nodes.
The incoming node is {id:val, attr1:val1, attr2:val2...}
Attributes and attribute types come from the attributes used during netgen so there might be more attribute types than
attributes in the node if the node has missing data.
The node cannot have extra data - all attributes in the node must be in the dataset it is being compared against."""

def getAttrType(val):
    if isinstance(val, int) == True:
        return 'integer'
    elif isinstance(val, float) == True:
        return 'float'
    return 'string'

analysisTypesMap = {
    'string': 5,
    'json': -1,
    'twitter': -1,
    'instagram': -1,
    'liststring': 3,
    'boolean': 5,
    'color': -1,
    'integer': 1,
    'float': 1,
    'picture': -1,
    'profile': -1,
    'audio_stream': -1,
    'video_stream': -1,
    'video': -1,
    'html': -1,
    'url': -1,
    'timestamp': -1
}

class ComputeNodeSimilarity(AlgorithmBase):
    status = 1
    options = [
        {
            'key': 'analyseCurrentNetwork',
            'title': 'Analyse nodes in current network',
            'description': 'Analyse nodes in current network',
            'type': 'bool',
            'value': 'Bool',
            'default': False,
            'isRequired': False
        },
        {
            'key': 'dataPointsToAnalyse',
            'title': 'DataPoints To Analyse',
            'description': 'restrict to given datapoints',
            'type': 'array',
            'value': 'Array',
            'hidden' : True,
            'isRequired': False
        },
        {
            'key': 'node',
            'title': 'Node',
            'description': 'An object {attr:val} of attribute values to compare to',
            'type': 'array',
            'value': 'Object',
            'hidden' : True,
            'isRequired': True
        },
        {
            'key': 'headerID',
            'title': 'headerID',
            'description': 'Which is the ID Attribute (defaults to "id")',
            'type': 'text-input',
            'value': 'String',
            'default': "id",
            'isRequired': False
        },
        {
            'key': 'weightByFreq',
            'title': 'Down-weight common feature values',
            'description': 'Down-weight common feature values',
            'type': 'bool',
            'value': 'Bool',
            'default': True,
            'hidden' : True,
            'isRequired': False
        }
    ]

    def __init__(self, name, algoId, taskId):
        super(ComputeNodeSimilarity, self).__init__(name, algoId, taskId)
        self.useCache = True

    def start(self):
        super(ComputeNodeSimilarity, self).start()
        self.setProgress('Algo %s status: %s' % (self.name, self.started), 5)
        if self.network.networkx_graph != None and len(self.network.networkx_graph) == 0:
            self.network.insert_datapoints_as_nodes(self.dataset, self.options.get('dataPointsToAnalyse', None))
            assert len(self.network.networkx_graph) > 0
            print "Analysing %s nodes" % len(self.network.networkx_graph)

#        attrsUsed = [a for a in self.options['node'].iterkeys()]
#        description = "Computing node similarity using the following attributes : " + ",".join(attrsUsed)

        self.result = self.doSimilarityComputation()
        self.stop()
        self.setProgress('Node Comparison', 100)

    def doSimilarityComputation(self):
        simNodes = []
        gotEmpty = False
        rawData = {}
        dataset = self.dataset
        network = self.network
        options = self.options
        self.setProgress("Starting doSimilarityComputation", 10)
        # build a raw data set suitable for processing
        node = options['node']
        if node != None and len(node) > 0:
            params = {};
            params['headerID'] = options['headerID']
            params['qTextHeader'] = None
            params['minAnsweredFrac'] = options['minAnsweredFrac']
            params['weightByFreq'] = options['weightByFreq']
            # turn node data back into node table
            nodeData = []
            headers = []
            if self.responseData == None:
                print("[ComputeNodeSimilarity] Getting network data")
                #attrs = network.generatorInfo['links_FromAttributes']['questions']
                #attrs = network.generatorInfo['compute_node_sim']['attrs']
                attrs = options['attrs']
                aTypes = {attr['Question']: attr['qAnalysisType'] for attr in attrs}
                nodes = dataset.networkx_graph.nodes(data=True)
                selectedNodeIds = self.options.get('dataPointsToAnalyse', None)
                isfilterNodesEnabled = selectedNodeIds is not None and len(selectedNodeIds) > 0
                selNodeIdIdx = {}
                if isfilterNodesEnabled:
                    for dataPointId in selectedNodeIds:
                        selNodeIdIdx[dataPointId] = dataPointId

                headers.append('id')
                attrIdx = {}  # dict of attribute and index
                for attr in aTypes.iterkeys():
                    attrIdx[attr] = len(headers)
                    headers.append(attr)
                for nodeId, nodeAttr in nodes:  # walk through nodes in dataset
                    if isfilterNodesEnabled and selNodeIdIdx.get(nodeId, None) is None:
                        continue
                    rowData = [None] * len(headers)

                    # add node id
                    rowData[0] = nodeId
                    # add attributes
                    for attr, aType in aTypes.iteritems():
                        if attr not in nodeAttr:    # missing attribute value
                            val = float('nan') if (aType == 1 or aType == 8) else None
                        else:
                            val = nodeAttr[attr]
                            # convert number strings to numbers
                            if (aType == 1 or aType == 8):
                                if val == None:
                                    val = float('nan')      # pandas expects empty numbers to be NaN
                                elif not (isinstance(val, int) or isinstance(val, float)):
                                    if val != None and (not isinstance(val, basestring) or len(val) > 0):
                                        try:
                                            val = int(val)
                                        except:
                                            try:
                                                val = float(val)
                                            except:
                                                print('Expected number, got ' + str(val))
                                                val = float('nan')
                                    else:
                                        val = float('nan')      # pandas expects empty numbers to be NaN
                        if type(val) == list:
                            rowData[attrIdx[attr]] = '|'.join(val)
                        else:
                            rowData[attrIdx[attr]] = val
                    nodeData.append(rowData)

            else:
                attrs = self.responseData['attrs']

            # convert node values if needed
            aTypes = {attr['qID']: attr['qAnalysisType'] for attr in attrs}
            aNames = {attr['qID']: attr['Question'] for attr in attrs}
            newNode = {}
            for attr, val in node.iteritems():
                # convert number strings to numbers
                if attr in aTypes:
                    if aTypes[attr] == 1 or aTypes[attr] == 8:
                        if val == None:
                            val = float('nan')      # pandas expects empty numbers to be NaN
                        elif not (isinstance(val, int) or isinstance(val, float)):
                            if not isinstance(val, basestring) or len(val) > 0:
                                try:
                                    val = int(val)
                                except:
                                    try:
                                        val = float(val)
                                    except:
                                        print('Expected number, got ' + str(val))
                                        val = float('nan')
                    elif type(val) == list:
                        val = '|'.join(val)
                    newNode[aNames[attr]] = val

            responses = pd.DataFrame(nodeData, columns=headers)
            if len(nodeData) > 0:   # first time through, test raw data
                isEmpty = {hd: responses[hd].isnull().all() for hd in newNode.keys()}
            else:                   # test cached data
                answers = self.responseData['answers']
                isEmpty = {hd: hd not in answers for hd in newNode.keys()}
            for hd, val in isEmpty.iteritems():
                if val == True:
                    print("Error: attribute has no values: " + hd)
                    gotEmpty = True
            if gotEmpty == False:
                rawData = {'responses': responses,
                       'questions': pd.DataFrame(attrs),
                       'responseData' : self.responseData
                       }
                simNodes = runNodeSimilarity(rawData, newNode, params, datasetId=dataset.id, networkId=network.id)
                print("Done computing similar nodes:")
        return {'node': newNode, 'similarNodes': simNodes}  
