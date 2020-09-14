import json
from networkx import nx
from algoBase import AlgorithmBase

def getAttrType(val):
    if isinstance(val, int) == True:
        return 'integer'
    elif isinstance(val, float) == True:
        return 'float'
    return 'string'

"""Base class for algorithms that do network generation"""
class AlgorithmNetgenBase(AlgorithmBase):
    def save_network_to_db(self, data):
        # add node attributes to the dataset
        idMap = {}  # map netgen created node id to original id
        nx = self.network.networkx_graph
        network = self.network
        for node in data['nodeData']:  # go through returned node data. False ones are removed later
            idMap[node['id']] = node['__originalId__'] if '__originalId__' in node else node['id']
            nodeData = nx.node.get(idMap[node['id']], None)  # get node data in network
            # make sure the node exists in the network
            if nodeData is None:
                print "ALGO ERROR : NODE NOT FOUND IN NETWORK. REJECTING NODE"
                continue
            nodeData['_remove_node'] = False

            for attrId, val in node.iteritems():
                if attrId != 'id' and attrId != '__originalId__' and attrId != 'dataPointId':
                    if val is not None and val != 'null':
                        # see if attribute is node position
                        if attrId == 'posX' or attrId == 'posY':
                            nodeData[attrId.replace('pos', "Original")] = float(val)
                        elif attrId == 'size':
                            nodeData["OriginalSize"] = float(val)
                        else:
                            # see if attribute is already in dataset and add if its not
                            if network.get_node_attr_with_id(attrId) is None:
                                network.add_node_attr_desc(attrId, getAttrType(val))
                            # add value to node, convert to string if it isn't already
                            if not isinstance(val, basestring):
                                val = json.dumps(val)
                            nodeData[attrId] = val

        # remove nodes which we don't want in the network
        for n in nx.nodes():
            if nx.node[n].get('_remove_node', True):
                print "node id: %s marked for Removal: %s" % (n, nx.node[n])
                nx.remove_node(n)


        # add edge attributes and edges to the dataset
        self.setProgress("Adding " + str(len(data['linkData'])) + " Links", 80)
        for edge in data['linkData']:  # go through returned edge data
            linkData = {}
            # copy attrs
            for attrId, val in edge.iteritems():
                if attrId != 'id1' and attrId != 'id2' and attrId != 'i' and attrId != 'j':
                    if val != None and val != 'null':
                        # see if attribute is already in dataset and add if its not
                        if network.get_link_attr_with_id(attrId) == None:
                            network.add_link_attr_desc(attrId, getAttrType(val))
                        # add value to edge attributes, convert to string if it isn't already
                        if not isinstance(val, basestring):
                            val = json.dumps(val)
                        linkData[attrId] = val
            network.add_link(idMap[edge['id1']], idMap[edge['id2']], attribMap = linkData)

        if 'clusterInfo' in data:
            network.clusterInfo = data['clusterInfo']
        else:
            print("No clusterInfo")