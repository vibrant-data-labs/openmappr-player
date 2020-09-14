from ..algoBase import AlgorithmBase

class CoordinateExchanger(AlgorithmBase):
	"""A simple algorithm which changes x,y coords for all nodes in the graph"""
	# def setup(self, options, dataset):
	# 	super(CoordinateExchanger, self).setup(options, dataset)

	status = 0
	
	def start(self):
		super(CoordinateExchanger, self).start()
		network = self.network
		options = self.options

		if len(network.networkx_graph) == 0:
			# a new or empty graph given, so build nodes
			for datapoint in self.dataset.networkx_graph.nodes():
				self.network.add_node(datapoint)

		graph = network.networkx_graph

		## Create a new attribute on each node which interchanges the x,y coords
		print('Changing coordinates of %i nodes' % len(graph))
		for n in graph:
			temp = graph.node[n]['OriginalX']
			graph.node[n]['OriginalX'] = graph.node[n]['OriginalY']
			graph.node[n]['OriginalY'] = temp
		
		network.save()
		self.stop()
