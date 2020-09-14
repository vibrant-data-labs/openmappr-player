# runs as a athena beanstalkD server
import os
import beanstalkc
import json
import sys
# import logging
import traceback
from time import sleep

import config
from athena.algoRunner import AlgoRunner
from athena import mongoman
from athena import jobTracker
from athena.errors import AthenaError

# for etl
from athena.miscstuff.SimMatToNetwork import SimMatToNetwork


# create logger
# logger = logging.getLogger("athena_beanstalkD")
# logger.setLevel(logging.DEBUG)

# create console handler and set level to debug
# ch = logging.StreamHandler()
# ch.setLevel(logging.DEBUG)

# # create formatter
# formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# # add formatter to ch
# ch.setFormatter(formatter)

# add ch to logger
# logger.addHandler(ch)





_BS_CLIENT = None


def init(host, port, pipe):
    global _BS_CLIENT
    print("Attempting to connect to beanstalk: %s:%s"%(host, port))
    _BS_CLIENT = beanstalkc.Connection(host, port)
    jobTracker.init(_BS_CLIENT)
    print("Connected with beanstalk successfully!")
    _BS_CLIENT.watch(pipe)

def run_server():
    job = None
    try:
        while True:
            print("Waiting for a Job")
            job = _BS_CLIENT.reserve()
            job.delete()
            process_job(job)
            sys.stdout.flush()

    except Exception, e:
        traceback.print_exc()
        print("JOB FAILED")
        raise e
    # finally:
    #     if job is not None:
    #         job.delete()



def process_job(job):
    print("Got a Job %s" % job.jid)
    payload = json.loads(job.body)

    client_tubeId = payload.get('client_tubeId', None)
    jobType = payload.get('job_type', None)
    job_id = payload.get('job_id', None)

    if client_tubeId is None:
        raise AthenaError("No Client Id found. Can't report it to anywhere")

    # I am hoping that this has to be done only once
    # since this a single threaded process
    _BS_CLIENT.use(client_tubeId)

    try:

        if jobType is None:
            raise AthenaError("No jobType found. Can't run a job")
        if job_id is None:
            raise AthenaError("No job_id found. Can't respond to a job")

        data = payload.get('data', None)

        if jobType == "athena_algo":
            run_athena_algo(job, job_id, data)
        elif jobType == "athena_algo_listing":
            run_athena_algo_listing(job, job_id, data)
        elif jobType == "etl_algo":
            run_etl_algo(job, job_id, data)
        else:
            AthenaError("Job type not defined, got: %s" % jobType)


    except AthenaError:
        traceback.print_exc()
        _BS_CLIENT.put(json.dumps({
            "type" : "athena_failed",
            "payload" : {
                "job_id" : job_id,
                "status" : "failed",
                "result" : traceback.format_exc()
            }
        }))

def parse_task_body(taskData):
    """
        job_body contains
        client_tubeId : the tube on which client listens
        taskId : unique task Id for this task
        projectId : the project on which this task has to run
        datasetId : the dataset Id
        networkId : the networkId (optional)
        algo_name : the name of the algo to run
        options : an Map containing options for the algo
        createNew : whether to create a new network or not
        networkName : the name of the new network
    """
    # taskData = json.loads(strBody)
    print("got a task %s", str(taskData))

    taskId         = taskData.get('taskId', None)
    projectId      = taskData.get('projectId', None)
    datasetId      = taskData.get('datasetId', None)
    networkId      = taskData.get('networkId', None)
    algoName       = taskData.get('algo_name', None)
    options        = taskData.get('options', None)
    createNew      = taskData.get('createNew', False)
    newNetworkName = taskData.get('newNetworkName', None)

    if taskId is None:
        raise AthenaError("no taskId in task body")
    if projectId is None:
        raise AthenaError("no projectId in task body")
    if algoName is None:
        raise AthenaError("no algoName in task body")

    if networkId == None and createNew == False:
        logger.warning("No network Id given!")
        raise AthenaError('no network Id given, createNew is False')

    if datasetId is None:
        datasetId = mongoman.get_datasetId_from_project(projectId)
        taskData['datasetId'] = datasetId

    return taskData

