'use strict';

var _ = require('lodash');
var db_old = require('../db_old.js');
var fs = require('fs');
var xlsx = require('xlsx');

function listAll(callback) {
    return db_old.surveyTemplate().find({}, function(err, docs) {
        if (err) {
            callback(err, false);
        } else {
            console.log('[surveyTemplateModel.listAll]' + docs.length);
            callback(null, docs);
        }
    });
}

function read(id, callback) {
    console.log('[surveyTemplate.readDoc] id:' + id);
    var counter = Date.now();
    return db_old.surveyTemplate().findOne({_id:id}, function(err, doc) {
        if (err) {
            console.log('[surveyTemplate.readDoc] Error: ' + err);
            callback(err, false);
        } else {
            console.log('[surveyTemplate.readDoc] Success: ', Date.now()-counter);
            //console.log(doc);
            callback(null, doc);
        }
    });
}

function readByOrg(orgId, callback) {
    console.log('[surveyTemplate.readByOrg] orgid:' + orgId);
    return db_old.surveyTemplate().find({"org.ref":orgId})
    .select({ isPublished: 1, isConcluded: 1 })
    .exec(function(err, doc) {
        if (err) {
            console.log('[surveyTemplate.readByOrg] Error: ' + err);
            callback(err, false);
        } else {
            console.log('[surveyTemplate.readByOrg] Success: ');
            callback(null, doc);
        }
    });
}

function add(newSurveyTemplate, callback) {
    var instance = new db_old.surveyTemplate()(newSurveyTemplate);

    //timestamp creation
    instance.dateCreated = Date.now();
    instance.dateModified = Date.now();

    instance.save(function(err, result) {
        if (err) {
            console.log('[surveyTemplateModel.add] Database Error: could not add new surveyTemplate');
            callback(err, false);
        } else {
            console.log('[surveyTemplateModel.add] Success saving surveyTemplate: ' + result.surveyName);
            callback(null, result);
        }
    });
}

function update(id, updateParams, callback) {
    console.log('[surveyTemplateModel.update] Updating surveyTemplate [id: ' + id + ']');
    console.log(updateParams);
    db_old.surveyTemplate().update({
        _id: id
    }, updateParams, {
        multi: false
    }, function(err, numberAffected, raw) {
        if (err) {
            console.log('[surveyTemplateModel.update] Error updating : ' + err);
            callback(err, false);
        } else {
            console.log('[surveyTemplateModel.update] The number of updated documents was %d', numberAffected);
            console.log('[surveyTemplateModel.update] [id:' + id + ']  The raw response from Mongo was: ', raw);
            callback(null, 'Success: surveyTemplate updated');
        }
    });
}

function remove(id, callback) {
    db_old.surveyTemplate().remove({
            _id: id
        },
        function(err, result) {
            if (err) {
                console.log('[surveyTemplateModel.remove] Error:' + err);
                callback(err, false);
            } else {
                console.log('' + result + ' document(s) deleted');
                callback(null, '' + result + ' document(s) deleted');
            }
        }
    );
}

