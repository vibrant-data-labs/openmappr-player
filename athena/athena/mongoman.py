##
# All mongo related handling here
##

from pymongo import MongoClient, ASCENDING, DESCENDING
import json
import datetime
from gridfs import GridFS
from bson.objectid import ObjectId
from os import getpid
from errors import AthenaMongoError
import numpy as np

__client = None
__db = None
__fs = None


###
# JSON Encoder with support for numpy


class NumPyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(ob, np.matrix):
            return map(str,obj.tolist())
        return json.JSONEncoder.default(self, obj)


def get_mongo_client() :
    assert __client != None, "MongoClient not initialized"
    return __client

def get_db():
    assert __db != None, "Db has not been initialized"
    return __db

def get_grid_fs():
    assert __fs != None, "GridFS has not been initialized"
    return __fs

def init(uri, database) :
    print "Initializing Mongo with URI : %s for database : %s" % (uri, database)
    global __client
    global __db
    global __fs
    __client = MongoClient(uri)
    __db = __client[database]
    print __db
    #print __db.collection_names()
    __fs = GridFS(__db)
    # make sure the index are correct on chunk collection
    print "validating chunk index"
    indexInfo = __db.fs.chunks.index_information()
    print "chunk Index Info: %s" % indexInfo
    irritantIndex = indexInfo.get('files_id_1_n_1', None)
    print "found irritantIndex: %s" % irritantIndex
    # create index if only 1) index does not exist or the unique field is False / not defined
    toCreate = irritantIndex is None or not irritantIndex.get('unique', False)
    print "Create index ? : %s" % toCreate
    if toCreate:
        if irritantIndex is not None:
            __db.fs.chunks.drop_index('files_id_1_n_1')
        __db.fs.chunks.create_index([("files_id", ASCENDING),
                                        ("n", ASCENDING)],
                                       unique=True)


def get_datasetId_from_project(projectId):
    print "Getting datasetId for project : %s" % str(projectId)
    db = get_db()
    if projectId is None:
        raise AthenaMongoError('projectId not given. Found to be None')
    project = db.projects.find_one({'_id': ObjectId(projectId)})
    if project is None:
        raise AthenaMongoError( 'project not found. is ID valid? Given Id: ' + str(projectId))
    datasetId = project['dataset']['ref']
    if len(datasetId) == 0:
        raise AthenaMongoError('datasetId not found in the project doc')
    return datasetId

def get_dataset_from_rec(datasetId):
    print "Finding dataset Record for Id %s" % str(datasetId)
    db = get_db()
    db_rec = db.datasetrecords.find_one({ "_id" : ObjectId(datasetId)})
    print "Loaded Dataset %s" % db_rec
    if db_rec is not None:
        db_rec["id"] = db_rec["_id"]
        datapoints = get_file_by_mapping(db_rec["datapointsFile"])
        db_rec["datapoints"] = datapoints
    return db_rec

def get_network_from_rec(networkId):
    print "Finding network Record for Id %s" % str(networkId)
    db = get_db()
    nw_rec = db.networkrecords.find_one({ "_id" : ObjectId(networkId)})
    print "Loaded Network %s" % nw_rec
    if nw_rec is not None:
        nw_rec["id"] = nw_rec["_id"]
        nw_rec["nodes"] = get_file_by_mapping(nw_rec["nodesFile"])
        nw_rec["links"] = get_file_by_mapping(nw_rec["linksFile"])
    return nw_rec

def get_mapping(entityId):
    print "Finding entity mapping for Id %s" % str(entityId)
    db = get_db()
    mappings = db.datamappings.find({ "entityRef" : ObjectId(entityId), "isDeleted" : False}).sort("createdAt", DESCENDING)
    return mappings

