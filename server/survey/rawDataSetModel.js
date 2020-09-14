'use strict';
var _ = require('lodash');
var db_old = require('../db_old.js');
var xlsx = require('xlsx');

function createNewSet(params, callback) {
    var instance = new (db_old.rawDataSet())(params);

    //timestamp creation
    instance.dateCreated = Date.now();
    instance.dateModified = Date.now();

    instance.save(function(err, result) {
        if (err) {
            console.log('[rawDataSetModel.add] Database Error: could not add new rawDataSet');
            callback(err, false);
        } else {
            console.log('[rawDataSetModel.add] Success saving rawDataSet: ' + result.setName);
            callback(null, result);
        }
    });
}

function readDoc(id, callback) {
    console.log('[rawDataSetModel.readDoc] id:' + id);
    db_old.rawDataSet().findOne({_id:id}, function(err, doc) {
        if (err) {
            console.log('[rawDataSetModel.readDoc] Error: ' + err);
            callback(err, false);
        } else {
            console.log('[rawDataSetModel.readDoc] Success: ');
            console.log(doc);
            callback(null, doc);
        }
    });
}

function addRow(dataSetId, rowId, dataRowArr, callback) {
    var timer = Date.now();
    db_old.rawDataSet().update(
        {_id:dataSetId},
        {$push: { "data" : {rowId:rowId, row: dataRowArr}}},
        function(err, savedDoc) {
            if (err) {
                console.log('[rawDataSetModel.addRow] Error: ' + err);
                callback('err saving:' + err, false);
            } else {
                callback(null, savedDoc);
                console.log('[rawDataSetModel.addRow]', Date.now() - timer);
            }
        }
    );
}

function addRespondent(dataSetId, rowId, callback) {
    var timer = Date.now();
    db_old.rawDataSet().update(
        {_id:dataSetId},
        {$push: { "data" : {rowId:rowId, row: []}}},
        function(err, savedDoc) {
            if (err) {
                console.log('[rawDataSetModel.addRespondent] Error: ' + err);
                callback('err saving:' + err, false);
            } else {
                callback(null, savedDoc);
                console.log('[rawDataSetModel.addRespondent]', Date.now() - timer);
            }
        }
    );
}

function addResponse(dataSetId, rowId, colId, response, isPrivate, notes, callback) {
    var timer = Date.now();
    db_old.rawDataSet().find({_id:dataSetId}, {data: {$elemMatch: {rowId:rowId}}}, function(err, doc) {
        if (err) {
            console.log('[rawDataSetModel.addResponse] Error: ' + err);
            callback(err, false);
        } else {
            console.log('[rawDataSetModel.addResponse] rowDoc found: ', Date.now() - timer);
            // console.log(doc);
            if(doc !== null && doc[0].data.length > 0){
                var rowData = doc[0].data[0].row;
                // console.log("[rawDataSetModel.addResponse] rowData");
                // console.log(rowData);
                var colIndex = -1;
                for (var cl = rowData.length - 1; cl >= 0; cl--) {
                    if(rowData[cl].colId == colId){
                        //col found
                        colIndex = cl;
                        break;
                    }
                }

                if(colIndex > -1){
                    //old column update
                    rowData[colIndex] = {colId: colId, response: response, isPrivate: isPrivate, notes: notes};
                    console.log('[rawDataSetModel.addResponse] rowDoc.col update', Date.now() - timer);
                } else {
                    //new column add
                    rowData.push({colId: colId, response: response, isPrivate: isPrivate, notes: notes});
                    console.log('[rawDataSetModel.addResponse] rowDoc.col add', Date.now() - timer);
                }

                db_old.rawDataSet().update(
                    {"data.rowId":rowId},
                    {$set: { 'data.$' : {rowId:rowId, row:rowData}}},
                    function(err, savedDoc, numberAffected) {
                        if (err) {
                            callback('err saving:' + err, false);
                        } else {
                            console.log('[rawDataSetModel.addResponse] rowDoc updated', Date.now() - timer);
                            callback(null, savedDoc);
                        }
                    }
                );

            } else {
                //row is not set
                db_old.rawDataSet().update(
                    {_id:dataSetId},
                    {$push: { "data" : {rowId:rowId, row:[{colId: colId, response: response, isPrivate: isPrivate, notes: notes}]}}},
                    function(err, savedDoc) {
                        if (err) {
                            callback('err saving:' + err, false);
                        } else {
                            callback(null, savedDoc);
                            console.log('[rawDataSetModel.addResponse] rowDoc add', Date.now() - timer);
                        }
                    }
                );
            }
        }
    });
}

