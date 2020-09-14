## A bunch for helper for working with mongo Data

from bson.objectid import ObjectId

class MapprData():
    def __init__(self, dataSet, dataId, mongoDb, isDataChunked = True):
        self.rawData = dataSet['data']
        self._dataset = dataSet
        self.dataId = str(dataId)
        self.isDataChunked = isDataChunked
        self.mongoDb = mongoDb
        print('Got datasetId %s' % dataId)

    def save(self):
        if self.isDataChunked == True:
            self._dataset['data'] = self.rawData
            self.mongoDb.fs.delete(ObjectId(self.dataId))
            dataFile = self.mongoDb.save_gridfs(self._dataset, ObjectId(self.dataId))
            self.dataId = str(dataFile)
            print('Updated datsetId %s' % self.dataId)
        else:  
            self._dataset.save()

    def getDataByAttr(self, attr):
        return self.rawData[attr]
    
    def getNodes(self):
        return self.rawData['nodes']

    def getNodeWithId(self, nodeId):
        return next(node for node in self.getNodes() if node.id == nodeId)

    def addNode(self, nodeId=None, label="node", size = 10, posX = 0, posY = 0, 
        col = {"r": 100, "g" : 100, "b" : 100 }, attribMap = {}):
        node = {}
        node.id = nodeId if nodeId != None else str(len(self.rawData['nodes']))
        node['label'] = label
        node['size'] = size
        node['posX'] = posX
        node['posY'] = posY
        node['col'] = col
        node['layerId'] = 0
        node['visible'] = True
        node['attr'] = []
        for (key, value) in attribMap:
            temp = getNodeAttrsWithId(key) # test whether node exists
            node['attr'].append({"id": key, "val" : value})
        
        self.getNodes().append(node)
        return node

    def getNodeAttrs(self):
        return self.rawData['nodeAttrs']

    def getNodeAttrWithId(self, attrId):
         return next((nodeAttr for nodeAttr in self.getNodeAttrs() if nodeAttr['id'] == attrId), None)

    def getNodeAttrWithTitle(self, title):
         return next((nodeAttr for nodeAttr in self.getNodeAttrs() if nodeAttr['title'] == title), None)

    def addNodeAttr(self, title, attrType, generatorType="athena", generatorOptions=None, visible = True):
        attr = {
            "id" : title if title != None else str(len(self.getNodeAttrs())),
            "title": title,
            "generatorType" : generatorType,
            "generatorOptions" : generatorOptions,
            "visible" : visible
        }
        if attrType != None:
            attr["attrType"] = attrType
        self.getNodeAttrs().append(attr)
        return attr

    def addNodeAttrObj(self, attr):
        self.getNodeAttrs().append(attr)
        return attr

    def getEdges(self):
        return self.rawData['edges']

    def clearEdges(self):
        self.rawData['edges'] = []

    def getEdgeWithId(self, edgeId):
        return next(edge for edge in self.rawData['edges'] if edge.id == edgeId)

    def addEdge(self, sourceId, targetId, edgeId=None, label="edge",
        col = {"r": 100, "g" : 100, "b" : 100 }, attribMap = {}):
        edge = {}
        edge['id'] = edgeId if edgeId != None else str(len(self.rawData['edges']))
        edge['source'] = sourceId
        edge['target'] = targetId
        edge['label'] = label
        edge['col'] = col
        edge['attr'] = []

        for (key, value) in attribMap:
            temp = getEdgeAttrsWithId(key) # test whether node exists
            edge['attr'].append({"id": key, "val" : value})
        
        self.getEdges().append(edge)
        return edge

    def getEdgeAttrs(self):
        return self.rawData["edgeAttrs"]

    def getEdgeAttrWithId(self, attrId):
         return next((edgeAttr for edgeAttr in self.getEdgeAttrs() if edgeAttr["id"] == attrId), None)

    def getEdgeAttrWithTitle(self, title):
         return next((edgeAttr for edgeAttr in self.getEdgeAttrs() if edgeAttr["title"] == title), None)

    def addEdgeAttr(self, title, attrType, generatorType="athena", generatorOptions=None, visible = True):
        attr = {
            "id" : title if title != None else str(len(self.getEdgeAttrs())),
            "title": title,
            "generatorType" : generatorType,
            "generatorOptions" : generatorOptions,
            "visible" : visible
        }
        if attrType != None:
            attr["attrType"] = attrType
        self.getEdgeAttrs().append(attr)
        return attr

    def addEdgeAttrObj(self, attr):
        self.getEdgeAttrs().append(attr)
        return attr

    def getClusterings(self):
        if "clusterings" not in self.rawData:
            self.rawData["clusterings"] = []
        return self.rawData["clusterings"]

    def getClustering(self, clName):
        clusterings = self.getClusterings()
        cl = None
        for cl in clusterings:   # add empty clustering if its not there
            if cl['name'] == clName:
                break
            else:
                cl = None
        if cl == None:
            cl = {'name': clName, 'clusters': []}
            clusterings.append(cl)
        return cl


###
## Node utils
##
def get_node_attrib_by_id(node, attribId):
    for attr in node['attr']:
        if attr.id == attribId:
            return attr.val

    raise AttributeNotFoundError(attribId)


class AttributeNotFoundError(Exception):
    """Exception raised for errors when accessing invalid attribute value.
    Attributes:
        attribId -- the attribute Id 
    """

    def __init__(self, attribId):
        self.attribId = attribId
        self.msg = "attribute with Id: %s, not found. Try creating it" % attribId
