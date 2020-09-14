'use strict';
var
    fs = require('fs'),
    util = require('util'),
    Promise = require('bluebird'),
    assert = require('assert'),
    request  = require('request'),
    querystring = require('querystring'),
    EventEmitter = require('events'),
    process = require('process'),
    generateShortUID6 = require('../services/UIDUtils').generateShortUID6,
    _ = require('lodash');

var AlchemyLib = require("../libs/alchemyapi.js");

var _alchemyInst = new AlchemyLib();


var _runAlchemyAlgoHelper = {
    "keywords" : _getKeywordsForText,
    "concepts": _getConceptsForText,
    "entities" : _getEntitiesForText,
    "sentiment": _getSentimentForText,
    "combined" : _getMultipleValsForText
};

var algoFeatureNameMap = {
    'keywords': {
        reqKey: 'keyword',
        resKey: 'keywords'
    },
    'concepts': {
        reqKey: 'concept',
        resKey: 'concepts'
    },
    'entities': {
        reqKey: 'entity',
        resKey: 'entities'
    },
    'sentiment': {
        reqKey: 'doc-sentiment',
        resKey: 'docSentiment'
    },
    'taxonomies': {
        reqKey: 'taxonomy',
        resKey: 'taxonomies'
    }
};

var PARALLEL_JOBS = 5;

/**
 * Alchemy Engine enforces a parallel limit of `PARALLEL_JOBS` queries hitting alchemy website, globally.
 * Should extract this into a pattern
 */
function AlchemyEngine () {
    EventEmitter.call(this);
    this.queue = [];
    this.isRunning = false;
    this.runners = 0;
}
AlchemyEngine.prototype.run_query = function(_text, relevance, algos) {
    var id = 'alchemy_' + generateShortUID6();
    var self = this;
    assert(_.isString(_text), "Can only run alchemy on text values");
    this.queue.push({id, _text, relevance, algos});
    console.log("Queue Size on run_query:", this.queue.length);
    var p =  new Promise(function (resolve, reject) {
        self.once(id, function (data) {
            // console.log("[AlchemyEngine] run_query: ", _.keys(data));
            resolve(data);
        });
        self.once(id + '.error', function (err) {
            reject(err);
        });
    });
    // start up the engine
    if(!this.isRunning) {
        // console.log("### Starting Queue execution");
        this._next();
    }
    return p;
};

AlchemyEngine.prototype._next = function() {
    if(this.runners >= PARALLEL_JOBS) {
        // console.log("[AlchemyEngine] Too many runners. skipping this run");
        return;
    }
    var jobs = _.take(this.queue, PARALLEL_JOBS - this.runners),
        self = this;

    if(jobs.length === 0) {
        this.isRunning = false;
        // console.log("### No jobs to run, halting machine");
        return;
    }
    this.runners += jobs.length;
    this.isRunning = true;
    this.queue.splice(0, jobs.length);

    // console.log("####");
    // console.log("Job Ids : ", _.map(jobs, 'id'));
    // console.log("Queue before _next.Promise:", _.map(self.queue, 'id'));
    // console.log("Runners before _next.Promise:", self.runners);
    // console.log("####");

    jobs.forEach(function (jobArgs) {
        // console.log('$$$ Running job: ' + jobArgs.id);
        _runAlchemyAlgo(jobArgs._text, jobArgs.relevance, jobArgs.algos)
            .then(function (data) {
                // console.log('$$$ Finished job: ' + jobArgs.id);
                self.emit(jobArgs.id, data);
                return true;
            })
            .catch(function (error) {
                self.emit(jobArgs.id + '.error', error);
                return true;
            })
            .finally(function () {
                self.runners-= 1;
                // console.log("####");
                // console.log("Queue after _next.Promise:", _.map(self.queue, 'id'));
                // console.log("Runners after _next.Promise:", self.runners);
                // console.log("####");
                process.nextTick(() => self._next());
            });
    });
    // continuing chewing up data if runners available
    if(this.runners < PARALLEL_JOBS) {
        process.nextTick(() => this._next());
    }
};

util.inherits(AlchemyEngine, EventEmitter);

