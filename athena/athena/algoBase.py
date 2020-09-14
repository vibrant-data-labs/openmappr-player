import mongoman
import entities
import jobTracker
from algorithms import ResponseDataCache
from pprint import pprint

class EmptyNetwork(object):
    def __init__(self, id):
        self.id = id
        self.networkx_graph = None
    def getId(self): return self.id

class EmptyDataset(object):
    def __init__(self, id):
        self.id = id
        self.networkx_graph = None
    def getId(self): return self.id

class AlgorithmBase(object):
    """The basic blueprint of algorithm. An algorithm container allows for start, stop and fetch progress for an algorithm.
    Every algorithm needs to implement this container as well.
    """
    """The options required by the algorithm. It is a list of options. Each option object is of dict containing:
    name : String   name of option
    isRequired: <boolean> Whether the option is essential to the algorithm
    valType: <Int / Float / String> The type of option"""
    options = []

    """ The development status of the algorithm. Values and Scoping is: DEV (0) > BETA (1) > PROD (5)
    """
    status = 0

    title = ""

    description = "An algo in Athena"

    def __init__(self, name, algoId, reporter):
        self.name = name
        self.algoId = algoId
        self.reporter = reporter
        self.started = False
        self.useCache = False
        self.options = None
        self.dataset = None
        self.network = None
        self.responseData = None

    # load from mongo or cache
    #
    def loadData(self, datasetId, networkId, newNetworkName, options):
        print('[algoBase.loadData] trying to fetch dataset for Id: %s' % datasetId)
        responseData = ResponseDataCache.getCachedResponseData(datasetId, networkId) if self.useCache else None
        if responseData == None:
            dsjson = mongoman.get_dataset_json(datasetId)
            dataset = entities.create_dataset_from_json(dsjson)
            print("Loaded dataset")
            if networkId != None:
                print("trying to fetch network for Id: %s" % networkId)
                nwjson = mongoman.get_network_json(networkId)
                network = entities.create_network_from_json(nwjson)
            else:
                network = entities.create_network_new(dataset, newNetworkName)
            network.set_generatorInfo_from_options(self.name, options)
        else:
            network = EmptyNetwork(networkId)
            dataset = EmptyDataset(datasetId)
        print("Loaded data, running algorithm")
        return (dataset, network, responseData)

    def setup(self, datasetId, networkId, newNetworkName, options):
        """Algorithm Initialization, including validation, goes here"""
        self.result = None
        data = self.loadData(datasetId, networkId, newNetworkName, options)
        print('Algo %s setup with options: %s' % (self.name , options))
        self.options = options
        self.dataset = data[0]
        self.network = data[1]
        self.responseData = data[2]

    def start(self):
        """Actual code for algo execution"""
        print('Algo %s started with options: %s' % (self.name , self.options))
        self.started = True

    def stop(self):
        """Signals the algorithm to stop execution. helpful for long running algos."""
        print('Algo %s has stopped' % self.name)
        self.started = False

    def progress(self):
        print('Algo %s status: %s' % (self.name, self.started))
        return self.started

    def setProgress(self, msg, percentCompletion=0):
        self.reporter.send_update(msg, percentCompletion)
        print(msg)

    def getNodeAttrInfo(self):
        attrTypesMap = {
            'string': 'string',
            'liststring': 'tag',
            'boolean': 'string',
            'integer': 'number',
            'float': 'number',
        } 
        # print("[algoBase.getNodeAttrInfo]")
        # for ad in self.dataset.attrDescriptors:
        #     print(ad.to_dict())
        return {desc.title : attrTypesMap[desc.attrType]
                        for desc in self.dataset.attrDescriptors if desc.attrType in attrTypesMap}        