function parseXLSXtoTemplate(xlsxFilePath, callback) {
    fs.readFile(xlsxFilePath, function(err, data) {
        var workbook = xlsx.readFile(xlsxFilePath);
        var sheet_name_list = workbook.SheetNames;
        
        var catObjects = [];
        var questions = [];
        console.log('----------------newWorksheet------------');

        var worksheet = workbook.Sheets[sheet_name_list[0]];

        //loop row by row
        for (var z in worksheet) {
            
            if (z[0] === '!') continue;

            //ignore the first row A - thats where all the titles are
            if(z[0] === 'A' && z !== 'A1'){
                console.log('-------------------------------', z);
                
                var index = null;
                var index2 = null;
                
                var question = {
                    num:                    -1,
                    titleText:              null,
                    questionText:           '',
                    answerType:             'radio', //radio, check, range, text
                    answerOptions:          [], //[{descr: String, value: String}],     //key, value for radio and check and list of options for range
                    matrix:                 {rows:[], columns:[]},
                    answerRange:            {min: 0, max:10, val:5},//{min: Number, max: Number, val:Number, minDescr: String, maxDescr: String},
                    visible:                true,
                    required:               true,
                };

                //num
                question.num = 'ques' + worksheet[z].v;
                console.log('num', question.num);

                //questionText
                index = 'D' + z.substring(1, z.length);
                question.titleText = (worksheet[index])? worksheet[index].v : null;
                console.log('Question',index, question.titleText);
                
                //questionHelperText
                index = 'E' + z.substring(1, z.length);
                question.questionText = (worksheet[index])? worksheet[index].v : null;
                console.log('Helptext',index, question.questionText);
                
                //questionType
                index = 'C' + z.substring(1, z.length);
                switch(worksheet[index].v){
                    case "TXT": question.answerType = 'text'; break;
                    case "PTX": question.answerType = 'para'; break;
                    case "CHK": question.answerType = 'checkbox'; break;
                    case "CKF": question.answerType = 'checkboxfilter'; break;
                    case "MCH": question.answerType = 'radio'; break;
                    case "YNO": question.answerType = 'switch'; break;
                    case "RNG": question.answerType = 'range'; break;
                    case 'RRG': question.answerType = 'radiorange'; break;
                    case "DTE": question.answerType = 'date'; break;
                    case "TME": question.answerType = 'time'; break;
                    case "SCL": question.answerType = 'scale'; break;
                    case "MXM": question.answerType = 'matrix_radio'; break;
                    case "MXC": question.answerType = 'matrix_check'; break;
                    case "FLE": question.answerType = 'file'; break;
                    case "CMT": question.answerType = 'comment'; break;
                    default: question.answerType = 'comment'; break;
                }
                console.log('questionType',index,question.answerType);

                //answeroptions
                var options;
                switch(question.answerType){
                    case 'text': break;
                    case 'para': break;
                    case 'date': break;
                    case 'time': break;
                    case 'file': break;
                    case 'comment': break;
                    case 'checkbox':
                    case 'checkboxfilter':
                    case 'radio':
                    case 'switch':
                        //answerOptions
                        index = 'G' + z.substring(1, z.length);
                        options = (worksheet[index].v).split('|');
                        question.answerOptions = [];

                        _.each(options, function(option){
                            question.answerOptions.push({descr: option, value: option});
                        });
                        console.log('answerOptions',index,question.answerOptions);
                        break;
                    case 'scale':
                    case 'range':
                    case 'radiorange':
                        //answerRange
                        index = 'G' + z.substring(1, z.length);
                        index2 = 'J' + z.substring(1, z.length);
                        question.answerRange = {min: (worksheet[index].v).split('|')[0], max: (worksheet[index].v).split('|')[1], minDescr: (worksheet[index2].v).split('|')[0], maxDescr: (worksheet[index2].v).split('|')[1]};
                        break;
                    case 'matrix_radio':
                    case 'matrix_check':
                        var rows= [], columns=[];

                        //matrix options
                        index = 'G' + z.substring(1, z.length);
                        options = (worksheet[index].v).split('|');
                        _.each(options, function(option){
                            rows.push({descr: option, value: option});
                        });

                        index = 'F' + z.substring(1, z.length);
                        options = (worksheet[index].v).split('|');

                        _.each(options, function(option){
                            columns.push({descr: option, value: option});
                        });
                        question.matrix = {rows: rows, columns: columns};
                        console.log('matrixOptions', index, question.matrix);
                        break;
                    default: console.log('answer options error - shouldnt come here');
                }

                //required or not
                index = 'K' + z.substring(1, z.length);
                var reqVal = (worksheet[index])? worksheet[index].v : null;
                if(reqVal == 'YES' || reqVal == 'yes'){
                    question.required = true;
                } else {
                    question.required = false;
                }
                console.log('required',index, question.required);

                //category
                index = 'L' + z.substring(1, z.length);
                reqVal = (worksheet[index])? worksheet[index].v : null;
                if(reqVal){
                    catObjects[worksheet[index].v] = catObjects[worksheet[index].v] || {slideList:[]};
                    catObjects[worksheet[index].v].num = 'cat' + worksheet[index].v;
                    catObjects[worksheet[index].v].slideList.push(question.num);
                    console.log('category found', worksheet[index].v);
                } else {
                    console.log('no category');
                }

                questions.push(question);
            }
        }

        // console.log(questions);
        // console.log('-----');
        // console.log(catObjects);
        callback({cats: catObjects, questions: questions});
    });
}

module.exports = {
    listAll:            listAll,
    readDoc:            read,
    readDocsByOrg:      readByOrg,
    addDoc:             add,
    updateDoc:          update,
    removeDoc:          remove,
    parseXLSXtoTemplate:parseXLSXtoTemplate
};