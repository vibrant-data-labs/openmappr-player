##
# All mongo related handling here
##
import beanstalkc
import json
from datetime import datetime

import mongoman

_BS_CLIENT = None

class JobReporter(object):
    def __init__(self, job, job_id, projectId, taskId):
        self.job = job # the beanstalk job
        self.job_id = job_id
        self.projectId = projectId
        self.taskId = taskId
        self.algo = None

    def set_algo(self, algo):
        self.algo = algo
        return self

    def send(self, msgType, payload):
        event = {
            "type" : msgType,
            "job_id" : self.job_id,
            "task_id" : self.taskId,
            "projectId" : self.projectId,
        }
        payload.update(event)

        event = {
            "type" : "athena_algo",
            "payload" : payload
        }
        _BS_CLIENT.put(json.dumps(event, separators=(',', ':')))

    def send_start(self):
        payload = {
            "name": "Athena",
            "status":  "running"
        }
        self.send("create", payload)

    def send_update(self, msg, percentCompletion=0):
        eventPayload = {
            "id": self.taskId,
            "msg": msg,
            "completion" : percentCompletion
        }
        self.send("notify", eventPayload)

    def send_done(self):
        algo = self.algo
        eventPayload = {
            "status":  "completed",
            "completion" : 100,
            "result": {
                "algo_result": getattr(algo, 'result', algo.algoId),
                "datasetId": str(algo.dataset.getId()),
                "networkId": str(algo.network.getId())
            }
        }
        mongoman.save_result_log("athena:done", self.job.jid, self.algo.name, "athena_algo", 
            self.job_id, self.taskId,
            self.projectId, algo.dataset.getId(), algo.network.getId())

        self.send("update", eventPayload)

    def send_error(self, errorMsg):
        eventPayload = {
            "status":  "failed",
            "result": errorMsg
        }
        self.send("error", eventPayload)
        self.send_delete()
        mongoman.save_result_log("athena:error", self.job.jid, self.algo.name, "athena_algo", 
            self.job_id, self.taskId,
            self.projectId, None, None)


    def send_delete(self):
        self.send("delete", {})




def init(bsClient):
    global _BS_CLIENT
    _BS_CLIENT = bsClient

# def create_new_task(taskId, eventType, payload):
#     raise Exception("Not to be used")
#     newEvent = {
#         "type" : eventType,
#         "data" : payload
#     }
#     print "%s Created Task  %s" % (datetime.utcnow().isoformat(' '), newEvent)
#     _BS_CLIENT.use(taskId)
#     _BS_CLIENT.put(json.dumps({"type" : 'athena_events', "payload" : newEvent}))

# def delete_task(taskId):
#     raise Exception("Not to be used")
#     newEvent = {
#         "type" : "delete",
#         "data" : {
#             "id" : taskId
#         }
#     }
#     print "%s Created Task  %s" % (datetime.utcnow().isoformat(' '), newEvent)
#     _BS_CLIENT.use(taskId)
#     _BS_CLIENT.put(json.dumps({"type" : 'athena_events', "payload" : newEvent}))
