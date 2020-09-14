'use strict';
var _        = require('lodash'),
    request  = require('request'),
    assert   = require('assert'),
    Promise  = require('bluebird'),
    util     = require('util');

var elasticsearch = require('elasticsearch');

var
    DSModel          = require("./datasys_model"),
    userModel        = require("../user/user_model"),
    projModel        = require("../project/proj_model"),
    NetworkDataCache = require("../services/NetworkDataCache.js"),
    DataMerge        = require("./data_merge.js"),
    AlchemyAPI       = require('../services/AlchemyAPI'),
    LinkedInAPI      = require('../services/LinkedInAPI'),
    JobTracker       = require('../services/JobTracker'),
    ES_Search = require("../services/elasticsearch"),
    AppConfig = require('../services/AppConfig');

///
/// Delivers functionality behind the dataIngestion Modal
///

//
// LinkedIn API
//

// Configs
var liConfig = _.get(AppConfig.get(), 'linkedIn');
var linkedInConfig = {
    apiKey : liConfig.apiKey,
    secretKey : liConfig.secretKey,
    callbackUrl : liConfig.callbackUrl
};

var stateUsrCache = {};
/**
 * returns the url needed to authorize linkedin, returns state:"expired"
 *  or if access_token is valid, returns state:"valid"
 */
function genLinkedInAuthUrl (req, res) {
    var state = Math.random();
    var url = util.format("https://www.linkedin.com/uas/oauth2/authorization?response_type=code" +
        "&client_id=%s" +
        "&state=%s" +
        "&redirect_uri=%s",
        linkedInConfig.apiKey,
        state,
        linkedInConfig.callbackUrl
    );
    var user = req.user;
    if(userModel.isLinkedInAccessTokenValid(user)) {
        res.status(200).send({
            "state" : "valid"
        });
    } else {
        stateUsrCache[state] = user;
        res.status(200).send({
            "state" : "expired",
            "url" : url
        });
    }
}
// Called by linkedIn
function onLinkedInCallback (req, res) {
    var authCode = req.query.code,
        state = req.query.state; // needed for cache
    if(authCode && state) {
        var url = util.format("https://www.linkedin.com/uas/oauth2/accessToken?grant_type=authorization_code" +
            "&code=%s" +
            "&redirect_uri=%s" +
            "&client_id=%s" +
            "&client_secret=%s",
            authCode,
            linkedInConfig.callbackUrl,
            linkedInConfig.apiKey,
            linkedInConfig.secretKey
        );
        request.get(url, function(err, response, body) {
            var jsBody = JSON.parse(body);

            if (err)
                res.send(500,err);
            else {
                var usr = stateUsrCache[state];
                delete stateUsrCache[state];
                userModel.updateLinkedInToken(usr, jsBody.access_token, Date.now() + _.parseInt(jsBody.expires_in),
                    function(err) {
                        // user obj updated with data
                        if (err)
                            res.send(500,err);
                        else {
                            res.render("closemodal");
                        }
                    });
            }
        });
    } else {
        console.log("Error occured in linkedIn giving access");
        res.status(500).send({
            authCode : authCode,
            state : state
        });
    }
}
//
// Main LinkedIn req handler
//
function importLinkedInContent (req, res) {
    var accessToken = req.user.linkedin.access_token;
    var logPrefix = "[dataIngestionController.importLinkedInContent] ";

    var proj = req.project;

    var newTask = JobTracker.create("LinkedInAPI" + req.user.name);
    res.status(200).json(newTask);

    LinkedInAPI.getConnections(accessToken)
    .tap (function(connData) {
        console.log(logPrefix + "Got connections. Length :", connData.length);
        JobTracker.update(newTask.id, "running", null, 20);
    })
    .then(function(connData) {
        JobTracker.update(newTask.id, "running", null, 20);
        return LinkedInAPI.buildGraphDataFromConn(connData, req.body.fields);
    })
    .then(function(parsedData) {
        console.log(logPrefix + "Build Graph . NumDatapoints :", parsedData.datapoints.length);
        var dataset = new DSModel.Dataset(null, proj.id, 'dataset', parsedData.datapoints, parsedData.attrDescriptors, {
            origin: "LinkedIn"
        });
        var network = DSModel.createEmptyNetwork(dataset.id, proj.id);
        network.nodes = parsedData.nodes;
        network.nodeAttrDescriptors = parsedData.nodeAttrDescriptors;
        JobTracker.update(newTask.id, "running", null, 20);
        return [dataset, network];
    })
    .spread(function(dataset, network) {
        JobTracker.update(newTask.id, "running", null, 20);
        return [DSModel.saveDataset(dataset), DSModel.saveNetwork(network)];
    }).spread(function(dataset, network) {
        projModel.updateDatasetAsync(proj, dataset);
        projModel.addNetworkAsync(proj, network);
        JobTracker.update(newTask.id, "completed", {
            datasetId : dataset.id,
            networkId : network.id
        }, 20);
    }).catch(function(err) {
        console.error(logPrefix + "Error in Importing. ", err);
        err = err.stack || err;
        JobTracker.update(newTask.id, "failed", err);
    });
}
/// End of LinkedIn

