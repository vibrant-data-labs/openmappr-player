'use strict';
// Service for using elasticsearch
// elasticSearchClient is defined in server.js

var Promise = require("bluebird");
var _ = require('lodash');

// globals
var elasticSearchClientFactory = null;
var logPrefix = '[elasticsearch: ] ';

//
var es_index = 'mappr_prod';

//
// Node attrs are in an array. To enable query using attr keys
// as search fields, the array needs to be flattened
//
function flattenNode(node) {
    var flattenedNode = node.attr;
    flattenedNode.type = 'datapoint';
    flattenedNode.id = node.id;
    return flattenedNode;
}

// function _log(str){
//     console.log(logPrefix + str);
// }
function _getSearchQuery(searchText, filterAttrIds) {

    // SANITIZE for forward and backslash
    searchText = searchText.replace(/\//g, "");
    searchText = searchText.replace(/\\/g, "");

    // OPERATOR
    var boolOperator;
    var useWildCard;
    if ((_.startsWith(searchText, "'") && _.endsWith(searchText, "'")) || (_.startsWith(searchText, '"') && _.endsWith(searchText, '"'))){
        boolOperator = "AND";
        useWildCard = false;
    } else {
        boolOperator = "OR";
        searchText += '*';
        useWildCard = true;
    }

    // fields
    var attrFields = (filterAttrIds.length > 0) ? filterAttrIds : ['_all'];

    var queryObj = {
        query_string: {
            query: searchText,
            analyzer: "custom_string_analyzer",
            analyze_wildcard: useWildCard,
            fields: attrFields,
            default_operator: boolOperator
        }
    };

    var highlightFields = (filterAttrIds.length > 0) ? _.map(filterAttrIds, function(atId){var ob = {}; ob[atId] = {type: "plain"}; return ob; }) : [{_all: {type: "plain"}}];

    var highlightObj = {
        pre_tags: ["<em>"],
        post_tags: ["</em>"],
        fields: highlightFields
    };

    // console.log(logPrefix + 'search query: ', JSON.stringify(queryObj));
    // console.log(logPrefix + 'highlight query: ', JSON.stringify(highlightObj));
    return {queryObj, highlightObj};
}

function createIndex (client) {
    return client.indices.exists({
        index: es_index
    })
    .then(function(resp) {
        if(!resp) {
            return client.indices.create({
                    index : es_index,
                    body : {
                        "settings": {
                            "index.mapping.single_type": false,
                            "analysis": {
                                "filter": {
                                    "my_en_stop": {
                                        "type": "stop",
                                        "stopwords": "_english_"
                                    }
                                },
                                "analyzer": {
                                    "custom_string_analyzer": {
                                        "filter": [
                                            "lowercase",
                                            "my_en_stop",
                                            "asciifolding",
                                            "snowball"
                                        ],
                                        "char_filter": [
                                            "html_strip",
                                            "my_spl_char_mapping"
                                        ],
                                        "type": "custom",
                                        "tokenizer": "whitespace"
                                    }
                                },
                                "char_filter": {
                                    "my_spl_char_mapping": {
                                        "type": "mapping",
                                        "mappings": [
                                            "&=>\\u0020and\\u0020",
                                            ":=>\\u0020",
                                            "'=>\\u0020",
                                            "?=>\\u0020",
                                            "/=>"
                                        ]
                                    }
                                }
                            }
                            // "number_of_shards": "1",
                            // "number_of_replicas": "1"
                        }
                }
            })
            .then(function(resp) {
                console.log(logPrefix, resp);
                return true;
            })
            .catch(function(err) {
                console.error(err);
                throw err;
            });
        } else {
            console.log(logPrefix, "index already exists");
            return true;
        }
    });
}

module.exports = {
    _getSearchQuery : _getSearchQuery,
    init: function(clientFactory) {
        elasticSearchClientFactory = clientFactory;
        return createIndex(elasticSearchClientFactory());
    },
    sanitycheck: function(dataSetId, query, callback){
        var dsId = dataSetId.toString != null ? dataSetId.toString() : dataSetId;
        var queryObj = {"wildcard":{"_all":query+'*'}};
        elasticSearchClientFactory().search({
            index: es_index,
            type: dsId,
            size: 2000, //arbitrary large number to set the max number of search returns
            body: {
                query: queryObj
            }
        }).then(function(resp) {
            var hits = resp.hits;
            callback(null, hits);
        }, function(err) {
            callback(err);
        });
    },

    find: function(dataSetId, query, filterAttrIds, callback) {
        var dsId = dataSetId.toString != null ? dataSetId.toString() : dataSetId;
        elasticSearchClientFactory().indices.existsType({
            index: es_index,
            type: dsId
        }, function(err, result) {
            if (err) {
                console.log(err);
                return callback(err);
            }
            if (!result) {
                console.error(logPrefix + "elasticsearch.find : type does not exist");
                return callback({
                    "error": "type does not exist"
                });
            }
            console.log(logPrefix + "elasticsearch.find : existsType ", result);

            var sq = _getSearchQuery(query, filterAttrIds);
            console.log(logPrefix + 'elasticsearch.find : search query => ', JSON.stringify(sq));
            elasticSearchClientFactory().search({
                index: es_index,
                type: dsId,
                size: 2000, //arbitrary large number to set the max number of search returns
                _source: ["id"],
                body: {
                    query: sq.queryObj,
                    highlight: sq.highlightObj
                }
            }).then(function(resp) {
                var hits = resp.hits;
                callback(null, hits);
            }, function(err) {
                callback(err);
            });
        });

    },

    index: function(document, callback) {
        
    },

    storeDataSet: function(dataSetId, attrList, nodeList, callback) {
        var dsId = dataSetId.toString != null ? dataSetId.toString() : dataSetId;
        // chunking data otherwise it becomes too large
        var nodeChunks = _.chunk(nodeList, 500);
        console.log(logPrefix + "Num of Chunks: ", nodeChunks.length);

        //create mappings for the type -> dataset_id from the attrs. reject non-string attrs.
        var props = {};
        _.each(attrList, function processAttrs(attr, index){
            switch (attr.attrType) {
            case "id":
                props[attr.id] = {type:"text", index: "true"};
                break;
            case "string":
                props[attr.id] = {type:"text", index: "true", analyzer: "custom_string_analyzer"};
                break;
            case "liststring":
                props[attr.id] = {type:"text", index: "true", analyzer: "custom_string_analyzer"};
                break;
            case "number":
            case "integer":
            case "float":
                //ignore numeric attrs for elastic search
                break;
            default:
                props[attr.id] = {type:"text", index: "true", analyzer: "custom_string_analyzer"};
            }
        });

        //create the mapping req body. add _all analyzer. important.
        var body = {};
        body[dsId] = {
            // _all:{
            //     type: "text",
            //     index: "true",
            //     analyzer: "custom_string_analyzer",
            //     store: true
            // },
            properties : props
        };

        console.log(logPrefix + "Putting mapping for type: " + dsId);
        console.log(body);

        elasticSearchClientFactory().indices.putMapping({index: es_index, type: dsId, body: body}, function(err, resp){
            if(err) console.log(err);
            else {
                console.log(logPrefix + "Type mapping done. ",resp);
                console.log(logPrefix + "building bulk requests for indexing nodes in ES");
                var onStore = Promise.map(nodeChunks, function processNodes(nodes, index) {
                    var bulkRequestBody = [];
                    _.each(nodes, function prepareBulkRequest(node, i) {
                        bulkRequestBody.push({
                            index: {
                                _index: es_index,
                                _type: dsId,
                                _id: i + 500 * index
                            }
                        });
                        //push only mapped attrs (strings and tags) + id;
                        var target_props = _.keys(props);
                        target_props.push('id');
                        bulkRequestBody.push(_.pick(flattenNode(node), target_props));
                    });

                    return Promise.fromNode(function(cb) {
                        elasticSearchClientFactory().bulk({
                            body: bulkRequestBody
                        }, cb);
                    }).tap(function() {
                        console.log(logPrefix+"Successfully indexed Chunk " + (index + 1) + '/' + nodeChunks.length);
                    });
                });
                onStore.tap(function() {
                    console.log(logPrefix+"Successfully indexed dataset: ", dataSetId);
                });
                return onStore.nodeify(callback);
            }
        });
    },

    ping: function(callback) {
        elasticSearchClientFactory().ping({
            // ping usually has a 3000ms timeout
            requestTimeout: Infinity,
            // undocumented params are appended to the query string
            hello: "elasticsearch!"
        }, function(error) {
            if (error) {
                callback(true, 'elasticsearch cluster is down!');
            } else {
                callback(false, 'hello from elasticsearch!');
            }
        });
    }
};