function getResponses(dataSetId, rowId, callback){
    var timer = Date.now();
    db_old.rawDataSet().find({_id:dataSetId}, {data: {$elemMatch: {rowId:rowId}}}, function(err, doc) {
        if (err) {
            console.log('[rawDataSetModel.getResponses] Error: ' + err);
            callback(err, false);
        } else {
            console.log('[rawDataSetModel.getResponses] rowDoc found: ', Date.now() - timer);
            // console.log(doc);
            if(doc[0].data.length > 0 && typeof doc[0].data[0].rowId !== "undefined"){
                callback(null, doc[0].data[0]);
            } else {
                callback('row not found', false);
            }
        }
    });
}


function generateAttribNameArray(columnData, selector, colStatsObj){
    // console.log('columnDAta: ', columnData);
    var arr = [];
    //required
    arr.push('id');
    // //add coupons - to be added
    // colStatsObj['user-coupons'] = {};
    // colStatsObj['user-coupons']['quesText'] = 'user-coupons';
    // colStatsObj['user-coupons']['ansType'] = 'text';
    // arr.push('user-coupons');

    //user defined
    var i, selAttrib;
    for(var i = 0, l = columnData.length; i<l; i++){
        //console.log(columnData[i],' , ',columnData[i][selector]);
        selAttrib = columnData[i][selector]; //selected Attribute
        colStatsObj[selAttrib] = {};
        colStatsObj[selAttrib]['quesText'] = colStatsObj[selAttrib]['quesText'] ? colStatsObj[selAttrib]['quesText'] : columnData[i]['colName'];
        colStatsObj[selAttrib]['ansType'] = colStatsObj[selAttrib]['ansType'] ? colStatsObj[selAttrib]['ansType'] : columnData[i]['colType'];
        arr.push(selAttrib);
    }

    return arr;
}

