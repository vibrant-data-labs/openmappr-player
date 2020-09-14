'use strict';

var	expect = require('chai').expect,
	_ = require('lodash'),
    fs = require('fs'),
    querystring = require('querystring'),
    Promise = require("bluebird");

var AlchemyAPI = require("../../server/services/AlchemyAPI.js");

describe('AlchemyAPI @alchemy', function(){
    this.timeout(500000);
    var text = "The IIIT-H Foundation manages over 30,000 sft of space that consists of a co-working space and Incubator known as the Centre for Innovation and Entrepreneurship (CIE) on the IIIT-H campus. CIE is one of the largest Incubators in India, with over 50 startups under its roof.";
    describe('#runAlchemyAlgo()', function(){
        it('should return keywords and keyword_ngrams from a piece of text', function(done){
            var algos =  ['keywords'];
            AlchemyAPI.runAlchemyAlgo(text, 0.7, algos)
            .then(function(entities) {
                // console.log(entities);
                expect(_.keys(entities)).to.be.deep.equal(algos.concat('keyword_ngrams'));
                return null;
            }).then(done, done);
        });
    });

    describe('#runAlchemyAlgo()', function(){
        it('should return keywords, concepts, sentiments and entities from a piece of text', function(done){
            var algos =  ['concepts', 'keywords', 'entities', 'sentiment'];
            AlchemyAPI.runAlchemyAlgo(text, 0.7, algos)
            .then(function(entities) {
                //console.log(entities);
                expect(_.keys(entities)).to.be.deep.equal(algos.concat('keyword_ngrams'));
                return null;
            }).then(done, done);
        });
    });
});