var _engine = new AlchemyEngine();
var runAlchemyAlgo = _.bind(_engine.run_query, _engine);
//
// Alchemy Runner
// Text and relevance validation happens here
function _runAlchemyAlgo(_text, relevance, algos) {
    var fn = algos.length === 1
        ? _runAlchemyAlgoHelper[algos[0]]
        : _runAlchemyAlgoHelper['combined'];
    var text = _text;

    if(fn) {
        var rel = parseFloat(relevance);
        if(_.isNaN(rel)) {
            console.warn("[AlchemyAPI.runAlchemyAlgo]: relevance is NaN. setting to 0. Got :", relevance);
            rel = 0;
        }
        if(text.length === 0)
            return Promise.resolve([]);
        else if(isFinite(text))
            return Promise.resolve([]);
        else
            return fn(text, rel, algos);
    } else throw new Error("Alchemy Algo does not exist with us for algos: ", algos);
}

//
// n Gram Extractor
//
function cleanKeywords(tags) {
    var addTag = function(tgs, t, wt) {
        if( t.length > 2 && !_.has(tgs, t) ) {
            tgs[t] = wt;
        }
    };
    // expand bi- and trigrams, add unigrams and bigrams as needed
    // remove periods, make all lower case,
    // remove one and two letter unigrams

    var newTags = {};
    _.each(tags, function(tagwt) {
        var tag = tagwt[0];
        var wt = tagwt[1];
        tag = tag.replace(/\./g, '').toLowerCase();
        addTag(newTags, tag, wt);
        var parts = tag.split(" ");
        if(parts.length > 1) {
            for(var i = 0; i < parts.length; i++) {
                addTag(newTags, parts[i], wt);
                if(i < parts.length-1) {
                    addTag(newTags, parts[i] + ' ' + parts[i+1], 0.6*wt);
                }
            }
        }
    });
    //return _.filter(_.keys(newTags), function(tag) str => str.length > 2);
    newTags =  _.pairs(newTags);
    return newTags;
}


//
// Alchemy Funcs
//
function _getKeywordsForText(text, rel) {
    return new Promise(function(resolve, reject){
        _alchemyInst.keywords('text', text, {showSourceText : 1}, function(response) {
            if(response.status === "ERROR")
                reject(response);
            else resolve(response.keywords);
        });
    }).then(function(keywords) {
        // only keywords with relevance higher than given
        var result = {
//            keywords: _processTags(keywords, rel)
            keywords: _processWtdTags(keywords, rel)
        };
        result.keyword_ngrams = cleanKeywords(result.keywords);
        return result;
    });
}

function _getConceptsForText(text, rel) {
    return new Promise(function(resolve, reject){
        _alchemyInst.concepts('text', text, {showSourceText : 1}, function(response) {
            if(response.status === "ERROR")
                reject(response);
            else resolve(response.concepts);
        });
    }).then(function(concepts) {
        // only concepts with relevance higher than given
        return {
            concepts: _processTags(concepts, rel)
        };
    });
}

function _getEntitiesForText(text, rel) {
    return new Promise(function(resolve, reject){
        _alchemyInst.entities('text', text, { showSourceText : 1}, function(response) {
            if(response.status === "ERROR")
                reject(response);
            else resolve(response.entities);
        });
    }).then(function(entities) {
        // only entities with relevance higher than given
        return {
            entities: _processTags(entities, rel)
        };
    });
}

function _getSentimentForText(text, rel) {
    return new Promise(function(resolve, reject){
        _alchemyInst.sentiment('text', text, { showSourceText : 1}, function(response) {
            if(response.status === "ERROR")
                reject(response);
            else resolve(response.docSentiment);
        });
    }).then(function(sentiment) {
        // console.log('SENTIMENT: ', sentiment);
        // only entities with relevance higher than given
        return {
            sentiment: _processSentiment(sentiment)
        };
    });
}

function _getMultipleValsForText(text, rel, propsList) {
    var propsToExtract = [];

    _.each(propsList, function(algoName, key) {
        propsToExtract.push(algoFeatureNameMap[algoName].reqKey);
    });

    return new Promise(function(resolve, reject) {
        _alchemyInst.combined('text', text, { showSourceText : 1, extract: propsToExtract.join(',')}, function(response) {
            // console.log('--------------------', response);
            if(response.status === 'ERROR') {
                return reject(response);
            }
            else {
                var result = _.pick(response, _.map(_.pick(algoFeatureNameMap, propsList), 'resKey') );
                resolve(result);
            }
        });
    }).then(function(data) {
        var result = {};
        _.each(data, function(data, key) {
            // console.log(key)
            if(key === algoFeatureNameMap.sentiment.resKey) {
                result.sentiment = _processSentiment(data);
            }
            else {
                result[key] = _processTags(data, rel);
            }
        });
        if(result[algoFeatureNameMap.keywords.resKey]) {
            result.keyword_ngrams = cleanKeywords(result[algoFeatureNameMap.keywords.resKey]);
        }
        return result;
    });
}

