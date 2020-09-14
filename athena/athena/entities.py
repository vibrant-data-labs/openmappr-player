##
# Mappr Entities declated here
##
import json
from bson.objectid import ObjectId
from networkx import nx
import datetime
from random import randint

import mongoman

## Render types map
# Note:-
#   1) Change on client(AttrInfoService.js) and server(datasys/datasys_model.js) as well on updation
#   2) Each attr type gets first render type as default
##
renderTypesMap = {
'string': ['categorylist' ,'categorybar', 'text', 'textlist', 'piechart', 'barchart', 'media', 'link', 'date', 'date-time', 'time', 'email', 'lat,lng', 'longtext'],
'json': ['medialist'],
'twitter': ['twitterfeed'],
'instagram': ['instagramfeed'],
'liststring': ['tag-cloud', 'tags'],
'boolean': ['categorybar', 'piechart', 'histogram'],
'color': ['categorybar', 'piechart', 'histogram'],
'integer': ['histogram', 'densitybar'],
'float': ['histogram', 'densitybar'],
'year': ['histogram', 'densitybar'],
'picture': ['default'],
'profile': ['default'],
'audio_stream': ['default'],
'video_stream': ['default'],
'video': ['default'],
'html': ['default'],
'url': ['default'],
'timestamp' : ['histogram', 'default'],
'media_link' : ['default']
}


class Dataset(object):
    def __init__(self, id, projectId, name, networkx_graph, attrDescriptors, sourceInfo, datapointsFile, createdAt, modifiedAt):
        self.id = id
        self.projectId = projectId
        self.name = name
        self.networkx_graph = networkx_graph
        self.attrDescriptors = attrDescriptors
        self.sourceInfo = sourceInfo
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.datapointsFile = datapointsFile

    def __str__(self):
        return "Dataset(" + str({
                "id" : self.id,
                "name" : self.name,
                "networkx_graph" : self.networkx_graph,
                "attrDescriptors" : self.attrDescriptors,
                "sourceInfo" : self.sourceInfo,
                "datapointsFile" : self.datapointsFile,
                "createdAt" : self.createdAt,
                "modifiedAt" : self.modifiedAt
            }) + ")"
    def to_dict(self):
        datapoints = [datapoint_to_dict(k,v) for k,v in self.networkx_graph.nodes(data=True)]
        return {
            "id" : self.id,
            "name" : self.name,
            "datapoints" : datapoints,
            "attrDescriptors" : self.attrDescriptors,
            "datapointsFile" : self.datapointsFile,
            "sourceInfo" : self.sourceInfo,
            "createdAt" : self.createdAt,
            "modifiedAt" : self.modifiedAt
        }

    def getId(self): return self.id

