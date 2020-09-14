import json
import pandas as pd
from ..algoNetgenBase import AlgorithmNetgenBase
from DataToNetwork.BuildResponseNetwork import simMatrixToNetwork
from .. import jobTracker
import ResponseDataCache


"""compute edges based on similarity matrix"""

def getAttrType(val):
    if isinstance(val, int) == True:
        return 'integer'
    elif isinstance(val, float) == True:
        return 'float'
    return 'string'

class EdgesFromAttributes(AlgorithmNetgenBase):
    status = 1
    options = [
        #{
        #    'key': 'headerID',
        #    'title': 'headerID',
        #    'description': 'Which is the ID Attribute (defaults to "id")',
        #    'type': 'text-input',
        #    'value': 'String',
        #    'default': "id",
        #    'isRequired': False
        #},
        {
            'key': 'linksPer',
            'title': 'Links Per Node',
            'description': 'Target links per node',
            'type': 'scale',
            'min': 1,
            'max': 5,
            'multiplier': 1,
            'value': 'Number',
            'default': 3,
            'isRequired': False
        },
        {
            'key': 'keepDisconnected',
            'title': 'Keep disconnected nodes',
            'description': 'Keep disconnected nodes (nodes with no links) in the network',
            'type': 'bool',
            'value': 'Bool',
            'default': False,
            'isRequired': False
        }
    ]

    def start(self):
        super(NetworkFromSimilarityMatrix, self).start()
        self.setProgress('Algo %s status: %s' % (self.name, self.started), 5)

        data = self.buildSimilarityNetwork()
        if data is not None:
            self.save_to_network(data)
            self.network.save()
        self.stop()
        self.setProgress('Network Generation Complete', 100)

    def buildSimilarityNetwork(self):
        rawData = {}
        dataset = self.dataset
        options = self.options
        self.setProgress("Starting buildSimilarityNetwork", 10)
        print(options)
        # build a raw data set suitable for processing
        params = {};
        params['linksPer'] = float(options['linksPer'])
        params['fixedThreshold'] = False
        params['doRound'] = False
        params['keepDisconnected'] = options['keepDisconnected']
        params['doLayout'] = True

        if dataset.simMat != None: 
            # turn node attributes back into list of attr:value dicts
            nodes = dataset.networkx_graph.nodes(data=True)
            selectedNodeIds = self.options.get('dataPointsToAnalyse', None)
            isfilterNodesEnabled = selectedNodeIds is not None and len(selectedNodeIds) > 0
            selNodeIdIdx = {}
            if isfilterNodesEnabled:
                for dataPointId in selectedNodeIds:
                    selNodeIdIdx[dataPointId] = dataPointId

            nodeAttrs = dataset.attrDescriptors
            nodeData = []
            headers = []
            headers.append('id')
            attrIdx = {}  # dict of attribute and index
            for attr in nodeAttrs:
                idStr = attr.id
                attrIdx[idStr] = len(headers)
                headers.append(idStr)
            for nodeId, nodeAttr in nodes:  # walk through nodes in dataset
                if isfilterNodesEnabled and selNodeIdIdx.get(nodeId, None) is None:
                    continue
                
                rowData = [None] * len(headers)
                # add node id
                rowData[0] = nodeId
                # add attributes
                for idStr, val in nodeAttr.iteritems():
                    if idStr not in attrIdx:  # TODO add missing node attributes
                        print "attr Id : %s is not in attrIdx %s for nodeId: %s" % (idStr, attrIdx, nodeId)
                        raise Exception("Should never happen")
                    # convert number strings to numbers
                    if idStr in qTypes and (qTypes[idStr] == 1 or qTypes[idStr] == 8):
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
                        rowData[attrIdx[idStr]] = '|'.join(val)
                    else:
                        rowData[attrIdx[idStr]] = val
                nodeData.append(rowData)

            # run the anaysis - threshold similarity and compute network properties and layout
            return simMatrixToNetwork(dataset.simMat, nodeData, nodeAttrs=self.getNodeAttrInfo(), algo=self)

    def save_to_network(self, data):
        self.setProgress("Saving Network..", 70)
        self.save_network_to_db(data)
