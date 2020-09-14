##
# All mongo related handling here
##
from pymongo import MongoClient
import gridfs
import json
from bson.objectid import ObjectId

from mongokit import *
import datetime

__mongoClient = None

def getMongoClient() :
    assert(__mongoClient != None)
    return __mongoClient

def init(uri, database) : 



class GridDataset:
    def __init(self, jsData):
        self


class Event(Document):
    __collection__ = "events"
    __database__ = database
    #use_schemaless = True
    structure = {
        "type": basestring,
        "payload" : dict
    }
    required_fields = ['type']


class Dataset(Document):
    __collection__ = "datasets"
    __database__ = database
    use_schemaless = True
    structure = {
        "setName": basestring,
        "descr":   basestring,
        "picture": basestring,
        "org":        {"ref": basestring, "orgName": basestring, "picture": basestring},
        "owner":      {"ref": basestring, "email": basestring, "name": basestring, "picture": basestring},
        "projects":   [{
            "ref":        basestring,
            "projName":   basestring,
            "picture":    basestring,
            "owner":      {"ref": basestring, "email": basestring, "name": basestring, "picture":basestring}
        }],
        "data": {
            "graph":     [{
                "id":basestring,
                "val":basestring
            }],
            "nodeAttrs":[{
                "id":               basestring,
                "title":            basestring,
                "attrType":         basestring,
                "generatorType":    basestring,
                "generatorOptions": basestring,
                "visible":          bool
            }],
            "nodes":[{
                "id":       basestring,
                "label":    basestring,
                "size":     OR(int,float),
                "posX":     OR(int,float),
                "posY":     OR(int,float),
                "col":      {"r":int, "g":int, "b":int},
                "layerId":  int,
                "visible":  bool,
                "attr":[{
                    "id":basestring,
                    "val":basestring
                }]
            }],
            "edgeAttrs": [{
                "id":                 basestring,
                "title":              basestring,
                "attrType":           basestring,
                "generatorType":      basestring,
                "generatorOptions":   basestring,
                "visible":            bool
            }],
            "edges":[{
                "id":      basestring,
                "source":  basestring,
                "target":  basestring,
                "edgeType":basestring,
                "label":   basestring,
                "layerId": int,
                "col":     {"r":int, "g":int, "b":int},
                "visible": bool,
                "attr":[{
                    "id":basestring,
                    "val":basestring
                }]
            }],
            "clusterings": [{
                "name":     basestring,
                "clusters":[{
                    "cluster":    basestring,
                    "rawAnswer":  basestring,
                    "answer":     basestring,
                    "freq":       OR(int,float),
                    "globalFreq": OR(int,float),
                    "wtdFreq":    OR(int,float),
                    "importance": OR(int,float)
                }]
            }]
        },
        "activity": [{
            "actor":      basestring,
            "action":     basestring,
            "timestamp":  datetime.datetime
        }],
        "dateCreated":    datetime.datetime,
        "dateModified":   datetime.datetime
    }
    required_fields = ['setName']
    default_values = {
        'picture' : '',
        'setName' : 'autogen',
        "data": {
            "nodeAttrs":[{
                "visible": True
            }],
            "nodes":[{
                "label": "node",
                "layerId": 0,
                "visible": True
            }],
            "edgeAttrs":[{
                "visible": True
            }],
            "edges":[{
                "label": "edge",
                "layerId": 0,
                "visible": True
            }],
        },
        "activity": [{
            "timestamp": datetime.datetime.utcnow()
        }],
        "dateCreated": datetime.datetime.utcnow()
    }
    def printDebug(self):
        print('number of nodes: %i' % len(self['data']['nodes']))        
        print('number of edges: %i' % len(self['data']['edges']))        

## def uri mongodb://localhost:27017/MPTEST
# BUG Unable to connect to anything else other than localhost
class MongoWrapper:
    """Mongo Interface"""
    def __init__(self, uri):
        connection = Connection(uri)
        print(connection.MPTEST)
        connection.register([Dataset, Event])
        self.connection = connection
        self.fs = gridfs.GridFS(connection.MPTEST)

    def create_new_task(self, eventType, payload):
        newEvent = self.connection.Event()
        newEvent["type"] = eventType
        newEvent["payload"] = payload
        print("Created Task  %s" % newEvent)
        newEvent.save()
        print("Saved Task  %s" % newEvent.to_json())
        print("Saved Task with Id %s" % newEvent['_id'])
        return str(newEvent['_id'])

    def get_data_by_id(self, dataId, createNew = False, isDataChunked = False):
        objId = ObjectId(dataId)
        if isDataChunked == True:
            return self.get_gridfs_file(objId, createNew)
        else:
            data = self.connection.MPTEST.datasets.Dataset.one({"_id": objId})
            if data is None:
                print ("Error getting data set %s" % dataId)
            elif data['data']['edgeAttrs'] is None:
                data['data']['edgeAttrs'] = []

            if createNew:
                print ("Creating a copy of data")
                newData = self.connection.MPTEST.datasets.Dataset()
                newData.save()
                data['_id'] = newData['_id']
                data['setName'] = "Athena_gen"
                data["dateCreated"] = newData["dateCreated"]
                data["dateModified"] = newData["dateCreated"]
                data.save()
        return (data, data['_id'])

    def get_gridfs_file(self, dId, createNew = False):
        dsStr = self.fs.get(dId).read()
        dsJson = json.loads(dsStr)
        if createNew:
            print ("Creating a copy of data")
            newId = self.save_gridfs(dsJson)
            print(newId)
            dId = newId
        return (dsJson, str(dId))

    def save_gridfs(self, data, dataId = None):
        dsStr = json.dumps(data)
#        print('Saving data string: %s' % dsStr)
        assert len(dsStr) > 0
        if dataId != None:
            newDs = self.fs.put(dsStr, filename="athena_Gen", _id = dataId)
        else:
            newDs = self.fs.put(dsStr, filename="athena_Gen")
            
        print('saving to file with id %s' % str(newDs))
        return newDs