class Network(object):
    def __init__(self, id, datasetId, projectId, name, description, networkx_graph, nodeAttrDescriptors, linkAttrDescriptors,
                    clusterInfo, networkInfo, generatorInfo, nodesFile, linksFile, createdAt, modifiedAt):
        self.id = id
        self.datasetId = datasetId
        self.projectId = projectId
        self.name = name
        self.description = description
        self.networkx_graph = networkx_graph
        self.nodeAttrDescriptors = nodeAttrDescriptors
        self.linkAttrDescriptors = linkAttrDescriptors
        self.clusterInfo = clusterInfo
        self.networkInfo = networkInfo
        self.generatorInfo = generatorInfo
        self.nodesFile = nodesFile
        self.linksFile = linksFile
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.genName = False # set to True to generate network name on creation / saving

        # Indices to speed up some ops
        self.dataPointId_to_nodeIdMap = {}
        self.nodeAttrDesc_IdIdx = {}
        self.nodeAttrDesc_Title_to_IdMap = {}

        self.linkAttrDesc_IdIdx = {}
        self.linkAttrDesc_Title_to_IdMap = {}

        for nodeId,attrs in self.networkx_graph.nodes(data=True):
            self.dataPointId_to_nodeIdMap[attrs['dataPointId']] = nodeId

        for attr in self.nodeAttrDescriptors:
            self.nodeAttrDesc_IdIdx[attr.id] = attr
            self.nodeAttrDesc_Title_to_IdMap[attr.title] = attr.id

        for attr in self.linkAttrDescriptors:
            self.linkAttrDesc_IdIdx[attr.id] = attr
            self.linkAttrDesc_Title_to_IdMap[attr.title] = attr.id

    def __str__(self):
        return "Network(" + str({
                "id" : self.id,
                "datasetId" : self.datasetId,
                "projectId" : self.projectId,
                "name" : self.name,
                "description" : self.description,
                "networkx_graph" : self.networkx_graph,
                "nodeAttrDescriptors" : self.nodeAttrDescriptors,
                "linkAttrDescriptors" : self.linkAttrDescriptors,
                "clusterInfo" : self.clusterInfo,
                "networkInfo" : self.networkInfo,
                "generatorInfo" : self.generatorInfo,
                "nodesFile" : self.nodesFile,
                "linksFile" : self.linksFile,
                "createdAt" : self.createdAt,
                "modifiedAt" : self.modifiedAt
            }) + ")"

    def getId(self): return self.id

    def get_nodeId_for_dataPointId(self, dataPointId):
        return self.dataPointId_to_nodeIdMap.get(dataPointId, None)

    def getNodeAttrWithId(self, attrId):
         return self.nodeAttrDesc_IdIdx.get(attrId, None)

    def add_node(self, dataPointId, nodeId=None, label="node", size = 10, posX = 0, posY = 0,
                    col = {"r": 100, "g" : 100, "b" : 100 }, attribMap = {}):

        nodeId = nodeId if nodeId != None else dataPointId
        attribMap['dataPointId'] = dataPointId
        attribMap['OriginalLabel'] = label
        attribMap['OriginalSize'] = size
        attribMap['OriginalX'] = posX
        attribMap['OriginalY'] = posY
        attribMap['OriginalColor'] = "rgb(" + str(col["r"]) + "," + str(col["g"]) + "," + str(col["b"]) + ")"

        self.networkx_graph.add_node(nodeId, **attribMap)
        self.dataPointId_to_nodeIdMap[dataPointId] = nodeId
        return self.networkx_graph.node[nodeId]

    def add_link(self, source, target, linkId=None, label="edge", size = 10, isDirectional = True,
                    col = {"r": 100, "g" : 100, "b" : 100 }, attribMap = {}):

        linkId = linkId if linkId is not None else str(source) + ":" + str(target) + str(randint(0,100))

        attribMap['id'] = linkId
        attribMap['isDirectional'] = isDirectional
        attribMap['OriginalLabel'] = label
        attribMap['OriginalSize'] = size
        attribMap['OriginalColor'] = "rgb(" + str(col["r"]) + "," + str(col["g"]) + "," + str(col["b"]) + ")"

        self.networkx_graph.add_edge(source, target, **attribMap)
        return self.networkx_graph.edge[source][target]

    ##
    # Attribute functions
    ##
    def add_node_attr_desc(self, title, attrType="string", generatorType="athena", generatorOptions=None, metadata=None, visible = True):
        attr = {
            "id" : title if title != None else str(len(self.nodeAttrDescriptors)),
            "title": title,
            "attrType" : attrType if attrType is not None else "string",
            "generatorType" : generatorType if generatorType is not None else "athena",
            "generatorOptions" : generatorOptions,
            "metadata" : metadata,
            "visible" : visible,
            "isStarred" : False
        }
        obj = AttrDescriptor(**attr)
        self.nodeAttrDescriptors.append(obj)
        # update indices
        self.nodeAttrDesc_IdIdx[obj.id] = obj
        self.nodeAttrDesc_Title_to_IdMap[obj.title] = obj.id
        return obj

    def add_link_attr_desc(self, title, attrType="string", generatorType="athena", generatorOptions=None, metadata=None, visible = True):
        attr = {
            "id" : title if title != None else str(len(self.linkAttrDescriptors)),
            "title": title,
            "attrType" : attrType,
            "generatorType" : generatorType,
            "generatorOptions" : generatorOptions,
            "metadata" : metadata,
            "visible" : visible,
            "isStarred" : False
        }
        obj = AttrDescriptor(**attr)
        self.linkAttrDescriptors.append(obj)
        self.linkAttrDesc_IdIdx[obj.id] = obj
        self.linkAttrDesc_Title_to_IdMap[obj.title] = obj.id
        return obj

    def get_node_attr_with_id(self, attrId):
        return self.nodeAttrDesc_IdIdx.get(attrId, None)
        # return next((nodeAttr for nodeAttr in self.nodeAttrDescriptors if nodeAttr.id == attrId), None)
    def get_link_attr_with_id(self, attrId):
        return self.linkAttrDesc_IdIdx.get(attrId, None)
        # return next((linkAttr for linkAttr in self.linkAttrDescriptors if linkAttr.id == attrId), None)

    def get_node_attr_by_title(self, title):
        attrId = self.nodeAttrDesc_Title_to_IdMap.get(title, None)
        if attrId is not None:
            return self.nodeAttrDesc_IdIdx.get(attrId, None)
        else:
            return None

    def get_link_attr_by_title(self, title):
        attrId = self.linkAttrDesc_Title_to_IdMap.get(title, None)
        if attrId is not None:
            return self.linkAttrDesc_IdIdx.get(attrId, None)
        else:
            return None

    def create_or_update_node_attr(self, title=None, attrType=None, generatorType=None, generatorOptions=None,  metadata=None, visible=None):
        attr = self.get_node_attr_by_title(title)
        if attr != None:
            attr.title = title if title is not None else attr.title
            attr.attrType = attrType if attrType is not None else attr.attrType
            attr.generatorType = generatorType if generatorType is not None else attr.generatorType
            attr.generatorOptions = generatorOptions if generatorOptions is not None else attr.generatorOptions
            attr.metadata = metadata if metadata is not None else attr.metadata
            attr.visible = visible if visible is not None else attr.visible
        else:
            attr = self.add_node_attr_desc(title, attrType, generatorType, generatorOptions, metadata, visible)

        return attr

    def create_or_update_link_attr(self, title=None, attrType=None, generatorType=None, generatorOptions=None,  metadata=None, visible=None):
        attr = self.get_link_attr_by_title(title)
        if attr != None:
            attr.title = title if title is not None else attr.title
            attr.attrType = attrType if attrType is not None else attr.attrType
            attr.generatorType = generatorType if generatorType is not None else attr.generatorType
            attr.generatorOptions = generatorOptions if generatorOptions is not None else attr.generatorOptions
            attr.metadata = metadata if metadata is not None else attr.metadata
            attr.visible = visible if visible is not None else attr.visible
        else:
            attr = self.add_link_attr_desc(title, attrType, generatorType, generatorOptions, metadata, visible)

        return attr

    def create_via_clone(self, name):
        nw = Network(str(ObjectId()), self.datasetId, self.projectId, name, self.description, self.networkx_graph,
            self.nodeAttrDescriptors, self.linkAttrDescriptors, self.clusterInfo, self.networkInfo, self.generatorInfo,
            unix_time_millis(datetime.datetime.utcnow()), unix_time_millis(datetime.datetime.utcnow()))
        mongoman.create_network_new(nw)
        return nw

    def insert_datapoints_as_nodes(self, dataset, selectedIds = None):
        # a new or empty graph given, so build nodes
        datasetG = dataset.networkx_graph
        idIdx = {}
        filterNodes = selectedIds is not None and len(selectedIds) > 0
        if filterNodes:
            for dataPointId in selectedIds:
                idIdx[dataPointId] = dataPointId

        for dataPointId, attrs in datasetG.nodes(data=True):
            if filterNodes and idIdx.get(dataPointId, None) is None:
                continue
            label = attrs.get('DataPointLabel', None)
            if label is not None:
                self.add_node(dataPointId, dataPointId, label=label)
            else:
                self.add_node(dataPointId, dataPointId)

        return self

    def set_generatorInfo_from_options(self, algoName, algoOptions):
        if type(self.generatorInfo) != dict:
            self.generatorInfo = {}

        self.generatorInfo[algoName] = algoOptions


    ##
    # Serialization / Deserialization
    ##
    def to_dict(self):
        """
        A dict representation which can be easily serialized into json
        """
        nodes = []
        for k,v in self.networkx_graph.nodes(data=True):
            nodes.append(node_to_dict(k,v))

        links = []
        for src,tgt,data in self.networkx_graph.edges(data=True):
            links.append(link_to_dict(src,tgt,data))

        nodeAD = [attr.to_dict() for attr in self.nodeAttrDescriptors]
        linkAD = [attr.to_dict() for attr in self.linkAttrDescriptors]
        print '-' * 50
        print '-' * 50
        print [attr['title'] for attr in nodeAD]
        print '-' * 50
        print [attr['title'] for attr in linkAD]
        print '-' * 50
        print '-' * 50
        js = {
            "id" : self.id,
            "datasetId" : self.datasetId,
            "projectId" : self.projectId,
            "name" : self.name,
            "description" : self.description,
            "nodes" : nodes,
            "links" : links,
            "nodeAttrDescriptors" : nodeAD,
            "linkAttrDescriptors" : linkAD,
            "clusterInfo" : self.clusterInfo,
            "networkInfo" : self.networkInfo,
            "generatorInfo" : self.generatorInfo,
            "nodesFile" : self.nodesFile,
            "linksFile" : self.linksFile,
            "createdAt" : self.createdAt,
            "modifiedAt" : self.modifiedAt
        }
        return js

    def to_json(self):
        js = self.to_map()
        return json.dumps(js)

    def save(self):
        nodeAttrIds = set()
        for attr in self.nodeAttrDescriptors:
            nodeAttrIds.add(attr.id)

        nodeAttrIds.add('dataPointId')

        # remove all attrs for which there is no descriptor to be found
        for n in self.networkx_graph:
            node = self.networkx_graph.node[n]
            for attrId in node.keys():
                if attrId not in nodeAttrIds:
                    node.pop(attrId)

        print "Saving network: %s" % self.id
        print "Num nodes : %i" % self.networkx_graph.number_of_nodes()
        print "Num Links : %i" % self.networkx_graph.number_of_edges()
        print "Num Node Attrs : %i" % len(self.nodeAttrDescriptors)
        print "Num Link Attrs : %i" % len(self.linkAttrDescriptors)

        return mongoman.save_network(self)

    def bake(self):
        """Bake the network so it saves successfully. For legacy support"""

        nodeAD_index = {}
        # Bake nodes
        for attr in self.nodeAttrDescriptors:
            if attr.id not in nodeAD_index:
                nodeAD_index[attr.id] = attr

        for n in self.networkx_graph:
            node = self.networkx_graph.node[n]
            for attr_id, val in node.iteritems():
                if attr_id == 'posX':
                    node['OriginalX'] = float(val)
                if attr_id == 'posY':
                    node['OriginalY'] = float(val)
                if attr_id == 'size':
                    node['OriginalSize'] = float(val)
                if attr_id == 'label':
                    node['OriginalLabel'] = val
                else:
                    if attr_id not in nodeAD_index:
                        newAttr = self.add_node_attr_desc(attr_id, get_attr_type(val))
                        nodeAD_index[newAttr.id] = newAttr

        # Bake links
        linkAD_index = {}
        # Bake links
        for attr in self.linkAttrDescriptors:
            if attr.id not in linkAD_index:
                linkAD_index[attr.id] = attr

        for src,tgt,data in self.networkx_graph.edges(data=True):
            for attr_id, val in data.iteritems():
                if attr_id == 'size':
                    data['OriginalSize'] = float(val)
                if attr_id == 'label':
                    data['OriginalLabel'] = float(val)
                else:
                    if attr_id not in linkAD_index:
                        newAttr = self.add_link_attr_desc(attr_id, get_attr_type(val))
                        linkAD_index[newAttr.id] = newAttr