function _processTags(entities, rel) {
    return _(entities)
        .filter(function(entity) { return parseFloat(entity.relevance) > rel; })
        //.tap(function(c) { console.log("Entities :", c);})
        .pluck('text')
        .uniq()
        .value();
}

function _processWtdTags(entities, rel) {
    entities = _(entities)
        .filter(function(entity) {return parseFloat(entity.relevance) > rel; })
        .uniq(false, function(entity) {return entity.text;})
        .map(function(entity) {return [entity.text, parseFloat(entity.relevance)];})
        .value();
    return entities;
}

function _processSentiment(sentiment) {
    if(sentiment.score != null) {
        return parseFloat(sentiment.score);
    }
    else {
        return 0;
    }
}

/// news API
///
var dataNeeded = [
    'enriched.url.image',
    'enriched.url.author',
    'enriched.url.title',
    'enriched.url.cleanedTitle',
    'enriched.url.url',
    'enriched.url.text',
    'enriched.url.enrichedTitle.taxonomy',
    'enriched.url.enrichedTitle.keywords.keyword.text',
    'enriched.url.enrichedTitle.keywords.keyword.relevance',
    'enriched.url.enrichedTitle.entities.entity.text',
    'enriched.url.enrichedTitle.entities.entity.relevance',
    'enriched.url.enrichedTitle.concepts.concept.text',
    'enriched.url.enrichedTitle.concepts.concept.relevance',
    'enriched.url.enrichedTitle.docSentiment.score'
].join(',');

function buildNewsQueryUrl(opts) {
    var valsToIgnore = ['any', 'anywhere'];

    var url = "https://access.alchemyapi.com/calls/data/GetNews?apikey=" + opts.apiKey +
        // "&return=enriched.url.image,enriched.url.author,enriched.url.title,enriched.url.enrichedTitle.keywords,enriched.url.enrichedTitle.entities,enriched.url.enrichedTitle.docSentiment,enriched.url.enrichedTitle.concepts,enriched.url.enrichedTitle.taxonomy" +
        "&return=" + dataNeeded +
        "&start=" + opts.startDate +
        "&end=" + opts.endDate +
        "&maxResults=" + opts.itemCount +
        "&outputMode=json";

    var ignoreQueryType = _.contains(valsToIgnore, opts.queryType.toLowerCase());
    var ignoreSentiment = _.contains(valsToIgnore, opts.sentiment.toLowerCase());
    var ignoreTaxonomy = _.contains(valsToIgnore, opts.taxonomyLabel.toLowerCase());

    var queryText = querystring.escape(opts.queryText);
    var queryType = querystring.escape(opts.queryType);
    var taxonomyLabel = querystring.escape(opts.taxonomyLabel);

    if(ignoreQueryType) {
        url += "&q.enriched.url.text=" + queryText;
    }
    else {
        url += "&q.enriched.url.enrichedTitle.entities.entity=|text=" + queryText + ",type=" + queryType + "|";
    }

    if(!ignoreSentiment) {
        url += "&q.enriched.url.enrichedTitle.docSentiment.type=" + opts.sentiment;
    }
    if(!ignoreTaxonomy) {
        url += "&q.enriched.url.enrichedTitle.taxonomy.taxonomy_.label=" + taxonomyLabel;
    }

    return url;
}

function fetchNewsData (opts) {
    var logPrefix = "[AlchemyAPI.fetchNewsData] ";
    var urlStr = buildNewsQueryUrl(opts);
    console.log(logPrefix + "URL: " + urlStr);

    var queryResp = null;
    if(opts.useDummy == true) {
        var body = fs.readFileSync('news_api_resp.json', {
            encoding : 'utf8'
        });
        var jsBody = JSON.parse(body);
        queryResp = Promise.resolve(processResponses(null, jsBody));
    } else {
        queryResp = new Promise(function (resolve, reject) {
            request.get(urlStr, function(err, response, body) {
                var jsBody = JSON.parse(body);
                if(err) {
                    reject(err);
                }
                else if(jsBody.result && _.isArray(jsBody.result.docs) && jsBody.result.docs.length > 0) {
                    // Make sure that nodes exist
                    // fs.writeFileSync('uploads_tmp/news_api_resp.json', body);
                    resolve(processResponses(err, jsBody));
                }
                else {
                    reject(jsBody);
                }
            });
        });
    }
    return queryResp;
}