def run_athena_algo(job, job_id, payload):
    taskData = parse_task_body(payload)

    taskId         = taskData.get('taskId', None)
    projectId      = taskData.get('projectId', None)
    datasetId      = taskData.get('datasetId', None)
    networkId      = taskData.get('networkId', None)
    algoName       = taskData.get('algo_name', None)
    options        = taskData.get('options', None)
    # createNew      = taskData.get('createNew', False)
    newNetworkName = taskData.get('newNetworkName', None)

    reporter = jobTracker.JobReporter(job, job_id, projectId, taskId)
    algo = algoMon.create_algo(algoName, datasetId, networkId, newNetworkName,
                                options, reporter)

    is_done = mongoman.has_task_been_done(taskId, projectId, datasetId, networkId)

    if is_done:
        algo.reporter.send_error({
            "message" : "Algo has already been started... please wait!",
            "payload" : payload
        })
    else:
        if algo is None:
            algo.reporter.send_error("Unable to execute algo")
        else:
            try:
                algoMon.algoRun(algo)
                algo.reporter.send_done()
                algo.reporter.send_delete()

            except StandardError:
                algo.reporter.send_error(traceback.format_exc())

def run_athena_algo_listing(job, job_id, payload):
    listing = algoMon.algoList()
    _BS_CLIENT.put(json.dumps({
        "type" : "athena_algo_listing",
        "payload" : {
            'job_id' : job_id,
            "listing" : listing
        }
    }))

def run_etl_algo(job, job_id, payload):
    taskData = payload
    taskId         = taskData.get('taskId', None)
    recipeId       = taskData.get('recipeId', None)
    algoName       = taskData.get('algo_name', None)
    options        = taskData.get('options', None)

    print "Running etl algo: %s" % algoName
    print options
    algo = SimMatToNetwork(0, recipeId)
    try:
        print "algo initialized"
        _BS_CLIENT.put(json.dumps({
            "type" : "etl_algo",
            "payload" : {
                'job_id' : job_id,
                'recipeId' : recipeId,
                "type" : "create",
                "status":  "running",
                "completion" : 0
            }
        }))
        algo.start(options)
        print "Algo finished"
        print algo.result
        print algo.status
        _BS_CLIENT.put(json.dumps({
            "type" : "etl_algo",
            "payload" : {
                'job_id' : job_id,
                'task_id' : taskId,
                'recipeId' : recipeId,
                "type" : "update",
                "status":  algo.status,
                "completion" : 100,
                "result" : algo.result
            }
        }))
    except AthenaError:
        print "AthenaError"
        traceback.print_exc()
        _BS_CLIENT.put(json.dumps({
            "type" : "etl_algo",
            "payload" : {
                'job_id' : job_id,
                'task_id' : taskId,
                'recipeId' : recipeId,
                'type' : 'error',
                "status":  "failed",
                "isAthenaError" : True,
                'result' : traceback.format_exc()
            }
        }))

    except StandardError:
        print "StandardError"
        traceback.print_exc()
        _BS_CLIENT.put(json.dumps({
            "type" : "athena_failed",
            "payload" : {
                'job_id' : job_id,
                'task_id' : taskId,
                'recipeId' : recipeId,
                'type' : 'error',
                "status":  "failed",
                "isAthenaError" : False,
                'result' : traceback.format_exc()
            }
        }))
    finally:
        # delete temp files
        if algo.entity_download_path is not None:
            os.remove(algo.entity_download_path)
        if algo.simMat_download_path is not None:
            os.remove(algo.simMat_download_path)
        # send algo deleted
        _BS_CLIENT.put(json.dumps({
            "type" : "etl_algo",
            "payload" : {
                'job_id' : job_id,
                'task_id' : taskId,
                'recipeId' : recipeId,
                'type' : 'delete',
            }
        }))

configObjName = os.environ.get('CONFIG', "DevelopmentConfig")
print "Using Config: %s" % configObjName
conf = config.DevelopmentConfig

if configObjName == "ProductionConfig":
    conf = config.ProductionConfig
elif configObjName == "TestingConfig":
    conf = config.TestingConfig
elif configObjName == "DockerConfig":
    conf = config.DockerConfig
else:
    conf = config.DevelopmentConfig

print "Conf Obj: %s" % str(conf)

mongoman.init(conf.DATABASE_URI, conf.DATABASE)
#algo Runner
algoMon = AlgoRunner()
init(conf.BEANSTALK_HOST, conf.BEANSTALK_PORT, conf.BEANSTALK_PIPE)

run_server()