class AttrDescriptor(object):
    def __init__(self, id, title, attrType="string", generatorType="athena", generatorOptions = None, metadata = None, isStarred=False, visible = True):
        self.id = id
        self.title = title
        self.attrType = str(attrType)
        self.generatorType = generatorType
        self.generatorOptions = generatorOptions
        self.metadata = metadata
        self.visible = visible
        self.isStarred = isStarred
        self.renderType = renderTypesMap[attrType][0]

    def __str__(self):
        return "AttrDescriptor(" + str(self.to_dict()) + ")"

    def to_dict(self):
        return {
            "id" : self.id,
            "title" : self.title,
            "attrType" : self.attrType,
            "generatorType" : self.generatorType,
            "generatorOptions" : self.generatorOptions,
            "metadata" : self.metadata,
            "visible" : self.visible,
            "isStarred" : self.isStarred,
            "renderType": self.renderType
        }

def load_attr_from_json(dsjson):
    return AttrDescriptor(dsjson["id"], dsjson["title"], dsjson["attrType"],
                        dsjson["generatorType"], dsjson["generatorOptions"], dsjson.get("metadata",None),
                        dsjson.get("isStarred", False), dsjson["visible"])

def create_dataset_from_json(dsjson):
    graph = nx.DiGraph()
    for pointjs in dsjson["datapoints"]:
        graph.add_node(pointjs["id"], **pointjs["attr"])

    attrDescriptors = [load_attr_from_json(attrjs) for attrjs in dsjson["attrDescriptors"]]
    ds = Dataset(dsjson["id"], dsjson["projectId"], dsjson["name"], graph, attrDescriptors,
                    dsjson["sourceInfo"], dsjson.get("datapointsFile", None),
                    get_time(dsjson, "createdAt", "dateCreated"), get_time(dsjson, "modifiedAt", "dateModified"))
    return ds

