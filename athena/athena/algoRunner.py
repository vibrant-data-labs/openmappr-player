import traceback

from algoBase import AlgorithmBase
from algorithms.CoordinateExchanger import CoordinateExchanger
from algorithms.DecorateNetwork import DecorateNetwork
#from algorithms.LayoutForceDirected import LayoutForceDirected
from algorithms.EdgesFromAttributes import EdgesFromAttributes
# from algorithms.SimilarityLinker import SimilarityLinker
from algorithms.RandomLayout import RandomLayout
from algorithms.LayoutClustered import LayoutClustered
from algorithms.ComputeNodeSimilarity import ComputeNodeSimilarity


# List of all algorithms available to athena with their constructors
registeredAlgos = {
    'hello_world': AlgorithmBase,
    'reverse_coords': CoordinateExchanger,
    'network_properties': DecorateNetwork,
#    'layout_ForceDirected': LayoutForceDirected,
    'links_FromAttributes': EdgesFromAttributes,
    # 'similarity_linker': SimilarityLinker,
#    'layout_random': RandomLayout,
    'layout_clustered': LayoutClustered,
    'compute_node_sim': ComputeNodeSimilarity    
}

class AlgoRunner():
    """Manages all the algorithms running on athena. Provides facilities to start, stop and see their status"""
    def __init__(self):
        print('AlgoRunner started')
        self.algoMap = {}
        self.algos = registeredAlgos
        self.nextId = 0

    def algoList(self):
        algoOptions = {}
        for name in self.algos.keys():
            algo_title = self.algos[name].title
            if len(algo_title) == 0:
                algo_title = name
                self.algos[name].title = name

            algoOptions[name] = {
                'name' : name,
                'title' : algo_title,
                'description' : self.algos[name].description,
                'options': self.algos[name].options,
                'status' : self.algos[name].status
            }
        # print('Returning the list of algos %s' % algoOptions)
        return algoOptions

    def create_algo(self, name, datasetId, networkId, newNetworkName, options, reporter):
        print("Building algo: %s with options: %s" %(name, options))
        if name in self.algos:
            algo = self.algos[name](name, self.nextId, reporter)
            self.nextId += 1

            self.algoMap[algo.algoId] = algo
            reporter.set_algo(algo)

            algo.setup(datasetId, networkId, newNetworkName, options)

            reporter.send_start()
            return algo
        else:
            return None


    def algoRun(self, algo):
        print 'run request: algo: %s ' % algo.algoId
        try:
            # pr = cProfile.Profile()
            # pr.enable()
            algo.start()
            # pr.disable()
            # pr.dump_stats("profile_stats.prof")
            # pr.print_stats()

            del self.algoMap[algo.algoId]
        
        except StandardError, e:
            # new event finished
            # algo.reporter.send_error(traceback.format_exc())
            traceback.print_exc()
            raise e

        return True


    def algoStop(self, algoId):
        if algoId in self.algoMap:
            self.algoMap[algoId].stop()
            return {'result': 'Algo with Id %s has been stopped.' % algoId}
        else:
            return {
                'result': 'Algo with Id %s is not running.' % algoId,
                'error': 400
            }

    def algoStatus(self, algoId):
        if algoId in self.algoMap:
            return {'result': self.algoMap[algoId].progress()}
        else:
            return {
                'result': 'Algo with Id %s is not running.' % algoId,
                'error': 400
            }