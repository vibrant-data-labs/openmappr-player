'use strict';

var expect = require('chai').expect,
    _ = require('lodash'),
    fs = require('fs'),
    Promise = require("bluebird"),
    url = require('url'),
    mm = require('micromatch'),
    ObjectID = require('mongodb').ObjectID;

var UploadAPI = require("../../server/services/UploadAPI");

var pattern = 's3://recipe-test/privacy_dataset/**/April*.xlsx';

// create / update / read / delete tests
describe('datasource globbing @srcglob', function() {
    this.timeout(50000);
    var urlInfo = url.parse(pattern);
    var globInfo = mm.expand(urlInfo.path.slice(1));
    //
    // test whether globbing works
    //
    describe('#check if globbing works()', function() {
        it('should match files correctly', function() {
            var keys = [
                'privacy_dataset/',
                'privacy_dataset/April_Privacy_Dataset_A_G.xlsx',
                'privacy_dataset/April_Privacy_Dataset_Australia.xlsx',
                'privacy_dataset/April_Privacy_Dataset_H_M.xlsx',
                'privacy_dataset/recur_test/',
                'privacy_dataset/recur_test/April_Privacy_Dataset_N.xlsx'
            ];

            console.log("Pattern : ", globInfo.orig);
            console.log("Matched values: ", mm(keys, globInfo.orig));

        });
        it('it should correctly get files', function(done) {
            var client = UploadAPI.getClient();
            console.log("[GLOB_INFO] globinfo:", globInfo);
            var obj = {
                s3Params: {
                    Bucket: urlInfo.host,
                    Prefix: globInfo.tokens.base + '/'
                }
            };
            console.log("[gen_dataSource] options: ", obj);

            var finder = client.listObjects(obj);

            finder.on('data', function(awsData) {
                // console.log("[gen_dataSource] Got data: ", awsData.Contents);
                var keys = awsData.Contents.map(x => x.Key);
                console.log("[gen_dataSource] Keys: ", keys);
                console.log("Matched values: ", mm(keys, globInfo.orig));
            });

            finder.on('error', function(err) {
                console.error("[gen_dataSource] Unable to download:", err);
                done(err);
            });

            finder.on('end', function() {
                console.log("[gen_dataSource] Ended");
                done();
            });
        });
    });
});