//
// Import.io
// user provides a url with the api key. We run a get req on it and build the dataset
//

function importImportIO (req, res) {
    var logPrefix = "[dataIngestionController.importImportIO] ";
    var url = req.body.importioUrl;
    var proj = req.project;

    request.get(url, function(err, response, body) {
        var jsBody = JSON.parse(body);

        if (err)
            res.send(500,err);
        else {
            // We have data! Build network data from it
            console.log(logPrefix + "Got data. Size : ", jsBody.results.length);
            console.log(logPrefix + "Got data. pageUrl : ", jsBody.pageUrl);
            // build node attrs
            var attrDescriptors = [];
            _.each(jsBody.results[0], function(val, prop) {
                attrDescriptors.push(new DSModel.AttrDescriptor(prop, prop, null, 'ImportIO'));
            });

            // build nodes
            var datapoints = _.map(jsBody.results, function(nodeData, index) {
                var attr = _.reduce(nodeData, function(acc, attr, prop) {
                    acc[prop] = attr;
                    return acc;
                }, {});
                return new DSModel.DataPoint(index, attr);
            });
            var nodes = _.map(datapoints, function  (datapoint) {
                return new DSModel.Node(datapoint.id, datapoint.id, {});
            });
            var dataset = new DSModel.Dataset(null, proj.id, 'dataset', datapoints, attrDescriptors, {
                origin: url
            });
            var network = DSModel.createEmptyNetwork(dataset.id, proj.id);
            network.nodes = nodes;
            console.log(logPrefix + "Built Dataset . NumDatapoints : %i , NumAttrs : %i",
                dataset.datapoints.length, dataset.attrDescriptors.length);

            return Promise.join(DSModel.saveDataset(dataset), DSModel.saveNetwork(network),
                    function (dataset, network) {
                        projModel.updateDatasetAsync(proj, dataset);
                        projModel.addNetworkAsync(proj, network);
                        res.status(200).send({
                            datasetId : dataset.id,
                            networkId : network.id
                        });
                    })
                .catch(function(err) {
                    console.error(logPrefix + "Error in Importing. ", err);
                    err = err.stack || err;
                    res.status(500).send(err);
                });
        }
    });
}

