from ..algoBase import AlgorithmBase
from NetworkAnalysis.ComputeProperties import computeNetworkProperties

"""compute network attributes and add in newly computed attributes
   if params are passed, they specify a subset of properties to compute,
   if no params are passed, all properties are computed"""
class DecorateNetwork(AlgorithmBase):

    status = 1

    def start(self):
        super(DecorateNetwork, self).start()
        network = self.network
        if len(network.networkx_graph) == 0:
            # a new or empty graph given, so build nodes
            self.network.insert_datapoints_as_nodes(self.dataset)
        self.options = self.options if self.options is not None else {}
        self.options["mergeDuplicates"] = False
        self.options["clusterLevel"] = 0
        self.options['nodeAttrs'] = self.getNodeAttrInfo()
        clusterInfo = computeNetworkProperties(network.networkx_graph, self, ctrlparams = self.options)
        if len(clusterInfo) > 0:
            network.clusterInfo = clusterInfo
            #print(network.clusterInfo)
        network.bake()
        network.save()
        self.stop()