def create_network_from_json(nwjson):
    graph = nx.DiGraph()
    print "Number of nodes: %s" % str(len(nwjson["nodes"]))
    for pointjs in nwjson["nodes"]:
        nodeattr = pointjs["attr"]
        nodeattr["dataPointId"] = pointjs["dataPointId"]
        graph.add_node(pointjs["id"], **nodeattr)

    print "Number of links: %s" % str(len(nwjson["links"]))
    for linkjs in nwjson["links"]:
        linkattr = linkjs["attr"]
        linkattr["id"] = linkjs["id"]
        linkattr["isDirectional"] = linkjs["isDirectional"]
        graph.add_edge(linkjs["source"], linkjs["target"], **linkattr)

    nodeAttrDescriptors = [load_attr_from_json(attrjs) for attrjs in nwjson["nodeAttrDescriptors"]]
    linkAttrDescriptors = [load_attr_from_json(attrjs) for attrjs in nwjson["linkAttrDescriptors"]]
    nw = Network(nwjson["id"], nwjson["datasetId"], nwjson["projectId"], nwjson["name"], nwjson['description'], graph,
                    nodeAttrDescriptors, linkAttrDescriptors,
                    nwjson.get("clusterInfo",{}), nwjson["networkInfo"], nwjson["generatorInfo"],
                    nwjson.get("nodesFile", None), nwjson.get("linksFile", None),
                    get_time(nwjson, "createdAt", "dateCreated"), get_time(nwjson, "modifiedAt", "dateModified"))
    return nw