//
// Alchemy API
//
// Given a queryAttrId , and an AlchemyAlgo, run alchemy on it and save to a new attribute.
// THe Client has to make sure that the queryAttrId exists and attrTitle is new
// relevance filter can be used to filter results
function runAlchemy (req, res) {

    var newTaskId = null;
    var increment = 0;
    var logPrefix = "[dataIngestionController.runAlchemy] ";
    var queryAttrId = req.body.queryAttrId,
        selectedAlgos = req.body.selectedAlgos;

    // fix naming. title contains algoName, stupid frontend dev
    _.each(selectedAlgos, function(val) { val.algoName = val.title; });

    var algosToRun     = _.map(selectedAlgos, 'algoName'),
        keywordAlgoObj = _.find(selectedAlgos, 'algoName', 'keywords'),
        relevance      = parseFloat(req.body.relevance);
    var proj = req.project;

    var datasetP = DSModel.readDataset(proj.dataset.ref, false)
    .then(function(dataset) {
        // validate attributes
        if(!_.any(dataset.attrDescriptors, {"id" : queryAttrId}))
            throw new Error(logPrefix + "queryAttrId does not exist on the node. Given : " + queryAttrId);

        _.each(selectedAlgos, function(algo) {
            if(_.any(dataset.attrDescriptors, {"title" : algo.newAttrTitle}))
                throw new Error(logPrefix + "newAttrTitle is already a node Attr Title. Given : " + algo.newAttrTitle);

            // add the new attr to dataset, Id is s_n_a_k_e_c_a_s_e
            var newAttrType ;
            if(algo.title === 'sentiment') {
                newAttrType = 'float';
            }
            else {
                newAttrType = 'liststring';
            }
            var newAttr = new DSModel.AttrDescriptor(algo.newAttrTitle.replace(/\s/g, '_'), algo.newAttrTitle, newAttrType, 'Alchemy.' + algo.title, null, null, true);
            dataset.attrDescriptors.push(newAttr);
            algo.newAttrId = newAttr.id;

            if(algo.algoName === 'keywords') {
                assert(keywordAlgoObj, 'keywordAlgoObj should be correctly extracted');
                var ngramAttr = new DSModel.AttrDescriptor(newAttr.id + '-ngrams', newAttr.title + "-ngrams", 'liststring', 'Alchemy.' + algo.title, null, null, true);
                dataset.attrDescriptors.push(ngramAttr);
                algo.newAttrId_ngram = ngramAttr.id;
            }
        });

        return dataset;
    }).then(function processDataset(dataset) {
        // Create a new task and return the id
        var newTask = JobTracker.create("AlchemyAPI_" + dataset.id);
        newTaskId = newTask.id;
        // send early response
        res.status(200).json(newTask);

        var attrDescr = _.find(dataset.attrDescriptors, 'id', queryAttrId);
        var nodesToProcess = _.filter(dataset.datapoints, function(datapoint) {
            var val = datapoint.attr[queryAttrId];
            return !!val && val.length > 4; // has to have some text
        });
        increment = 90.00/Math.max(nodesToProcess.length, 1); // want to stop at 90
        if(nodesToProcess.length != dataset.datapoints.length)
            console.log("" + (dataset.datapoints.length - nodesToProcess.length) + " nodes don't have the attribute");

        var msgFormat = "Ignored : " + (dataset.datapoints.length - nodesToProcess.length) + ", Currently: %d" + " of " + nodesToProcess.length;
        //
        // start processing
        //
        var onProcessingFinished = Promise.map(nodesToProcess, function(datapoint, dpIdx) {
            return AlchemyAPI.runAlchemyAlgo(_getDPValToProcess(datapoint.attr[queryAttrId], attrDescr.attrType), relevance, algosToRun)
            .then(function(enhancedData) {
                if(keywordAlgoObj) {
                    datapoint.attr[keywordAlgoObj.newAttrId_ngram] = enhancedData.keyword_ngrams;
                }

                _.each(selectedAlgos, function(selectedAlgo) {
                    datapoint.attr[selectedAlgo.newAttrId] = enhancedData[selectedAlgo.algoName];
                });
                console.log(logPrefix + "TaskId: " + newTaskId + " Running :", dpIdx);
                return true;
            })
            // Catch errors and return resolved promise, because we want to pull in data whether
            // alchemy fails for a value or not.
            .catch(
                function AlchemyAPIErr(err) {
                    return err.status === "ERROR";
                },function(err) {
                    console.log("Alchemy failed on datapoint: " + datapoint.id);
                    console.log(err);
                    return true;
                })
            // progress monitoring
            .tap(function() {
                if(JobTracker.isUpdatable(newTaskId)) {
                    JobTracker.update(newTaskId, "running", {
                        msg : util.format(msgFormat, (dpIdx + 1))
                    }, increment);
                } else {
                    console.log("Import cancelled by user");
                    throw new Error('Task cancelled by user');
                }
            });
        });
        // return dataset once all the nodes have been processed
        return onProcessingFinished.thenReturn(dataset);
    });
    // Alchemy Processing has finished, time to save Ds
    datasetP.then(function(dataset) {
        if(JobTracker.isUpdatable(newTaskId)) {
            JobTracker.update(newTaskId, "running", { msg : "Analysis done, saving data..." }, 5);
        }
        return DSModel.saveDataset(dataset, false);
    }).then(function(dataset) {
        console.log(logPrefix + "Alchemy Processing finished!");
        JobTracker.update(newTaskId, "completed", { datasetId : dataset.id }, 10);
    }).catch(function(err) {
        console.error(logPrefix + "Error in Importing. ", err);
        err = err.stack || err;
        if(JobTracker.isUpdatable(newTaskId)) {
            JobTracker.update(newTaskId, "failed", err);
        } else {
            JobTracker.remove(newTaskId);
            if(newTaskId == null) { // if no response has been sent, then send a 500
                res.status(500).send(err);
            }
        }
    });
}

