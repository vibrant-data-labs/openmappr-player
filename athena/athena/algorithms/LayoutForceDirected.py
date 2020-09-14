from ..algoBase import AlgorithmBase
from NetworkAnalysis.ForceDirected.ForceDirected import forceDirectedLayout

"""run networkx spring layout algorithm"""
class LayoutForceDirected(AlgorithmBase):

    status = 1
    title = "Force Directed"
    description = "Generate postions using forceDirectedLayout"
    options = [
        {
            'key' : 'clumpiness',
            'title': 'Clumpiness',
            'description': 'From circular layout to tighly clumped clusters',
            'type': 'scale',
            'min': 0,
            'max': 1,
            'multiplier': 1,
            'value': 'Number',
            'default': 0.5,
            'isRequired': True
        },
        {
            'key': 'avoidCollisions',
            'title': 'Reduce overlapping nodes',
            'description': 'Reduce overlapping nodes',
            'type': 'bool',
            'value': 'Bool',
            'default': True,
            'isRequired': False
        },
        {
            'key' : 'xAttr',
            'title': 'Attribute',
            'description': 'Which attrib for position X, defaults to FD_1_X',
            'type': 'text-input',
            'value': 'String',
            'default' : 'FD_1_X',
            'isRequired': False
        },
        {
            'key' : 'yAttr',
            'title': 'Attribute',
            'description': 'Which attrib for position Y, defaults to FD_1_Y',
            'type': 'text-input',
            'value': 'String',
            'default' : 'FD_1_Y',
            'isRequired': False
        }
    ]   

    def start(self):
        super(LayoutForceDirected, self).start()
        nw = self.network.networkx_graph

        xattr = self.options.get('xAttr', 'FD_1_X')
        yattr = self.options.get('yAttr', 'FD_1_Y')
        self.network.create_or_update_node_attr(title = xattr, visible = False)
        self.network.create_or_update_node_attr(title = yattr, visible = False)

        newpos = forceDirectedLayout(nw, 
                maxSteps = 500, 
                clumpiness=self.options['clumpiness'], 
                avoidCollisions=self.options['avoidCollisions'], 
                addToGraph=False)

        for nodeId, pos in newpos.iteritems():
            node = nw.node[nodeId]
            node[xattr] = pos[0]
            node[yattr] = pos[1]

            node.pop("posX", None)
            node.pop("posY", None)
            node.pop("size", None)

        self.network.save()
        self.stop()
