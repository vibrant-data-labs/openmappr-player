# -*- coding: utf-8 -*-

from ..algoBase import AlgorithmBase
import random as r
from random import randint

class RandomLayout(AlgorithmBase):
    """A simple algorithm which randomizes x,y coords for all nodes in the graph"""
    status = 1
    options = []
    title = "Random"
    description = "Generate positons randomly"

    options = [
        {
            'key' : 'layoutName',
            'title': 'Layout Name',
            'description': 'Name for this layout, defaults to Random_1; reusing name overwrites layout',
            'type': 'text-input',
            'value': 'String',
            'default' : 'Random_1',
            'isRequired': False
        }
    ]

    def start(self):
        super(RandomLayout, self).start()
        layoutName = self.options.get('layoutName', 'Cluster_1')
        xAttr = layoutName + '_X'
        yAttr = layoutName + '_Y'
        graph = self.network.networkx_graph
        # Make sure that the attr exists in the Network
        self.network.create_or_update_node_attr(title = xAttr, visible = False)
        self.network.create_or_update_node_attr(title = yAttr, visible = False)
        print('Changing coordinates of %i nodes' % len(graph))
        for n in graph:
            graph.node[n][xAttr] = r.uniform(-100,100)
            graph.node[n][yAttr] = r.uniform(-100,100)
        self.network.save()
        self.stop()