def create_network_new(dataset, networkName):
    graph = nx.DiGraph()
    nodeAttrDescriptors = []
    nodeAttrDescriptors.append(AttrDescriptor("OriginalX", "OriginalX", 'float', "Original_layout", None, None, False, False))
    nodeAttrDescriptors.append(AttrDescriptor("OriginalY", "OriginalY", 'float', "Original_layout", None, None, False, False))
    nodeAttrDescriptors.append(AttrDescriptor("OriginalColor", "OriginalColor", 'color', "Original_layout", None, None, False, False))
    nodeAttrDescriptors.append(AttrDescriptor("OriginalSize", "OriginalSize", 'float', "Original_layout", None, None, False, False))
    nodeAttrDescriptors.append(AttrDescriptor("OriginalLabel", "OriginalLabel", 'string', "Original_layout", None, None, False, False))

    linkAttrDescriptors = []
    linkAttrDescriptors.append(AttrDescriptor("OriginalColor", "OriginalColor", 'color', "Original_layout", None, None, False, False))
    linkAttrDescriptors.append(AttrDescriptor("OriginalSize", "OriginalSize", 'float', "Original_layout", None, None, False, False))
    linkAttrDescriptors.append(AttrDescriptor("OriginalLabel", "OriginalLabel", 'string', "Original_layout", None, None, False, False))

    nw = Network(str(ObjectId()), dataset.id, dataset.projectId, "network", "network for " + dataset.name, graph,
                        nodeAttrDescriptors, linkAttrDescriptors, {}, {}, {}, None, None,
                        datetime.datetime.utcnow(), datetime.datetime.utcnow())

    if networkName is not None:
        nw.name = networkName
    else:
        nw.genName = True

    mongoman.create_network_new(nw)
    return nw

def datapoint_to_dict(dataPointId, attrs):
    obj = {
           "id" : dataPointId,
    }
    obj["attr"] = attrs
    return obj

def node_to_dict(nodeId, attrs):
    # print "Serializing nodeId: %s" % nodeId
    # print "With attrs: %s" % str(attrs)
    obj = {
           #"id" : str(nodeId),
           "id" : nodeId.encode('utf-8'),
           "dataPointId" : attrs["dataPointId"]
    }
    del attrs["dataPointId"]
    obj["attr"] = attrs
    return obj

def link_to_dict(src, tgt, attrs):
    obj = {
           "id" : str(attrs["id"]),
           "isDirectional" : attrs.get("isDirectional", True),
           "source" : src,
           "target" : tgt
    }
    del attrs["id"]
    if "isDirectional" in attrs:
        del attrs["isDirectional"]
    obj["attr"] = attrs
    return obj

def get_time(js, key1, key2):
    js_date = js.get(key1, None)
    if js_date is None:
        js_timestamp = js[key2]
        print "Timestamp: %s" % js_timestamp
        js_date = datetime.datetime.utcfromtimestamp(int(js_timestamp/1000))

    return js_date

def unix_time(dt):
    epoch = datetime.datetime.utcfromtimestamp(0)
    delta = dt - epoch
    return delta.total_seconds()

def unix_time_millis(dt):
    return int(unix_time(dt) * 1000.0)

def get_attr_type(val):
    if isinstance(val, int) == True:
        return 'integer'
    elif isinstance(val, float) == True:
        return 'float'
    return 'string'
