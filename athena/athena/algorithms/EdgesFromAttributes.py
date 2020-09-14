import pandas as pd
from ..algoNetgenBase import AlgorithmNetgenBase
from DataToNetwork.BuildResponseNetwork import runResponseAnalysis
from .. import jobTracker
import ResponseDataCache


"""compute edges based on attribute similarities"""

class EdgesFromAttributes(AlgorithmNetgenBase):
    status = 1
    options = [
        {
            'key': 'analyseCurrentNetwork',
            'title': 'Analyse nodes in current network',
            'description': 'If true, analyse nodes in current network, otherwise analyse the full data set',
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
            'key': 'questions',
            'title': 'Attributes',
            'description': 'Which attributes to use for generating links',
            'type': 'attr-select-mult',
            'value': 'Array',
            'isRequired': True
        },
        #{
        #    'key': 'aggregation',
        #    'title': 'Cluster Aggregation',
        #    'description': 'Which clusterings to compute aggregate properties over',
        #    'type': 'text-input',
        #    'value': 'Array',
        #    'default': '',
        #    'isRequired': False
        #},
        #{
        #    'key': 'headerID',
        #    'title': 'headerID',
        #    'description': 'Which is the ID Attribute (defaults to "id")',
        #    'type': 'text-input',
        #    'value': 'String',
        #    'default': "id",
        #    'isRequired': False
        #},  # {  #	'key' : 'qTextHeader',  #	'title': 'Short text header',
        #	'description': 'Which attribute in attributes sheet contains the attribute short descriptive text',
        #	'type': 'text-input',  #	'value': 'String',  #	'isRequired': False  #},
        {
            'key': 'weightByFreq',
            'title': 'Down-weight common feature values',
            'description': 'Down-weight common feature values',
            'type': 'bool',
            'value': 'Bool',
            'default': False,
            'isRequired': False
        },
        {
            'key': 'linksPer',
            'title': 'Links Per Node',
            'description': 'Target links per node',
            'type': 'scale',
            'min': 1,
            'max': 6,
            'multiplier': 1,
            'value': 'Number',
            'default': 3,
            'isRequired': False
        },
        {
            'key': 'clusterLevel',
            'title': 'Clustering Level',
            'description': 'Choose coarse to fine grained clustering',
            'type': 'select',
            'values': ['Coarse', 'Medium', 'Fine'],
            'default': 'Coarse',
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
        },
        {
            'key': 'minAnsweredFrac',
            'title': 'Minimum attribute fraction',
            'description': 'Exclude the node if less than this fraction of attributes are blank',
            'type': 'scale',
            'min': 0,
            'max': 1,
            'multiplier': 1,
            'value': 'Number',
            'default': 0.5,
            'isRequired': False
        },
#        {
#            'key': 'fixedThreshold',
#            'title': 'Use fixed threshold',
#            'description': 'If false, use an adaptive similarity threshold based on minimum max similarity',
#            'type': 'bool',
#            'value': 'Bool',
#            'default': False,
#            'isRequired': False
#        },
#        {
#            'key': 'doRound',
#            'title': 'Round numeric attributes',
#            'description': 'Round all numeric attributes to nearest integer, even if they are float type',
#            'type': 'bool',
#            'value': 'Bool',
#            'default': False,
#            'isRequired': False
#        },
        {
            'key': 'mergeClusters',
            'title': 'Merge duplicate clusters',
            'description': 'Merge clusters defined by similar attribute values',
            'type': 'bool',
            'value': 'Bool',
            'default': False,
            'isRequired': False
        },
        {
            'key': 'keepQuestions',
            'title': 'Keep raw data attributes',
            'description': 'When more than 10 attributes, keep attributes used to generate links as attributes in the final data set',
            'type': 'bool',
            'value': 'Bool',
            'default': True,
            'isRequired': False
        }

    ]

    def start(self):
        super(EdgesFromAttributes, self).start()
        self.setProgress('Algo %s status: %s' % (self.name, self.started), 5)
        if len(self.network.networkx_graph) == 0:
            self.network.insert_datapoints_as_nodes(self.dataset, self.options.get('dataPointsToAnalyse', None))
            assert len(self.network.networkx_graph) > 0
            print "Analysing %s nodes" % len(self.network.networkx_graph)

        attrsUsed = [question['Question'] for question in self.options['questions']]
        self.network.description = "This network was generated using the following attributes : " + ",".join(attrsUsed)

        data = self.buildEntityNetwork()
        if data is not None:
            self.save_to_network(data)
            self.network.save()
        self.stop()
        self.setProgress('Network Generation Complete', 100)

    def buildEntityNetwork(self):
        qID = "qID"
        rawData = {}
        dataset = self.dataset
        options = self.options
        self.setProgress("Starting buildEntityNetwork", 10)
        print('----------Options-----------')
        print(options)
        print('----------------------------')
        # build a raw data set suitable for processing
        questions = options['questions']
        if len(questions) > 0:
#            aggregation = options['aggregation']

            params = {};
            params['headerID'] = 'id'
            params['qTextHeader'] = options['qTextHeader'] if ('qTextHeader' in options) else None
            params['minAnsweredFrac'] = options['minAnsweredFrac']
            params['linksPer'] = float(options['linksPer'])
            #params['fixedThreshold'] = options['fixedThreshold']
            #params['doRound'] = options['doRound']
            params['fixedThreshold'] = False
            params['doRound'] = False
            params['keepQuestions'] = True if len(questions) < 10 else options['keepQuestions']
            params['weightByFreq'] = options['weightByFreq']
            params['keepDisconnected'] = options['keepDisconnected']
            params['doLayout'] = True
            params['mergeClusters'] = options.get('mergeClusters', False)
            clusLev = options.get('clusterLevel', 'Coarse')
            if clusLev == 'Fine':
                params['clusterLevel'] = 2
            elif clusLev == 'Medium':
                params['clusterLevel'] = 1
            else:
                params['clusterLevel'] = 0

            # turn linking attributes (questions) back into table+headers for pandas
            questionData = []
            qTypes = {}     # dict of attr name and analysis type
            qHeaders = []
            qIdx = {}  # dict of attr metadata and column index
            for linkingAttr in questions:  # walk through question
                # add qID if it's missing
                if qID not in linkingAttr:
                    linkingAttr[qID] = len(questionData)
                rowData = [None] * len(qHeaders)
                # add attribute metadata
                for attr, val in linkingAttr.iteritems():
                    if attr not in qIdx:
                        qIdx[attr] = len(qHeaders)
                        qHeaders.append(attr)
                        rowData.append(None)
                    rowData[qIdx[attr]] = val
                qTypes[linkingAttr['Question']] = linkingAttr['qAnalysisType']
                questionData.append(rowData)
            # print('EdgesFromAttributes questionData', questionData)
            # turn node data back into node table
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
                # nodeIdx[nodeId] = nodeAttr
                # add attributes
                for idStr, val in nodeAttr.iteritems():
                    if idStr not in attrIdx:  # TODO add missing node attributes
                        print "attr Id : %s is not in attrIdx %s for nodeId: %s" % (idStr, attrIdx, nodeId)
                        raise Exception("Should never happen: attr Id : {} is not in attrIdx {} for nodeId: {}".format(idStr, attrIdx, nodeId))
                        # attrIdx[idStr] = len(headers)
                        # headers.append(idStr)
                        # rowData.append(None)
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
                    #if type(val) == list:
                    #    rowData[attrIdx[idStr]] = '|'.join(val)
                    #else:
                    rowData[attrIdx[idStr]] = val
                nodeData.append(rowData)

            #attrTypesMap = {
            #    'string': 'string',
            #    'liststring': 'tag',
            #    'boolean': 'string',
            #    'integer': 'number',
            #    'float': 'number',
            #}
            #nodeAttrInfo = {desc.title : attrTypesMap[desc.attrType]
            #                for desc in dataset.attrDescriptors if desc.attrType in attrTypesMap}
            nodeAttrInfo = self.getNodeAttrInfo()
            rawData = {'responses': pd.DataFrame(nodeData, columns=headers),
                       'questions': pd.DataFrame(questionData, columns=qHeaders),
                       'nodeAttrs': nodeAttrInfo,
#                       'aggregation': aggregation
                       }
            # run the entity (responses) analysis - compute attribute similarity between entities and threshold
            return runResponseAnalysis(rawData, params, algo=self)

    def save_to_network(self, data):
        self.setProgress("Saving Network..", 82)
        self.save_network_to_db(data)
        ResponseDataCache.removeCachedResponseData(self.dataset.id, self.network.id)
