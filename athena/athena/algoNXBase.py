from networkx import nx
from algoBase import AlgorithmBase

"""Base class for algorithms that use networkx"""
class AlgorithmNXBase(AlgorithmBase):
    """do default setup then build networkx graph object"""
    def setup(self, params, dataset):
        super(AlgorithmNXBase, self).setup(params, dataset)
        nw = self.nw = nx.Graph()
        nodes = self.dataset.getNodes()
        links = self.dataset.getEdges()
        for node in nodes:      # go through nodes in dataset
            nodeId = node['id']             # get node id
            nw.add_node(nodeId)             # add node to networkx object            
            nxnode = nw.node[nodeId]        # get newly added networkx node
            nxnode['posX'] = node['posX']   # add attributes to networkx node
            nxnode['posY'] = node['posY']
            nxnode['size'] = node['size']
        for link in links:
            nw.add_edge(link['source'], link['target'])
        print("Built networkx object with %s nodes and %s links", len(nodes), len(links))

    """copy any attributes added to networkx nodes or edges to the dataset and save to db"""
    def _update_dataset(self):
        def getAttrType(val):
            if isinstance(val, int) == True:
                return 'integer'
            elif isinstance(val, float) == True:
                return 'float'
            return 'string'

        def buildididx(attrs):
            # build dict of attribute names and indices
            id_idx = {}
            idx = 0
            for attr in attrs:
                id_idx[attr['id']] = idx
                idx += 1
            return id_idx

        dataset = self.dataset
        nodes = dataset.getNodes()
        links = dataset.getEdges()
        for node in nodes:
            id_idx = buildididx(node['attr'])
            # get node in networkx graph
            nxnode = self.nw.node[node['id']]
            # transfer attribute data from networkx nodes to dataset nodes
            for attr, val in nxnode.iteritems():
                # see if attribute is node position
                if attr == 'posX' or attr == 'posY':
                    node[attr] = float(val)
                else:
                    if dataset.getNodeAttrWithTitle(attr) == None:
                        dataset.addNodeAttr(attr, getAttrType(val))				
                    if attr not in id_idx:	# add new attribute
                        node['attr'].append({'id': attr, 'val': str(val)})
                    else:		# update existing attribute
                        node['attr'][id_idx[attr]]['val'] = str(val)
        for link in links:
            id_idx = buildididx(link['attr'])
            # get link in networkx graph
            nxlink = self.nw.edge[link['source']][link['target']]
            # transfer attribute data from networkx links to dataset links
            for attr, val in nxlink.iteritems():
                # see if attribute is already in dataset and add if its not
                if dataset.getEdgeAttrWithTitle(attr) == None:
                    dataset.addEdgeAttr(attr, getAttrType(val))
                if attr not in id_idx:	# add new attribute
                    link['attr'].append({'id': attr, 'val': str(val)})
                else:		# update existing attribute
                    link['attr'][id_idx[attr]]['val'] = str(val)
        dataset.save()

    """copy networkx node positions to the dataset and save to db"""
    def _update_dataset_positions(self): 
        nodes = self.dataset.getNodes()
        for node in nodes:
            # get node in networkx graph
            nxnode = self.nw.node[node['id']]
            node['posX'] = float(nxnode['posX'])
            node['posY'] = float(nxnode['posY'])
        self.dataset.save()

    """add clustering info to dataset"""
    def addClusterData(self, clusterData):
        dataset = self.dataset



