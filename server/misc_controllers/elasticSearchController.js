'use strict';

var DSModel = require('../datasys/datasys_model'),
    projModel = require("../project/proj_model"),
    elasticSearchService = require('../services/elasticsearch'),
    logPrefix = '[elasticSearchController] ';

module.exports = {
    pingSearchServer: function(req, res) {
        elasticSearchService.ping(function(err, result) {
            if (err) {
                console.error(logPrefix + "pingSearchServer : elasticsearch not responding", err);
                return res.status(500).json(result);
            } else {
                console.log(logPrefix + "pingSearchServer : hello elasticsearch");
                return res.status(200).json(result);
            }
        });
    },

    //56b673780a4586b112c925bb potato
    searchSanityCheck: function(req, res) {
        var dataSetId = '56b673780a4586b112c925bb',
            query = 'potato',
            expectedCount = 1;

        //console.log(logPrefix + "searchSanityCheck : querying data from elasticsearch", dataSetId, query);
        elasticSearchService.sanitycheck(dataSetId, query, function(err, result) {
            if (err) {
                console.error(logPrefix + "searchSanityCheck : error occured in elasticsearch", err);
                return res.status(500).json(err);
            } else {
                console.log(logPrefix + "searchSanityCheck : success(" + result.total + "/" + expectedCount + ")");
                return res.status(200).json(result);
            }
        });
    },

    //56966c5e9c4412e665af91e5
    searchTerm: function(req, res) {
        console.log(req.params);
        var dataSetId = req.params.dsid,
            query = req.params.queryterm,
            filterAttrIds = [];
        console.log(logPrefix + "searchNodes : querying data from elasticsearch", dataSetId, query);

        if (!dataSetId || !query) {
            console.log(logPrefix + "searchNodes : invalid request");
            return res.status(500).json({
                "error": "invalid request. please specify dataSetId and query in query params"
            });
        } else {
            elasticSearchService.find(dataSetId.toString(), query.toString(), filterAttrIds, function(err, result) {
                if (err) {
                    console.error(logPrefix + "searchNodes : error occured in elasticsearch for query " + query.toString(), err);
                    return res.status(500).json(err);
                } else {
                    console.log(logPrefix + "searchNodes : fetched data from elasticsearch");
                    return res.status(200).json(result);
                }
            });
        }
    },

    searchNodes: function(req, res) {
        var p = req.body,
            dataSetId = p.dataSetId,
            query = p.query,
            filterAttrIds = p.filterAttrIds || [];
        console.log(logPrefix + "searchNodes : querying data from elasticsearch", dataSetId, query);

        if (!dataSetId || !query) {
            console.log(logPrefix + "searchNodes : invalid request");
            return res.status(500).json({
                "error": "invalid request. please specify dataSetId and query in query params"
            });
        } else {
            elasticSearchService.find(dataSetId.toString(), query.toString(), filterAttrIds, function(err, result) {
                if (err) {
                    console.error(logPrefix + "searchNodes : error occured in elasticsearch for query " + query.toString(), err);
                    return res.status(500).json(err);
                } else {
                    console.log(logPrefix + "searchNodes : fetched data from elasticsearch");
                    return res.status(200).json(result);
                }
            });
        }
    },

    reIndexDataset: function(req, res) {
        projModel.listById(req.params.pid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: project not found: ", err);
            }
            if (!docs || !docs._id) {
                console.log(logPrefix + 'Project [id: ' + req.params.pid + '] not found!');
                res.status(404).send("Error: Project not found");
            } else {
                console.log(logPrefix + 'Project [id: ' + req.project._id + '] found!');
                var proj = docs;
                if (proj.dataset && proj.dataset.ref) {
                    var dsId = proj.dataset.ref;
                    DSModel.readDataset(dsId)
                        .then(function(dataset) {
                            elasticSearchService.storeDataSet(dataset.id, dataset.attrDescriptors, dataset.datapoints, function(err) {
                                if (err) {
                                    console.warn(logPrefix + "reIndexDataset : error storing data to elasticsearch", err);
                                    return res.status(400).json(err.stack || err);
                                }
                                console.log(logPrefix + "reIndexDataset : successfully stored data to elasticsearch");
                                res.status(200).json({
                                    datasetId: dsId,
                                    result: "successfully index dataset"
                                });
                            });
                        });
                } else {
                    res.status(400).json({
                        result: "unable to locate project dataset"
                    });
                }
            }
        });
    }
};
