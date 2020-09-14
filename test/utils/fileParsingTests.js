'use strict';

var dataUtils = require("../../server/utils/dataUtils.js");
var	expect = require('chai').expect,
    color = require('onecolor'),
	_ = require('lodash'),
    Promise = require('bluebird'),
    fs = require("fs");

describe('#DataUtils @parse', function(){
    describe('can parse files', function(){
        it('should parse xlsx files', function(done){
            var files = ["./test/data/Chicago_Public_Schools___Elementary_School_Progress_Report_Card__2012-2013_.xls",
            "./test/data/My-Animals-missingvals.xlsx",
            "./test/data/Retailer_Ecosystem.xls"];

            Promise.map(files, file => {
                var parseFn = dataUtils.getFileParser(file);
                return parseFn(file)
                .then(function(result) {
                    // console.log(result);
                    return null;
                });
            }).then(done, done);
        });
        it('can parse csv file', function (done) {
            var filePath = "./test/data/slice_sample_gen.csv";
            var parseFn = dataUtils.getFileParser(filePath);
            parseFn(filePath)
            .then(function(result) {
                // console.log(result);
                done();
            });
        });
    });
});