//
// news Alchemy API
// user provides a query string. We run a get req on it and build the dataset
//

function importAlchemyNews (req, res) {
    var logPrefix = "[dataIngestionController.importAlchemyNews] ";
    var proj = req.project;

    var options = req.body.options;
    var optKeys = ['startDate', 'endDate', 'queryText', 'queryType', 'sentiment', 'taxonomyLabel', 'apiKey'];
    console.log(logPrefix + " Options: ", options);

    _.each(optKeys, function(key) {
        assert(options[key] != null, key + ' not present in the options');
    });

    var newTask = JobTracker.create("AlchemyAPI" + _.uniqueId('_alchemy_news_')),
        newTaskId = newTask.id;
    res.status(200).json(newTask);
    // options.useDummy = true;
    AlchemyAPI.fetchNewsData(options)
    .then(function generateDataset(datapointObjs) {
        if(JobTracker.isUpdatable(newTaskId)) { JobTracker.update(newTaskId,'notification', "Fetched news form alchemy", 50); }

        console.log("Num of datapoints: " + datapointObjs.length);
        // build node attrs
        var attrDescriptors = [];
        attrDescriptors.push(new DSModel.AttrDescriptor('title', 'title', 'string', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('DataPointLabel', 'DataPointLabel', 'string', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('documentId', 'documentId', 'string', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('image', 'image', 'picture', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('author', 'author', 'string', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('text', 'text', 'string', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('sentiment', 'sentiment', 'float', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('date', 'date', 'timestamp', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('keywords', 'keywords', 'liststring', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('keyword_ngrams', 'keyword_ngrams', 'liststring', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('entities', 'entities', 'liststring', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('concepts', 'concepts', 'liststring', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('taxonomy', 'taxonomy', 'liststring', 'AlchemyNewsAPI', null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('url', 'url', 'url', 'AlchemyNewsAPI', null, null, true));

        var attrIds = ['documentId','title', 'image', 'author', 'text', 'sentiment', 'date', 'keywords', 'keyword_ngrams', 'entities', 'concepts', 'taxonomy', 'url'];
        // build datapoints
        var datapoints = _.map(datapointObjs, function(dp) {
            _.each(attrIds, function (attrId) {
                if(dp.attr[attrId] == null || (_.isArray(dp.attr[attrId]) && dp.attr[attrId].length == 0)) {
                    delete dp.attr[attrId];
                }
            });
            return new DSModel.DataPoint(dp.id, dp.attr);
        });
        var dataset = DSModel.createDataset(proj.id, 'dataset', datapoints, attrDescriptors, {
            options: options
        }, false);
        return dataset;
    })
    .then(function saveData(dataset) {
        if(JobTracker.isUpdatable(newTaskId)) { JobTracker.update(newTaskId,'notification', "Built dataset saving...", 25); }
        return DSModel.saveDataset(dataset, proj.id);
    })
    .then(function updateProjectdetails(dataset) {
        if(JobTracker.isUpdatable(newTaskId)) { JobTracker.update(newTaskId,'notification', "Saved dataset into DB: " + dataset.id, 5); }
        return projModel.updateDatasetAsync(proj, dataset).thenReturn(dataset);
    })
    .then(function sendResult(dataset) {
        JobTracker.update(newTaskId, "completed", { datasetId : dataset.id }, 20);
        return null;
    })
    .catch(function(err) {
        console.error(logPrefix + "Error in Parsing News. ", err);
        err = err.stack || err;
        console.error(logPrefix + "Error in Parsing News. ", err);
        if(JobTracker.isUpdatable(newTaskId)) {
            JobTracker.update(newTaskId, "failed", err);
        }
    });
}

function importFromES (req, res) {
    var logPrefix = "[dataIngestionController.importFromES] ";
    var proj = req.project,
        options = req.body.options,
        queryText = req.body.queryText;

    // var ATTR_IDS = [ 'email', 'firstname', 'lastname', 'gender', 'account_number', 'address', 'age', 'balance', 'employer', 'state', 'city' ];
    var esClient = new elasticsearch.Client({
        host: 'search-smoke-gc7ayrhsjef6qxldy7k4jcwyqm.us-west-1.es.amazonaws.com',
        log: 'error'
    });
    var sq = ES_Search._getSearchQuery(queryText, []);

    esClient.search({
        index: 'cb',
        type: 'org',
        size: 2000, //arbitrary large number to set the max number of search returns
        body: {
            query: sq.queryObj
        }
    }).then(function(resp) {
        var hits = resp.hits;
        if(hits.total > 0) {
            return hits_to_dataset(hits);
        } else {
            return Promise.reject(new Error("No records found"));
        }
    })
    .then(dataset => DSModel.saveDataset(dataset, proj.id))
    .then(dataset => projModel.updateDatasetAsync(proj, dataset).thenReturn(dataset))
    .then(function sendResult(dataset) {
        res.status(200).json({ datasetId : dataset.id });
    })
    .catch(function(err) {
        console.error(logPrefix + "Error in Parsing News. ", err);
        err = err.stack || err;
        res.status(500).send(err);
    });

    function hits_to_dataset(hits) {
        console.log("Num of hits: " + hits.total);
        // build node attrs
        var attrDescriptors = [];
        attrDescriptors.push(new DSModel.AttrDescriptor('crunchbase_url', 'crunchbase_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('crunchbase_uuid', 'crunchbase_uuid', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('facebook_url', 'facebook_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('funding_round_name', 'funding_round_name', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('homepage_domain', 'homepage_domain', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('homepage_url', 'homepage_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('linkedin_url', 'linkedin_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('location_city', 'location_city', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('location_country_code', 'location_country_code', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('location_region', 'location_region', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('name', 'name', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('primary_role', 'primary_role', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('profile_image_url', 'profile_image_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('short_description', 'short_description', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('stock_symbol', 'stock_symbol', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('twitter_url', 'twitter_url', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('type', 'type', 'string', 'ES_Search', null, null, null, true));
        attrDescriptors.push(new DSModel.AttrDescriptor('DataPointLabel', 'DataPointLabel', 'string', 'ES_Search', null, null, true));
        // build datapoints
        var datapoints = _.map(hits.hits, rec_to_datapoint);
        var dataset = DSModel.createDataset(proj.id, 'dataset', datapoints, attrDescriptors, {
            options: options
        }, false);
        return dataset;
    }

    function rec_to_datapoint(record) {
        var dp = new DSModel.DataPoint(record._id, record._source);
        dp.attr.DataPointLabel = record._source.name;
        return dp;
    }
}

//
// Merge network data
//

function mergeNetworkData  (req, res) {
    var logPrefix = "[dataIngestionController.mergeNetworkData] ";
    // User provides the cacheId to use for merge
    var cacheId = req.body.dataId;
    var networkId = req.body.networkId;
    assert(cacheId, logPrefix + "dataId should exist in request");
    assert(NetworkDataCache.isKeyValid(cacheId), logPrefix + "dataId should exist in NetworkDataCache");
    assert(networkId, logPrefix + "Network id not given");

    assert(req.body.globalAttrOpts, "globalAttrOpts object should exist!");
    assert(req.body.localAttrOpts, "localAttrOpts object should exist!");
    // load dataset
    var datasetP = DSModel.readDataset(req.project.dataset.ref, false);
    var networkP = DSModel.readNetwork(networkId, false, false);
    // load dataset to Merge from network data. This data contains combined data
    var datasetToMergeP = NetworkDataCache.getNetworkDataFromCache(cacheId);

    Promise.join(datasetP, networkP, datasetToMergeP, function(dataset, network, graphData) {

        // assert(attrIds_toUpdate.length > 0, "AttrIds to update should be given in the request");
        // assert(attrIds_toAdd.length > 0, "AttrIds to add should be given in the request");
        // assert(attrIds_toPreserve.length > 0, "AttrIds to preserve should be given in the request");
        var globalAttrOpts = req.body.globalAttrOpts,
            localAttrOpts = req.body.localAttrOpts;
        return [dataset, network, DataMerge.mergeGraphData(dataset, network, graphData, globalAttrOpts, localAttrOpts)];
    })
    .spread(function(dataset, network, mergeResults) { //save data
        console.log(logPrefix + "Merge Successful. Results: ", mergeResults);
        // var file = dataUtils.generateXLSXFromGraph(dataset, networks, _.noop);
        return Promise.join(DSModel.updateDataset(dataset), DSModel.updateNetwork(network), function() {
            return mergeResults;
        });
    })
    .then(function(mergeResults) {
        console.log(logPrefix + "Merged Dataset and network saved. Id: ", mergeResults);
        res.status(200).send({
            datasetResults : mergeResults.datasetMergeResults.getResults(),
            networkResults : mergeResults.networkMergeResults.getResults()
        });
    })
    .catch(function(err) {
        console.error(logPrefix + "Error in Importing. ", err);
        err = err.stack || err;
        res.status(500).send(err);
    });
}

function mergeStats(req, res) {
    var logPrefix = "[dataIngestionController.mergeStats] ";
    // User provides the cacheId to use for merge
    var cacheId = req.body.dataId;
    var networkId = req.body.networkId;
    assert(cacheId, logPrefix + "dataId should exist in request");
    assert(NetworkDataCache.isKeyValid(cacheId), logPrefix + "dataId should exist in NetworkDataCache");
    assert(networkId, logPrefix + "Network id not given");
    // load dataset
    var datasetP = DSModel.readDataset(req.project.dataset.ref, false);
    var networkP = DSModel.readNetwork(networkId, false, false);
    // load dataset to Merge from network data. This data contains combined data
    var datasetToMergeP = NetworkDataCache.getNetworkDataFromCache(cacheId);

    Promise.join(datasetP, networkP, datasetToMergeP, function(dataset, network, graphData) {

        var datasetAttrIds = _.pluck(dataset.attrDescriptors, 'id'),
            gdAttrIds = _.pluck(graphData.dataset.attrDescriptors,'id');
        var networkIds = _.pluck(network.nodeAttrDescriptors, 'id'),
            gdNwAttrIds = _.pluck(graphData.networks[0].nodeAttrDescriptors,'id');

        if(!_.contains(gdNwAttrIds, 'OriginalX')) gdNwAttrIds.push('OriginalX');
        if(!_.contains(gdNwAttrIds, 'OriginalY')) gdNwAttrIds.push('OriginalY');
        if(!_.contains(gdNwAttrIds, 'OriginalSize')) gdNwAttrIds.push('OriginalSize');
        if(!_.contains(gdNwAttrIds, 'OriginalLabel')) gdNwAttrIds.push('OriginalLabel');
        if(!_.contains(gdNwAttrIds, 'OriginalColor')) gdNwAttrIds.push('OriginalColor');

        var globalAttrOpts = {
            toUpdate : _.intersection(datasetAttrIds, gdAttrIds),
            toRemove : [],
            toAdd : []
        };

        var localAttrOpts = {
            toUpdate : _.intersection(networkIds, gdAttrIds.concat(gdNwAttrIds)), // network attr can be anywhere!
            toRemove : [],
            toAdd : _.difference(gdAttrIds.concat(gdNwAttrIds),
                        networkIds, datasetAttrIds, // anything which isn't going to be updated!
                        ["DataPointLabel", "DataPointColor"])  // they should only be in dataset
        };
        var dpMap = _.indexBy(dataset.datapoints, 'id');
        var nwNodesDpIds = _.map(network.nodes, 'dataPointId');
        var attrCounts = {
            ds : getAttrCounts(_.values(_.pick(dpMap, nwNodesDpIds))),
            nw : getAttrCounts(network.nodes),
            gdDs : getAttrCounts(graphData.dataset.datapoints),
            gdNw : getAttrCounts(graphData.networks[0].nodes)
        };
        return [attrCounts, DataMerge.mergeGraphData(dataset, network, graphData, globalAttrOpts, localAttrOpts)];
    })
    // .spread(function(attrCounts, mergeResults) { //save data
    //     console.log(logPrefix + "Merge Successful. Results: ", mergeResults);
    //     // var file = dataUtils.generateNetworksXLSX(dataset, [network], _.noop);
    //     mergeResults.attrCounts = attrCounts;
    //     return mergeResults;
    // })
    .spread(function(attrCounts, mergeResults) {
        console.log(logPrefix + "Merged Dataset and network stats generated:", mergeResults);
        res.status(200).send({
            datasetResults : mergeResults.datasetMergeResults.getResults(),
            networkResults : mergeResults.networkMergeResults.getResults(),
            attrCounts : attrCounts
        });
    })
    .catch(function(err) {
        console.error(logPrefix + "Error in Importing. ", err);
        err = err.stack || err;
        res.status(500).send(err);
    });
}

function getAttrCounts (entities) {
    var attrCounts = {};
    _.each(entities, function(en) {
        _.each(en.attr, function(val, attrId) {
            attrCounts[attrId] = attrCounts[attrId] != null ? attrCounts[attrId] + 1 : 1;
        });
    });
    return attrCounts;
}

function _getDPValToProcess(dpVal, attrType) {
    if(attrType === 'liststring') {
        assert(_.isArray(dpVal), "Datapoint value for liststring needs to be array"); //Is stored as array for now
        return dpVal.join(", ");
    }
    return dpVal;
}

//API
module.exports = {
    genLinkedInAuthUrl     : genLinkedInAuthUrl,
    onLinkedInCallback     : onLinkedInCallback,
    importLinkedInContent  : importLinkedInContent,
    importImportIO         : importImportIO,
    runAlchemy             : runAlchemy,
    importAlchemyNews : importAlchemyNews,
    importFromES :importFromES,
    mergeNetworkData       : mergeNetworkData,
    mergeStats              : mergeStats
};
