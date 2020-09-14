'use strict';
var Promise = require('bluebird'),
    _           = require('lodash'),
    dataUtils      = require("../utils/dataUtils");
var xlsx = require('xlsx');
var xls = require('xlsjs');
var csv = require('csv-parser');

function getSheetWithMatches(req, res) {
    var fileName = req.files && req.files[0].originalname || 'Result',
        filePath = req.files[0].path;

    _getDataset(fileName, filePath)
    .then(dataset => {
        var processedDS = _findMatches(dataset);
        dataset.attrDescriptors.splice(1, 0, {
            id: 'Top_Matches',
            title: 'Top_Matches',
            attrType: 'ListString'
        });
        dataset.attrDescriptors.splice(2, 0, {
            id: 'MatchCount',
            title: 'MatchCount',
            attrType: 'Integer'
        });
        dataUtils.generateDatasetXLSX(processedDS, fileName, data => {
            res.status(200).send(data);
        });
    })
    .catch(err => {
        console.error('Sheet processing failed:', err);
        res.status(500).send(err);
    });
}

function getCleanSheet(req, res) {
    var fileName = req.files && req.files[0].originalname || 'Result',
        filePath = req.files[0].path;

    _getDataset(fileName, filePath)
    .then(dataset => {
        var processedDS = _cleanDataset(dataset);

        dataUtils.generateDatasetXLSX(processedDS, fileName, data => {
            res.status(200).send(data);
        });
    })
    .catch(err => {
        console.error('Sheet processing failed:', err);
        res.status(500).send(err);
    });
}

function _findMatches(dataset) {
    var datapointsIdx = _.indexBy(dataset.datapoints, 'id');
    var needsAttr = 'Needs',
        offeringsAttr = 'Offerings',
        specializationsAttr = 'Specializations';

    _.each(dataset.datapoints, dp => {
        var dpNeeds = dp[needsAttr],
            resourceMatchList = [],
            specializationMatchList = [];

        _.each(dataset.datapoints, cdp => {
            var resourcesMatch = _.intersection(dpNeeds, cdp[offeringsAttr]);
            if(cdp.id == dp.id) { return; }
            if(resourcesMatch.length > 0) {
                resourceMatchList.push({
                    resourcesMatched: resourcesMatch,
                    id: cdp.id,
                    matchCount: resourcesMatch.length
                });
            }
        });

        var matchesSortedByMaxResources = _.sortBy(resourceMatchList, 'matchCount').reverse();
        var topMatches = _.take(matchesSortedByMaxResources, 6);

        _.each(topMatches, match => {
            var interestsMatch = _.intersection(dp[specializationsAttr], datapointsIdx[match.id][specializationsAttr]);
            specializationMatchList.push({
                interestsMatched: interestsMatch,
                id: match.id,
                matchCount: interestsMatch.length
            });
        });

        var matchesSortedByMaxSpecialization = _.sortBy(specializationMatchList, 'matchCount').reverse();
        var finalMatches = _.take(matchesSortedByMaxSpecialization, 3);
        dp.Top_Matches = _.map(finalMatches, match => datapointsIdx[match.id]['label']).join(' | ');

        _.each(finalMatches, match => {
            var matchedDp = datapointsIdx[match.id];
            if(matchedDp.MatchCount == null) {
                matchedDp.MatchCount = 1;
            }
            else {
                matchedDp.MatchCount += 1;
            }
        });
    });
    return dataset;
}

function _cleanDataset(dataset) {
    var attrsToBeCleaned = [
        {
            id: 'Specializations',
            title: 'What are your areas of specialization?'
        },
        {
            id: 'Offerings',
            title: 'What resources can you offer to the community?'
        },
        {
            id: 'Needs',
            title: 'What resources do you need from the community in order to pursue your current goals?'
        },
        {
            id: 'Motivations',
            title: 'What motivates your work?'
        }
    ];
    var attrValMap = {};

    dataset.attrDescriptors = _.reduce(dataset.attrDescriptors, (result, attr) => {
        var attrMatch = _.find(attrsToBeCleaned, attrToBeCleaned => {
            return new RegExp(attrToBeCleaned.title).test(attr.id);
        });
        var attrTitle, attrVal;

        if(attrMatch) {
            attrTitle = attrMatch.title;
            attrVal = (_.trim(attr.id.replace(attrTitle, ""))).replace(/[\[\]']+/g,'');

            attrValMap[attr.id] = {
                attrTitle: attrTitle,
                attrId: attrMatch.id,
                val: attrVal
            };

            if(!_.find(result, 'id', attrMatch.id)) {
                var attrClone = _.clone(attr);
                attrClone.id = attrMatch.id;
                attrClone.title = attrMatch.id;
                attrClone.attrType = 'liststring';
                result.push(attrClone);
            }
        }
        else {
            result.push(attr);
        }

        return result;
    }, []);

    _.each(dataset.datapoints, dp => {
        _.forOwn(attrValMap, (attrInfo, valKeyCombo) => {
            if(dp[valKeyCombo] == 1) {
                if(dp[attrInfo.attrId] == null) {
                    dp[attrInfo.attrId] = [attrInfo.val];
                }
                else {
                    dp[attrInfo.attrId].push(attrInfo.val);
                }
                delete dp[valKeyCombo];
            }
        });
    });


    return dataset;
}

function _getDataset(fileName, filePath) {
    var nameArr = fileName.split('.'),
        ext = (nameArr[nameArr.length-1]).toUpperCase(),
        parseFn = _.noop;

    if(ext == 'XLSX' || ext == 'XLS') {
        parseFn = dataUtils.gen_sheet_js_excel;
    }
    else if(ext == 'CSV') {
        parseFn = dataUtils.gen_sheet_js_csv;
    }

    var workbook = xlsx.readFile(filePath);

    var sheet_name_list = workbook.SheetNames;
    return new Promise((resolve, reject) => {
        var parsedData = parseFn(workbook, sheet_name_list[0]);
        parsedData.datapoints = parsedData.entities;
        parsedData.attrDescriptors = parsedData.attrs;
        delete parsedData.entities;
        delete parsedData.attrs;
        resolve(parsedData);
    });
}

module.exports = {
    getSheetWithMatches,
    getCleanSheet
};