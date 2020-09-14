from ..algoBase import AlgorithmBase
from NetworkAnalysis.ForceDirected.ForceDirected import forceDirectedLayout
from .. import jobTracker

"""run networkx spring layout algorithm"""
class LayoutClustered(AlgorithmBase):

    status = 1
    title = "Cluster"
    description = "Generate position by clustering similar nodes"

    options = [
        {
            'key' : 'clumpiness',
            'title': 'Clumpiness',
            'description': 'From evenly-spaced nodes to tighly clumped clusters',
            'type': 'scale',
            'min': 0,
            'max': 1,
            'multiplier': 1,
            'value': 'Number',
            'default': 0,
            'isRequired': True
        },
        {
            'key' : 'maxSteps',
            'title': 'maxSteps',
            'description': 'Number of steps to run',
            'type': 'scale',
            'min': 100,
            'max': 5000,
            'multiplier': 10,
            'value': 'Number',
            'default': 1000,
            'isRequired': True
        },
        {
            'key': 'byAttribute',
            'title': 'Group by attribute',
            'description': 'Group nodes with the same attribute closer together',
            'type': 'bool',
            'value': 'Bool',
            'default': True,
            'isRequired': True
        },
        {
            'key': 'clustering',
            'title': 'Grouping Attribute',
            'description': 'The attribute to use when grouping nodes (defaults to "Cluster")',
            'type': 'attr-select',
            'value': 'String',
            'default': "Cluster",
            'isRequired': True
        },
        {
            'key' : 'layoutName',
            'title': 'Layout Name',
            'description': 'Name for this layout, defaults to Clustered_1; reusing name overwrites layout',
            'type': 'text-input',
            'value': 'String',
            'default' : 'Clustered_1',
            'isRequired': False
        }
    ]

    def start(self):
        super(LayoutClustered, self).start()
        self.setProgress('Start Layout..', 5)
        byAttribute = self.options['byAttribute']

        nw = self.network.networkx_graph

        if byAttribute:
            clustering = self.options['clustering']
            for dataPointId, attrs in self.dataset.networkx_graph.nodes(data=True):   # go through nodes in dataset
                # extract clustering and add to networkx node
                nodeId = self.network.get_nodeId_for_dataPointId(dataPointId)
                node = nw.node.get(nodeId, None)
                if clustering in attrs and node is not None:
                    node[clustering] = attrs[clustering]
                # clus = attrs[clustering]
                # if len(clus) > 0:
                    # node[clustering] = clus[0]
        else:
            clustering = None

        layoutName = self.options.get('layoutName', 'Clustered_1')
        xattr = layoutName + '_X'
        yattr = layoutName + '_Y'
        if layoutName == 'Original':
            xattr = layoutName + 'X'
            yattr = layoutName + 'Y'

        self.network.create_or_update_node_attr(title = xattr, visible = False)
        self.network.create_or_update_node_attr(title = yattr, visible = False)
        maxSteps = int(self.options.get('maxSteps', 500))
        newpos = forceDirectedLayout(nw, 
                            maxSteps = maxSteps,
                            clumpiness=self.options['clumpiness'],
                            avoidCollisions=True,
                            addToGraph=False,
                            clustering=clustering, algo=self)
        
        for nodeId, pos in newpos.iteritems():
            node = nw.node[nodeId]
            node[xattr] = pos[0]
            node[yattr] = pos[1]

        self.network.save()
        self.setProgress('Clustered Layout Done.', 100)
        self.stop()