function generateRowArray(answerRow, selectorArray, columnData, colStatsObj){
    var arr = [], valObj = {}, val;

    //required
    arr.push(answerRow.rowId || '-');


    //user defined
    for(var i = 1, l = selectorArray.length; i<l; i++){

        var valObj = _.find(answerRow.row, function(ans) {
            if(ans.colId == selectorArray[i]) {
                return true;
            }
        });
        if(typeof valObj !== 'undefined' && typeof valObj.response !== 'undefined' && valObj.response != null){
            //remove first and last brackets if there (don't remove all in case matrix of values)
            //also don't remove brackets from media json
            if(valObj.colId != 'media') {
                valObj.response = valObj.response.replace(/^\[/, '').replace(/\]$/, '').replace(/(\"\,\")/g, '|').replace(/^\"/, '').replace(/\"$/, '');;
            }
            val = valObj.response || "";
            colStatsObj[valObj.colId]['count'] = colStatsObj[valObj.colId]['count'] ? colStatsObj[valObj.colId]['count']+1 : 1;
        } else {
            val = "";
        }
        arr.push(val);
    }
    return arr;
}

function getNumberFinishedSurvey(slides, rows) {
    var numFinished = 0;
    _.each(rows, function(row){
        if(getPercentSurveyAnswered(slides, row.row) == 100) {
            numFinished++;
        }
    });

    return numFinished;

}

function getPercentSurveyAnswered(slides, row) {
    var filterAns = _.filter(row, function(r) {
        return _.find(slides, {id: r.colId});
    })
    return Math.round(filterAns.length/slides.length*100);
}

function getPercentProfileAnswered(user, survey, row) {
    //use same formula as in front end of survey
    var tot, ans;
    //go through each section and if any answered,
    var per = 0;


    //see if entered twitter (15%)
    if(!survey.profile.showSocial || ((user.twitter.username && user.twitter.username != '') || user.twitter.hasNone == true)) {
        per+=15;
    }
    //see if entered instagram (15%)
    if(!survey.profile.showSocial || ((user.instagram.username && user.instagram.username != '') || user.instagram.hasNone)) {
        per+=15;
    }


    //see how much of userrofile.questionMedia answered (50% possible)
    var ques = _.filter(survey.profile.questions, function(q) {
        return q.required && q.categoryId == 'PC1';
    });
    if(ques && ques.length > 0) {
        var ans = _.filter(ques, function(q) {
            var a = _.find(row, {colId: q.id});
            return a && a.response && a.response != '';
        });

        var quesLength = ques.length;

        if(user.picture == '') {
            quesLength++;
        }

        per += ans.length/quesLength*30;
    } else if(user.picture != '') {
        per += 30;
    }

    var ans = _.filter(survey.profile.questions, function(q) {
        var a = _.find(row, {colId: q.id});
        return a && a.response && a.response != '' && q.categoryId == 'PC2';
    });
    if(ans && ans.length > 0) {
        per += 20;
    } else if(!ans) {
        per += 20;
    }

    //media
    var med = user.media;
    if(med && med.length > 0) {
        per+=Math.min(20, 10*med.length);
    } else if(!survey.profile.showMedia) {
        per+=20;
    }

    // console.log('tot vs ans: ', tot,ans.length);
    // per = 100;
    //at least give them 5% since entered in email and name to register
    if(isNaN(per)) {
        per = 0;
    }

    per = Math.min(100, Math.max(Math.round(per), 0));
    return per;
}

function generateXLSX(dataDoc, userDocs, surveyDoc, callback){
    var surveyId = surveyDoc._id;
    var answerRowArr = [];      //single row array (collection of answers per repsondent)
    var answerRowNameArr = [];  //row array of names for first column
    var answerSheetArr = [];    //entire sheet (collection of collections)
    var colStatsObj = {};
    var mostMedia = 0;          //number of media user with most has

    //loop through userDocs and get object with email and media
    var userMap = _.map(userDocs, function(user) {
        var med = _.filter(user.media, function(m) {
            return m.surveyRef == surveyId;
        });
        //not sure why not working
        // var userSur = _.find(user.surveys, {ref: surveyId});
        var userSur = _.find(user.surveys, function(s) {
            if(s.ref == surveyId) {
                return true;
            }
        })
        // for(var i=0;i<user.surveys.length; i++) {
        //     if(user.surveys[i].ref === surveyId) {
        //         userSur = user.surveys[i];
        //     }
        // }
        //get length of largest user media array for use in columns of spreadsheet
        mostMedia = Math.max(med.length, mostMedia);

        return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            picture: user.picture,
            optIn: userSur.optInEmail,
            media: med,
            survey: userSur,
            twitter: user.twitter,
            instagram: user.instagram,
            lastEdit: user.lastEdit
        }
    });

    //these are already created when the columns are created
    //when the dataset is published
    //see surveyTemplateController line 382

    // dataDoc.columns.push({
    //     colId: "user-email",
    //     colName: "User Email",
    //     colType: "string"
    // });

    // dataDoc.columns.push({
    //     colId: "user-name",
    //     colName: "User Name",
    //     colType: "string"
    // });

    //add opt in field for column
    dataDoc.columns.splice(2, 0, {
        colId: "profile-pic",
        colName: "Profile Picture",
        colType: "string"
    });

    //add dates (started, signed up, completed)
    dataDoc.columns.splice(3, 0, {
        colId: "date-started",
        colName: "Date Started",
        colType: "date"
    });

    dataDoc.columns.splice(4, 0, {
        colId: "date-completed",
        colName: "Date Completed",
        colType: "date"
    });

    dataDoc.columns.splice(5, 0, {
        colId: "date-completed-ts",
        colName: "Date Completed Timestamp",
        colType: "number"
    });

    //add opt in field for column
    dataDoc.columns.splice(5, 0, {
        colId: "survey-percent",
        colName: "Percent Survey Complete",
        colType: "number"
    });

    //add opt in field for column
    dataDoc.columns.splice(6, 0, {
        colId: "profile-percent",
        colName: "Percent Profile Complete",
        colType: "number"
    });

    //add opt in field for column
    dataDoc.columns.splice(7, 0, {
        colId: "profile-complete",
        colName: "Profile Complete",
        colType: "boolean"
    });

    //add opt in field for column
    dataDoc.columns.splice(8, 0, {
        colId: "referred-by",
        colName: "Referred By",
        colType: "string"
    });

    //add opt in field for column
    dataDoc.columns.splice(9, 0, {
        colId: "opt-in",
        colName: "Email Opt In",
        colType: "boolean"
    });

    //add opt in field for column
    dataDoc.columns.splice(10, 0, {
        colId: "last-edit",
        colName: "Last Profile Edit",
        colType: "date"
    });

    //add twitter and instagram
    dataDoc.columns.splice(11, 0, {
        colId: "twitter",
        colName: "Twitter",
        colType: "string"
    });
    dataDoc.columns.splice(12, 0, {
        colId: "instagram",
        colName: "Instagram",
        colType: "string"
    });

    //Show Profile
    dataDoc.columns.splice(13, 0, {
        colId: "showProfile",
        colName: "Allow Profile to be Shown",
        colType: "boolean"
    });


    dataDoc.columns.push({
        colId: "media",
        colName: "Media",
        colType: "string"
    });

    // //add extra fields for media into columns
    for(var i=0;i<mostMedia;i++) {

        dataDoc.columns.push({
            colId: "media"+i,
            colName: "Media "+i,
            colType: "string"
        });

        dataDoc.columns.push({
            colId: "mediaDesc"+i,
            colName: "Media Description "+i,
            colType: "string"
        });

        dataDoc.columns.push({
            colId: "mediaAttr"+i,
            colName: "Media Attribution "+i,
            colType: "string"
        });

        dataDoc.columns.push({
            colId: "mediaTags"+i,
            colName: "Media Tags "+i,
            colType: "string"
        });

    }


    //questions
    //loop through survey template to get titles
    answerRowArr = generateAttribNameArray(dataDoc.columns, 'colId', colStatsObj);
    answerRowNameArr = generateAttribNameArray(dataDoc.columns, 'colName', colStatsObj);

    //get survey questions and use to create first row
    answerSheetArr.push(answerRowNameArr); //first row is for question ids

    // console.log('colStatsObj: ');
    // console.log(colStatsObj);

    _.each(dataDoc.data, function(row){
        //get user obj
        var user = _.find(userMap, {id: row.rowId});
        //add email and media to row
        if(user) {
            row.row.push({
                colId: 'user-email',
                response: user.email,
                isPrivate: true
            });
            row.row.push({
                colId: 'user-name',
                response: user.name,
                isPrivate: false
            });
            row.row.push({
                colId: 'profile-pic',
                response: user.picture,
                isPrivate: false
            });
            row.row.push({
                colId: 'date-started',
                response: user.survey.dateJoined,
                isPrivate: true
            });
            row.row.push({
                colId: 'date-completed-ts',
                response: user.survey.dateCompleted.getTime(),
                isPrivate: true
            });
            row.row.push({
                colId: 'date-completed',
                response: user.survey.dateCompleted,
                isPrivate: true
            });
            var proPer = getPercentProfileAnswered(user, surveyDoc.template, row.row);
            row.row.push({
                colId: 'profile-percent',
                response: proPer.toString() +"%",
                isPrivate: true
            });
            var surPer = getPercentSurveyAnswered(surveyDoc.template.slides, row.row);
            row.row.push({
                colId: 'survey-percent',
                response: surPer.toString() +"%",
                isPrivate: true
            });
            row.row.push({
                colId: 'profile-complete',
                response: proPer == 100,
                isPrivate: true
            });
            row.row.push({
                colId: 'referred-by',
                response: user.survey.referName,
                isPrivate: true
            });
            row.row.push({
                colId: 'opt-in',
                response: user.optIn,
                isPrivate: true
            });
            row.row.push({
                colId: 'last-edit',
                response: user.lastEdit,
                isPrivate: true
            });
            row.row.push({
                colId: 'twitter',
                response: user.twitter.username,
                isPrivate: true
            });
            row.row.push({
                colId: 'instagram',
                response: user.instagram.username,
                isPrivate: true
            });

            row.row.push({
                colId: 'showProfile',
                response: user.survey.isProfileShown,
                isPrivate: true
            });

            //media
            var mediaList = [];
            for(var i=0;i<user.media.length; i++) {
                var ans = user.media[i].embed;
                if(typeof ans !== 'string' || ans == '') {
                    ans = user.media[i].url;
                }
                var mediaItem = {
                    url: user.media[i].url,
                    embed: user.media[i].embed,
                    description: user.media[i].descr,
                    attribution: user.media[i].attr,
                    tags: user.media[i].tags
                };
                mediaList.push(mediaItem);

                row.row.push({
                    colId: 'media'+i,
                    response: ans,
                    isPrivate: false
                });
                row.row.push({
                    colId: 'mediaDesc'+i,
                    response: user.media[i].descr,
                    isPrivate: false
                });
                row.row.push({
                    colId: 'mediaAttr'+i,
                    response: user.media[i].attr,
                    isPrivate: false
                });
                row.row.push({
                    colId: 'mediaTags'+i,
                    response: user.media[i].tags,
                    isPrivate: false
                })
            }

            if(mediaList.length > 0) {
                row.row.push({
                    colId: 'media',
                    response: JSON.stringify(mediaList),
                    isPrivate: false
                });
            }
            // console.log('user row: ', row);
            // console.log('answer row arr: ', answerRowArr);
            // console.log('dataDoc.columns: ', dataDoc.columns);
            // console.log('colStatsObj: ', colStatsObj);
            answerSheetArr.push(generateRowArray(row, answerRowArr, dataDoc.columns, colStatsObj));
        }
    });


    //workbook gen
    var wb = new Workbook();
    var ws_name, ws;

    //answers worksheet
    ws_name = "answers";
    ws = sheet_from_array_of_arrays(answerSheetArr);
    //  add worksheet to workbook
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;

    //stats worksheet
    // var edData = ed_data_arr;
    // ws_name = "stats";
    // ws = sheet_from_array_of_arrays(edData);
    // // console.log('edge worksheet');
    // // console.log(ws);
    // //  add worksheet to workbook
    // wb.SheetNames.push(ws_name);
    // wb.Sheets[ws_name] = ws;

    var wbout = xlsx.write(wb, {
        bookType: 'xlsx',
        bookSST: false,
        type: 'binary'
    });

    callback(wbout);
}

function updateColumns(dataSetId, columns, callback) {

    db_old.rawDataSet().update(
        {_id:dataSetId},
        {columns: columns},
        function(err, savedDoc) {
            if(err) {
                callback(err, false);
            } else {
                callback(false, savedDoc);
            }
        });
}

// xlsx writing utilities - start
function sheet_from_array_of_arrays(data, opts) {
    var ws = {};
    var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }};
    for(var R = 0; R != data.length; ++R) {
        for(var C = 0; C != data[R].length; ++C) {
            if(range.s.r > R) range.s.r = R;
            if(range.s.c > C) range.s.c = C;
            if(range.e.r < R) range.e.r = R;
            if(range.e.c < C) range.e.c = C;
            var cell = {v: data[R][C] };
            if(cell.v === null) continue;
            var cell_ref = xlsx.utils.encode_cell({c:C,r:R});

            if(typeof cell.v === 'number') cell.t = 'n';
            else if(typeof cell.v === 'boolean') cell.t = 'b';
            else if(cell.v instanceof Date) {
                cell.t = 'n'; cell.z = xlsx.SSF._table[14];
                cell.v = datenum(cell.v);
            }
            else cell.t = 's';

            ws[cell_ref] = cell;
        }
    }
    if(range.s.c < 10000000) ws['!ref'] = xlsx.utils.encode_range(range);
    return ws;
}

function datenum(v, date1904) {
    if(date1904) v+=1462;
    var epoch = Date.parse(v);
    return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function Workbook() {
    if(!(this instanceof Workbook)) return new Workbook();
    this.SheetNames = [];
    this.Sheets = {};
}
// xlsx writing utilities - end

module.exports = {
    createNewSet:               createNewSet,
    readDoc:                    readDoc,
    addRow:                     addRow,
    addRespondent:              addRespondent,
    addResponse:                addResponse,
    getResponses:               getResponses,
    generateXLSX:               generateXLSX,
    updateColumns:              updateColumns,
    getNumberFinishedSurvey:    getNumberFinishedSurvey
};