function processResponses(err, jsBody) {
    var logPrefix = "[AlchemyAPI.fetchNewsData] ";
    // We have data! Build network data from it
    // console.log(logPrefix + 'Keys: ', _.keys(jsBody));
    // console.log(logPrefix + 'result Keys: ', _.keys(jsBody.result));
    console.log(logPrefix + "Got data. Total Transactions : ", jsBody.totalTransactions);
    console.log(logPrefix + "No of Records : ", jsBody.result.docs.length);
    console.log(logPrefix + "Next URL : ", jsBody.result.next);
    var dps = _.map(jsBody.result.docs, function function_name (data) {
        return __newsDocToDataPoint(true, data);
    });
    // fs.writeFileSync('uploads_tmp/datapoints.json',JSON.stringify(dps));
    return dps;
}

function __newsDocToDataPoint (inTitle, newsDoc) {

    //inspect(newsDoc);

    /** format
     *
     */
    var rawKeywords = inTitle ? _.get(newsDoc, 'source.enriched.url.enrichedTitle.keywords') : _.get(newsDoc, 'source.enriched.url.keywords');
    var keywords = _(rawKeywords)
                    .filter(function(kw) { return parseFloat(kw.relevance) > 0.2; })
                    .map('text')
                    .uniq()
                    .value();

    var rawEntities = inTitle ? _.get(newsDoc, 'source.enriched.url.enrichedTitle.entities') : _.get(newsDoc, 'source.enriched.url.entities');
    var entities = _(rawEntities)
                    .filter(function(en) { return parseFloat(en.relevance) > 0.2; })
                    .map('text')
                    .uniq()
                    .value();

    var rawConcepts = inTitle ? _.get(newsDoc, 'source.enriched.url.enrichedTitle.concepts') : _.get(newsDoc, 'source.enriched.url.concepts');
    var concepts = _(rawConcepts)
                    .filter(function(cn) { return parseFloat(cn.relevance) > 0.2; })
                    .map('text')
                    .uniq()
                    .value();

    var rawTaxonomy = inTitle ? _.get(newsDoc, 'source.enriched.url.enrichedTitle.taxonomy') : _.get(newsDoc, 'source.enriched.url.taxonomy');
    var taxonomy = _(rawTaxonomy)
                    .filter(function(tn) { return parseFloat(tn.score) > 0.1; })
                    .map('label')
                    .map(function(val) { return val.split('/'); })
                    .flatten()
                    .uniq()
                    .filter(function(tag) { return tag.length > 0; })
                    .value();

    var dpObj = {
        id : newsDoc.id,
        attr : {
            documentId : newsDoc.id,
            title : _.get(newsDoc, 'source.enriched.url.title', _.get(newsDoc, 'source.enriched.url.cleanedTitle', null)),
            image : _.get(newsDoc, 'source.enriched.url.image', null),
            author : _.get(newsDoc, 'source.enriched.url.author', null),
            text: _.get(newsDoc, 'source.enriched.url.text', null),
            url: _.get(newsDoc, 'source.enriched.url.url', null),
            sentiment : _.get(newsDoc, 'source.enriched.url.enrichedTitle.docSentiment.score', null),
            keywords : keywords,
            keyword_ngrams : cleanKeywords(keywords),
            entities : entities,
            concepts : concepts,
            taxonomy : taxonomy,
            date : newsDoc.timestamp
        }
    };
    if(dpObj.attr['title']) {
        dpObj.attr['DataPointLabel'] = dpObj.attr['title'];
    }
    return dpObj;
}

module.exports = {
    _getKeywordsForText : _getKeywordsForText,
    _getConceptsForText: _getConceptsForText,
    _getEntitiesForText : _getEntitiesForText,
    runAlchemyAlgo : runAlchemyAlgo,
    fetchNewsData : fetchNewsData
};
