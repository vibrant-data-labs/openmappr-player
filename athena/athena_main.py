
from flask import Flask, abort, make_response, request, jsonify
import os
import beanstalkc

from athena.algoRunner import AlgoRunner
from athena import mongoman
from athena import entities
from athena import jobTracker
# from mongoutils import MapprData

#algo Runner
algoMon = AlgoRunner()


def is_json(request):
    """Indicates if this request is JSON or not.  By default a request
    is considered to include JSON data if the mimetype is
    ``application/json`` or ``application/*+json``.

    .. versionadded:: 0.11
    """
    mt = request.mimetype
    app.logger.info("Mime Type: %s" %mt);
    if mt == 'application/json':
        return True
    if mt.startswith('application/') and mt.endswith('+json'):
        return True
    return False
####
# Routes and core server
####
app = Flask(__name__, instance_relative_config=True)
configObjName = 'config.' + os.environ.get('CONFIG', "DevelopmentConfig")
app.config.from_object(configObjName)
print 'Loaded config: %s' % configObjName
mongoman.init(app.config['DATABASE_URI'], app.config['DATABASE'])

#jobTracker.init(app.config['BEANSTALK_HOST'], app.config['BEANSTALK_PORT'])
jobTracker.init(beanstalkc.Connection(app.config['BEANSTALK_HOST'], app.config['BEANSTALK_PORT']))

@app.route('/')
@app.route('/index')
def index():
    return "Hello, Athena!"

@app.route('/algos', methods=['GET'])
def getAlgoList():
    """The list of algorithms registered in Athena"""
    return jsonify(algoMon.algoList())

@app.route('/algo', methods=['POST'])
def algoCreate():
    name = None
    datasetId = None 
    options = None # optional

    if is_json(request):
        app.logger.info('Json Request')
        js = request.get_json()
        app.logger.info('Got json: %s' % js)
        name = js['algo_name']
        taskId = js.get('taskId', None)
        # datasetId = js['datasetId']
        projectId = js.get('projectId', None)
        datasetId_inReq = js.get('datasetId', None)
        networkId = js.get('networkId', None)
        options = js.get('options', None)
        createNew = js.get('createNew', False)
        newNetworkName = js.get('newNetworkName', None)
    else:
        app.logger.info('Non-json Request')
        name = request.form['algo_name']
        taskId = request.form.get('taskId', None)
        # datasetId = request.form['datasetId']
        projectId = request.form.get('projectId', None)
        datasetId_inReq = request.form.get('datasetId', None)
        networkId = request.form.get('networkId', None)
        options = request.form.get('options', None)
        createNew = request.form.get('createNew', False)
        newNetworkName = request.form.get('newNetworkName', None)

    if networkId == None and createNew == False:
        app.logger.warning("No network Id given!")
        abort(400)
    if datasetId_inReq is None:
        datasetId = mongoman.get_datasetId_from_project(projectId)
    else:
        datasetId = datasetId_inReq
    
    reporter = jobTracker.JobReporter(None, "from_webserver", projectId, taskId)
    algo = algoMon.create_algo(name, datasetId, networkId, newNetworkName, options, reporter)
    if algo != None:
        rval = algoMon.algoRun(algo)
        return jsonify({
                'result' : algo.algoId,
                'datasetId' : algo.dataset.id,
                'networkId' : algo.network.id
            })

    else:
        return make_response(("Unable to create algorithm.", 400))

@app.route('/algo/<int:algoId>', methods=['GET','DELETE'])
def algoId(algoId):
    if request.method == 'GET':
        rval = algoMon.algoStatus(algoId)
    else:
        rval = algoMon.algoStop(algoId)

    resp = jsonify(rval)
    if 'error' in rval:
        resp.status_code = rval['error']

    return resp

if __name__ == '__main__':
    print("loaded as a script")
    app.run(host='0.0.0.0')
else:
    print("Loaded for guicorn")
    # configObjName = 'config.' + os.environ.get('CONFIG', "TestingConfig")
    # app.config.from_object(configObjName)
    # print 'Loaded config: %s' % configObjName
    # mongoman.init(app.config['DATABASE_URI'], app.config['DATABASE'])
    # # app.config.from_object('config.ProductionConfig')
    # print('starting athena server via guicorn')
    # # mongoman.init(app.config['DATABASE_URI'], app.config['DATABASE'])