def get_file_by_mapping(fileId):
    mappings = get_mapping(fileId)
    fileJson = None
    if mappings.count() == 0:
        fileJson =  get_file_by_id(fileId)
    else:
        # read the latest mapping
        for mapping in mappings:
            if fileJson is None and get_grid_fs().exists(mapping["fileDataRef"]):
                print "Reading file for fileDataRef : %s on Date : %s" % (mapping["fileDataRef"], mapping["createdAt"])
                fileJson =  get_file_by_id(mapping["fileDataRef"])
                break
    return fileJson

def get_file_by_id(gridId):
    print "Reading file with Id %s" % str(gridId)
    fileId = None
    if type(gridId) is ObjectId:
        fileId = gridId
    else:
        fileId = ObjectId(str(gridId))

    if not get_grid_fs().exists(fileId):
        raise AthenaMongoError('Unable to find file with Id: ' + str(fileId))

    jsfile = get_grid_fs().get(fileId)
    dsstr = jsfile.read()
    jsfile.close()
    ds_json = json.loads(dsstr)
    return ds_json

def get_dataset_json(datasetId):
    print "Reading Dataset Id: %s" % datasetId
    db_rec = get_dataset_from_rec(datasetId)
    if db_rec is not None:
        return db_rec
    else:
        mappings = get_mapping(datasetId)
        dsJson = None
        if mappings.count() == 0:
            dsJson =  get_file_by_id(datasetId)
        else:
            # read the latest mapping
            for mapping in mappings:
                if dsJson is None and get_grid_fs().exists(mapping["fileDataRef"]):
                    print "Reading file for fileDataRef : %s on Date : %s" % (mapping["fileDataRef"], mapping["createdAt"])
                    dsJson =  get_file_by_id(mapping["fileDataRef"])
                    break

        return dsJson

def get_network_json(networkId):
    print "Reading networkId Id: %s" % networkId
    nw_rec = get_network_from_rec(networkId)
    if nw_rec is not None:
        return nw_rec
    else:
        mappings = get_mapping(networkId)
        nwJson = None
        if mappings.count() == 0:
            nwJson =  get_file_by_id(networkId)
        else:
            # read the latest mapping
            for mapping in mappings:
                if nwJson is None and get_grid_fs().exists(mapping["fileDataRef"]):
                    print "Reading file for fileDataRef : %s on Date : %s" % (mapping["fileDataRef"], mapping["createdAt"])
                    nwJson =  get_file_by_id(mapping["fileDataRef"])
                    break

        return nwJson

def create_network_new(network):
    db = get_db()
    print "Updating project : %s" % network.projectId
    if network.genName:
        project = db.projects.find_one({'_id': ObjectId(network.projectId)})
        count = 0
        if 'allGenNWIds' in project:
            count = len(project['allGenNWIds'])
        elif 'networks' in project:
            count = len(project['networks'])
        print("Number of networks in project: " + str(count))

        network.name = network.name + ' ' + str(count + 1)
        network.genName = False

    return network
def exists_in_project(networkId, project):
    return len(filter(lambda obj: obj['ref'] == networkId, project['networks'])) > 0

def store_via_mapping(mapped_id, entity_js, filename, metadata):
    db = get_db()
    fs = get_grid_fs()

    meta = dict(metadata)
    meta["mappedId"] = ObjectId(mapped_id)
    objId = fs.put(entity_js, filename=filename, metadata=metadata)
    print "Saving entities with Id: %s to mapping: %s" % (mapped_id, str(objId))

    updateResult = db.datamappings.update_many({"entityRef": ObjectId(mapped_id)}, {'$set': {'isDeleted': True}})
    print "set isDeleted flag of %s mappings to True" % updateResult.modified_count

    mapping = db.datamappings.insert_one({
        "entityRef" : ObjectId(mapped_id),
        "fileDataRef" : objId,
        "opInfo" : {
            "generated" : "Athena"
        },
        "createdAt" : datetime.datetime.utcnow(),
        "isDeleted" : False
    })
    return mapped_id


def save_network(network):
    db = get_db()
    nw_dic = network.to_dict()
    fs = get_grid_fs()
    networkId = ObjectId(network.id)

    nodes = nw_dic["nodes"]
    links = nw_dic["links"]
    nodesJs = json.dumps(nodes, cls=NumPyEncoder)
    linksJs = json.dumps(links, cls=NumPyEncoder)

    if nw_dic["nodesFile"] is None:
        nw_dic["nodesFile"] = ObjectId()

    if nw_dic["linksFile"] is None:
        nw_dic["linksFile"] = ObjectId()


    # save data and get the file Id
    nodesFile = store_via_mapping(nw_dic["nodesFile"], nodesJs, filename="network_nodes_" + str(network.id), metadata=dict(networkId=networkId, entityId=ObjectId(networkId), nNodes=len(nodes)))
    linksFile = store_via_mapping(nw_dic["linksFile"], linksJs, filename="network_links_" + str(network.id), metadata=dict(networkId=networkId, entityId=ObjectId(networkId), nLinks=len(links)))

    # if nw_dic["nodesFile"] is not None:
    #     print "deleting older nodes: %s" % nw_dic["nodesFile"]
    #     fs.delete(nw_dic["nodesFile"])

    # if nw_dic["linksFile"] is not None:
    #     print "deleting older links: %s" % nw_dic["linksFile"]
    #     fs.delete(nw_dic["linksFile"])

    nw_dic["nNodes"] = len(nodes)
    nw_dic["nLinks"] = len(links)
    # nw_dic["nodesFile"] = nodesFile
    # nw_dic["linksFile"] = linksFile

    nw_dic.pop("nodes", None)
    nw_dic.pop("links", None)
    nw_dic.pop("id", None)

    updateResult = db.networkrecords.replace_one({"_id" : networkId}, nw_dic, True)
    print "Network replace result: %s" % str(updateResult.raw_result)
    # check if the network already exists, if yes, then simply update it. otherwise add a new network
    if updateResult.matched_count == 0:
       # update project if needed
       networkObj = {
           "ref" : network.id
       }
       proj = db.projects.find_one({ '_id' : ObjectId(network.projectId) })
       if not exists_in_project(network.id, proj):
           db.projects.update_one(
               { "_id" : ObjectId(network.projectId) },
               {
                   "$push" : { "allGenNWIds" : network.id },
                   "$push" : { "networks" : networkObj }
               }
           )

    # objId = ObjectId()
    # print "Saving network with Id: %s to mapping: %s" % (network.id, str(objId))

    # updateResult = db.datamappings.update_many({"entityRef": ObjectId(network.id)}, {'$set': {'isDeleted': True}})
    # print "set isDeleted flag of %s mappings to True" % updateResult.modified_count

    # mapping = db.datamappings.insert_one({
    #     "entityRef" : ObjectId(network.id),
    #     "fileDataRef" : objId,
    #     "opInfo" : {
    #         "generated" : "Athena"
    #     },
    #     "createdAt" : datetime.datetime.utcnow(),
    #     "isDeleted" : False
    #     })


    # fs.put(js, _id = objId)

def has_task_been_done(taskId, projectId, datasetId, networkId):
    db = get_db()
    athenaOp = db.athenaops.find_one({'task_id' : taskId, "eventType" : "athena:done"})
    print "MONGOMAN:has_task_been_done: %s" % str(athenaOp)
    if athenaOp is not None:
        if projectId == str(athenaOp["projectId"]) and datasetId == str(athenaOp["datasetId"]):
            return True
        else:
            return False
    return False

def save_result_log(eventType, beanstalk_job_id, algo_name, job_type, job_id, task_id, projectId, datasetId, networkId):
    db = get_db()
    db.athenaops.insert_one({
        "athena_pid" :str(getpid()),
        "beanstalk_job_id" : beanstalk_job_id,
        "algo_name" : algo_name,
        "job_type" : job_type,
        "job_id" : job_id,
        "task_id" : task_id,
        "eventType" : eventType,

        "projectId" : ObjectId(projectId),
        "datasetId" : datasetId,
        "networkId" : networkId,

        "createdAt" : datetime.datetime.utcnow(),
        })

