'use strict';

var _ = require('lodash'),
dataUtils = require("../utils/dataUtils.js"),
UIDUtils = require("../services/UIDUtils.js"),
rawDataSetModel = require("./rawDataSetModel.js"),
surveyTemplateModel = require("./surveyTemplateModel.js"),
db_old = require('../db_old.js');

var inspect = require('eyes').inspector({maxLength: false});



module.exports = {

    listAll: function(req, res) {
        //admin only
        surveyTemplateModel.listAll(function(err, docs) {
            if (err) {
                console.log('[surveyTemplateController.listAll] error');
                res.status(500, err);
            } else {
                console.log('[surveyTemplateController.listAll] num of proj found: ' + docs.length);
                res.status(200).send(docs);
            }
        });
    },

    readDoc: function(req, res) {
        //update user activity
        req.user.lastSignedIn.surveyId = req.surveyTemplate._id;
        req.user.save(function(err){
            if(err){} //not critical data : ignore
                res.json(req.surveyTemplate);
        });
    },

    updateDoc: function(req, res) {

        var p = req.body;
        if (p.surveyName)   req.surveyTemplate.surveyName =  p.surveyName;
        if (p.descr)        req.surveyTemplate.descr =  p.descr;
        if (p.packets)      req.surveyTemplate.packets =  p.packets;
        if (p.template)     req.surveyTemplate.template =  p.template;
        if (p.categories)   req.surveyTemplate.template.categories = p.categories;
        if (p.isConcluded)  req.surveyTemplate.isConcluded = p.isConcluded;

        req.surveyTemplate.save(function(err, surveyTemplate, numberAffected){
            //update org refs
            for (var i = req.org.surveyTemplates.length - 1; i >= 0; i--) {
                if(req.org.surveyTemplates[i].ref == req.surveyTemplate._id.toHexString()){
                    req.org.surveyTemplates[i].surveyName = req.surveyTemplate.surveyName;
                    req.org.surveyTemplates[i].dateModified = Date.now();
                    break;
                }
            }
            req.org.save(function(err, org, numberAffected){
                console.log(org);
                console.log('---------------------------');
            });

            //update answer columns if published
            if(req.surveyTemplate.isPublished) {
                module.exports.updateSurveyAnswerColumns(req, function(err, data) {
                    if(err) {
                        res.status(500).send(err);
                    } else {
                        //respond with the modified entity
                        res.status(200).send(req.surveyTemplate);
                    }
                });
            } else {
                //respond with the modified entity
                res.status(200).send(req.surveyTemplate);
            }
        });
    },

    deleteDoc: function(req, res) {

        console.log("[surveyTemplateController] template delete start");
        //update org refs
        req.org.surveyTemplates = _.filter(req.org.surveyTemplates, function(st){return st.ref !== req.surveyTemplate._id.toHexString();});
        req.org.save(function(err, org, numberAffected){

            //remove survey document
            surveyTemplateModel.removeDoc(req.surveyTemplate._id, function(err, stDocs){
                //respond with the deleted project id
                res.status(200).send(req.surveyTemplate._id);
            });
        });
    },

    //CATEGORIES
    addSurveyCategory: function(req, res) {
        var p = req.body;
        var newCategory = {};
        newCategory.id = 'c'+UIDUtils.generateShortUID4(); //catId;
        newCategory.title = p.title || 'New Category';
        newCategory.renderStyle = p.renderStyle ||
        {
            col:   "#000000",
            bgCol: "#DDDDDD",
            font1: "20px arial,sans-serif",
            font2: "15px arial,sans-serif"
        };
        newCategory.visible = true;
        newCategory.slideList = [];

        //surveyTemplate update
        req.surveyTemplate.dateModified = Date.now();
        req.surveyTemplate.template.categories.push(newCategory);
        req.surveyTemplate.save(function(err, stDoc, numberAffected){
            if(err){}
            //send newly created category
            res.status(200).json(newCategory);
        });
    },

    updateSurveyCategory: function(req, res) {
        var p = req.body;
        var catId = req.params.catId;
        var foundIndex = -1;
        for (var i = req.surveyTemplate.template.categories.length - 1; i >= 0; i--) {
            if(req.surveyTemplate.template.categories[i].id == catId) {
                foundIndex = i;
                break;
            }
        }

        if(foundIndex>-1){
            if(p.title) req.surveyTemplate.template.categories[foundIndex].title = p.title;
            if(p.renderStyle) req.surveyTemplate.template.categories[foundIndex].renderStyle = p.renderStyle;
            if(p.visible) req.surveyTemplate.template.categories[foundIndex].visible = p.visible;
            if(p.slideList) req.surveyTemplate.template.categories[foundIndex].slideList = p.slideList;

            //surveyTemplate update
            req.surveyTemplate.dateModified = Date.now();
            req.surveyTemplate.save(function(err, stDoc, numberAffected){
                if(err){}
                //send newly updated category
                res.status(200).json(stDoc.template.categories[foundIndex]);
            });
        } else {
            res.status(500).json('category not found');
        }
    },

    removeSurveyCategory: function(req, res) {

        //update categories
        var newCatList = [];
        var foundIndex = -1;
        for (var i = 0, l = req.surveyTemplate.template.categories.length; i < l; i++) {
            if(req.surveyTemplate.template.categories[i].id == req.params.catId) {
                foundIndex = i;
            } else {
                newCatList.push(req.surveyTemplate.template.categories[i]);
            }
        }

        if(foundIndex > -1){
            //surveyTemplate update
            req.surveyTemplate.dateModified = Date.now();
            req.surveyTemplate.template.categories = newCatList;
            req.surveyTemplate.save(function(err, stDoc, numberAffected){
                if(err){}
                //send removal index
            res.status(200).json({delIndex: foundIndex});
        });
        } else {
            res.status(500).json('category not found');
        }
    },

    //SLIDES
    addSurveySlide: function(req, res) {
        var p = req.body;
        var newSlide = {};
        newSlide.id = 'q'+ UIDUtils.generateShortUID4(); //slideId;
        newSlide.titleText = p.titleText || 'Add your question title here';
        newSlide.titleShortText = p.titleShortText || "Question title";
        newSlide.titleSubText = p.titleSubText || "Check all that apply";
        newSlide.renderType = p.renderType || 'checkbox';
        newSlide.answerOptions = p.answerOptions || {rows: [{descr:'your option A', value: 'red'},{descr:'your option B', value: 'brown'}], cols:[]};
        newSlide.visible = p.visible || true;
        newSlide.required = p.required || true;

        //update category
        for (var j = req.surveyTemplate.template.categories.length - 1; j >= 0; j--) {
            if(req.surveyTemplate.template.categories[j].id == p.categoryRef) {
                req.surveyTemplate.template.categories[j].slideList.push(newSlide.id);
                console.log('adding slide to category ' + req.surveyTemplate.template.categories[j].title);
                console.log(req.surveyTemplate.template.categories[j].slideList);
            }
        }

        //surveyTemplate update
        req.surveyTemplate.dateModified = Date.now();
        req.surveyTemplate.template.slides.push(newSlide);
        req.surveyTemplate.save(function(err, stDoc, numberAffected){
            if(err){}
            //send newly created slide
            console.log(newSlide);
            res.status(200).json(newSlide);
        });
    },

    updateSurveySlide: function(req, res) {
        var p = req.body;
        var slideId = req.params.slideId;

        var foundIndex = -1;
        for (var i = req.surveyTemplate.template.slides.length - 1; i >= 0; i--) {
            if(req.surveyTemplate.template.slides[i].id == slideId) {
                foundIndex = i;
                break;
            }
        }

        if(foundIndex > -1){
            if(p.titleText) req.surveyTemplate.template.slides[foundIndex].titleText = p.titleText;
            if(p.titleShortText) req.surveyTemplate.template.slides[foundIndex].titleShortText = p.titleShortText;
            if(p.titleSubText) req.surveyTemplate.template.slides[foundIndex].titleSubText = p.titleSubText;
            if(p.titleHelpText) req.surveyTemplate.template.slides[foundIndex].titleHelpText = p.titleHelpText;
            if(p.renderType) req.surveyTemplate.template.slides[foundIndex].renderType = p.renderType;
            if(p.answerOptions) req.surveyTemplate.template.slides[foundIndex].answerOptions = p.answerOptions;
            if(p.visible != undefined) req.surveyTemplate.template.slides[foundIndex].visible = p.visible;
            if(p.required != undefined) req.surveyTemplate.template.slides[foundIndex].required = p.required;

            //surveyTemplate update
            req.surveyTemplate.dateModified = Date.now();
            req.surveyTemplate.save(function(err, stDoc, numberAffected){
                if(err){

                    res.status(500).send(err);
                } else {
                    //update answer columns if published
                    if(req.surveyTemplate.isPublished) {
                        module.exports.updateSurveyAnswerColumns(req, function(err, data) {
                            if(err) {
                                res.status(500).send(err);
                            } else {
                                //send newly updated slide
                                res.status(200).json(stDoc.template.slides[foundIndex]);
                            }
                        });
                    } else {
                        //send newly updated slide
                        res.status(200).json(stDoc.template.slides[foundIndex]);
                    }
                }

            });
        }
    },

    removeSurveySlide: function(req, res) {
        //update slides
        var newSlideList = [];
        var foundIndex = -1, delNum = -1;
        for (var i = req.surveyTemplate.template.slides.length - 1; i >= 0; i--) {
            if(req.surveyTemplate.template.slides[i].id == req.params.slideId) {
                foundIndex = i;
                delNum = req.params.slideId;
            } else {
                newSlideList.push(req.surveyTemplate.template.slides[i]);
            }
        }

        if(foundIndex > -1){
            //remove the slide from all categories
            for (var i = req.surveyTemplate.template.categories.length - 1; i >= 0; i--) {
                // console.log(req.surveyTemplate.template.categories[i].title);
                // console.log(req.surveyTemplate.template.categories[i].slideList);
                req.surveyTemplate.template.categories[i].slideList = _.without(req.surveyTemplate.template.categories[i].slideList, req.surveyTemplate.template.slides[foundIndex].id);
                // console.log('sanitized ' + req.surveyTemplate.template.categories[i].title);
                // console.log(req.surveyTemplate.template.categories[i].slideList);
            }

            //surveyTemplate update
            req.surveyTemplate.template.slides = newSlideList;

            req.surveyTemplate.dateModified = Date.now();
            req.surveyTemplate.save(function(err, stDoc, numberAffected){
                if(err){

                    res.status(500).send(err);
                } else {
                    //update answer columns if published
                    if(req.surveyTemplate.isPublished) {
                        module.exports.updateSurveyAnswerColumns(req, function(err, data) {
                            if(err) {
                                res.status(500).send(err);
                            } else {
                                //send removal index
                                res.status(200).json({delIndex: foundIndex, delNum: delNum});
                            }
                        });
                    } else {
                        //send removal index
                        res.status(200).json({delIndex: foundIndex, delNum: delNum});
                    }
                }
            });
        } else {
            res.status(500).json('slide not found');
        }
    },

getSurveyTemplateById: function(req, res) {
    res.json(req.surveyTemplate.template);
},

getSurveyData: function(req, res){
    //get the survey data set ref
    var rawDataSetRef = req.surveyTemplate.rawDataSetRef;
    //request data
    rawDataSetModel.readDoc(rawDataSetRef, function(err, dataDoc){
        if(err) { return res.status(500).send(err); }
        // console.log(dataDoc);
        res.status(200).send(dataDoc);
    });
},

getSurveyDataAsXLSX: function(req, res) {

    // Future : get data reference from a survey version
    // var rawDataSetRef = null;
    // for (var i = req.survey.versions.length - 1; i >= 0; i--) {
    //  if (req.survey.versions[i].num == parseInt(req.params.vnum)) {
    //      rawDataSetRef = req.survey.versions[i].rawDataSetRef;
    //      break;
    //  }
    // }

    //get the survey data set ref
    var rawDataSetRef = req.surveyTemplate.rawDataSetRef;
    var surveyTemplate = req.surveyTemplate;

    //get users who've logged into survey
    console.log('req.params.stid: '+req.params.stid);
    db_old.surveyuser().find({surveys: {$elemMatch: {ref: req.params.stid}}}, function(err, userDocs) {
        if (rawDataSetRef) {
            rawDataSetModel.readDoc(rawDataSetRef, function(err, dataDocs) {
                if(err) { return res.status(500).send(err); }
                //create xlsx file
                var file = rawDataSetModel.generateXLSX(dataDocs, userDocs, surveyTemplate, function(xlsxFile) {
                    res.status(200).send(xlsxFile);
                });
            });
        } else {
            res.status(500).send('survey data not found');
        }
    });
},

getSurveyDataAnalytics: function(req, res) {
    var data = {
        viewCount: 0,
        numLoggedIn: 0,
        numStarted: 0,
        numFinished: 0,
        meanFinishTime: 0
    };
    //how many times the survey's been viewed
    data.viewCount = isNaN(req.surveyTemplate.metrics.viewCount) ? 0 : req.surveyTemplate.metrics.viewCount;
    //how many user's have logged in
    db_old.surveyuser().count({surveys: {$elemMatch: {ref: req.params.stid}}}, function(err, num) {
        data.numLoggedIn = num;
        //now get number started
        var rawDataSetRef = req.surveyTemplate.rawDataSetRef;
        if(rawDataSetRef) {
            rawDataSetModel.readDoc(rawDataSetRef, function(err, doc) {
                if (err) {} else {

                    if(doc && doc.data) {
                        data.numStarted = doc.data.length;
                        var rawDataDoc = doc.data;
                    } else {
                        data.numStarted = 0;
                    }
                    //use aggregate to get total users and total time from all users to complete
                    db_old.surveyuser().aggregate([
                    {
                        $unwind: '$surveys'
                    },
                    {
                        $match: {
                            'surveys.ref': req.params.stid,
                            'surveys.isComplete': true
                        }
                    }, {
                        $group: {
                            _id: null,
                            count: {
                                $sum: 1
                            },
                            totalTime: {
                                $sum: {
                                    $subtract: [ "$surveys.dateCompleted", "$surveys.dateJoined" ]
                                }
                            }
                        }
                    }
                    ],
                    function(err, totals) {

                        console.log('totals: ', totals);
                        if(totals.count) {
                            data.numFinished = totals[0].count;
                            data.meanFinishTime = totals[0].totalTime/totals[0].count;
                        } else {
                            data.numFinished = 0;
                            data.meanFinishTime = "NA";
                        }
                        //if there is data, then go get number of questions finished (cant just get whether survey is complete
                        //because may have to fill out profile before complete)
                        if(rawDataDoc) {
                            data.percentSurveyFinished = rawDataSetModel.getNumberFinishedSurvey(req.surveyTemplate.template.slides, rawDataDoc);
                            res.status(200).send(data);
                        } else {
                            data.percentSurveyFinished = 0;
                            res.status(200).send(data);
                        }

                    });
                }
            });
        } else {
            res.status(200).send(data);
        }

    });

},

publishSurveyTemplate: function(req, res) {

    //check if dataRef already exists
    if(typeof req.surveyTemplate.rawDataSetRef === "undefined" || req.surveyTemplate.rawDataSetRef === null){
        //create new dataSet
        var cols = [];

        //temporary injection of default columns in addition to the questions found in the template
        cols.push({colId: 'user-email',colName: 'email',colType: 'text'});
        cols.push({colId: 'user-name',colName: 'name',colType: 'text'});
        // cols.push({colId: 'user-gender',colName: 'gender',colType: 'text'});
        // cols.push({colId: 'user-hometown',colName: 'hometown',colType: 'text'});
        // cols.push({colId: 'user-birthday',colName: 'birthday',colType: 'date'});
        // cols.push({colId: 'user-profession',colName: 'profession',colType: 'text'});
        cols.push({colId: 'user-submitted',colName: 'submitted',colType: 'text'});

        for (var i = 0, l = req.surveyTemplate.template.slides.length; i < l; i++) {
            cols.push({
                colId: req.surveyTemplate.template.slides[i].id,
                colName: req.surveyTemplate.template.slides[i].titleShortText,
                colType: req.surveyTemplate.template.slides[i].renderType
            });
        }

        //push any profile questions into dataset as well
        for (var i = 0, l = req.surveyTemplate.template.profile.questions.length; i < l; i++) {
            cols.push({
                colId: req.surveyTemplate.template.profile.questions[i].id,
                colName: req.surveyTemplate.template.profile.questions[i].titleShortText,
                colType: req.surveyTemplate.template.profile.questions[i].renderType
            });
        }


        var params = {
            source: req.surveyTemplate.surveyName,
            sourceType: 'survey',
            org: req.surveyTemplate.org,
            owner: {ref: req.user._id, email: req.user.email, name:req.user.name, picture:req.user.picture},
            columns: cols
        };

        rawDataSetModel.createNewSet(params, function(err, rawSetDocs){
            req.surveyTemplate.rawDataSetRef = rawSetDocs._id;
            req.surveyTemplate.isPublished = true;
            req.surveyTemplate.isConcluded = false;
            req.surveyTemplate.dateModified = Date.now();
            req.surveyTemplate.save(function(err, stDoc, numberAffected){
                //return associated data reference
                res.status(200).send(stDoc.rawDataSetRef);
            });
        });
    } else {
        //do not overwrite - just open it - in the future add versions here
        req.surveyTemplate.isPublished = true;
        req.surveyTemplate.isConcluded = false;
        res.status(200).send('dataset ref already exists, just un-concluding');
    }
},


concludeSurveyTemplate: function(req, res) {
    console.log('concluding survey');
    req.surveyTemplate.isPublished = false;
    req.surveyTemplate.isConcluded = true;
    req.surveyTemplate.save(function(err, stDoc, numberAffected){
        if(err){}
            res.status(200).json(stDoc);
    });
},

generateCoupons: function(req, res) {
    //if coupons were not created earlier
    if(req.surveyTemplate.coupons && req.surveyTemplate.coupons.length === 0){

        var coupons = _.range(0, req.body.noOfCoupons).map(function(c){
            return UIDUtils.generateShortUID6();
        });

        console.log(coupons);

        //surveyTemplate update
        req.surveyTemplate.coupons = coupons;
        req.surveyTemplate.useCoupons = true;
        req.surveyTemplate.couponCriteria = req.body.couponCriteria;
        req.surveyTemplate.dateModified = Date.now();
        req.surveyTemplate.save(function(err, stDoc, numberAffected){
            if(err) { return res.status(500).send(err); }
            //send saveedTemplate
            res.status(200).json(stDoc);
        });
    } else {
        //do not overwrite
        res.status(500).send('coupons already exists, cannot overwrite');
    }
},

generateTemplateFromXLS: function(req, res) {

    var p = req.body;

    console.log('XLSheetReceived');

    if(true){ //TODO: add versioning

        //extract file-extension
        var nameArr = req.files.file.name.split('.');
        var ext = (nameArr[nameArr.length-1]).toUpperCase();

        //build parse func name;
        var parseFn;

        switch (ext) {
            case 'GEXF':
            case 'XLSX':
            case 'XLS':
            case 'JSON':
            parseFn = 'parse' + ext + 'ToSurveyTemplate';
            console.log('calling ' + parseFn);
            break;
            default:
                //no donuts
        }

        if(parseFn){
            dataUtils[parseFn](req.files.file.path, function(result){
                if(!result){
                    return res.status(500).json('Well, this is embarrasing...Coudnt crunch the data file.');
                } 
                console.log('dataUtils parse result: ');
                console.log(result);

                // Build the template object

                //Settings
                req.surveyTemplate.template.base = result.settings.surveyTheme;
                req.surveyTemplate.template.backgroundImage = result.settings.backgroundImage;
                req.surveyTemplate.template.showCatsInSlides = result.settings.showCatsInSlides;
                req.surveyTemplate.template.locale = result.settings.locale;
                req.surveyTemplate.template.hideProfile = result.settings.hideProfile;
                req.surveyTemplate.template.canAnswerAfterSubmission = result.settings.canAnswerAfterSubmission;

                //Header Bar
                req.surveyTemplate.template.header = {
                    title: result.settings.headerTitle,
                    titleHelper: result.settings.headerSubTitle,
                    renderStyle: {col: result.settings.headerHighlightColor}
                };

                //Intro
                req.surveyTemplate.template.intro = {
                    showIntroVideo: result.settings.showIntroVideo,
                    dontShowIntroNav: result.settings.dontShowIntroNav,
                    videoUrl: result.settings.videoUrl,
                    sections: result.introSections,
                    loginText: result.settings.introLoginText,
                    renderStyle: {col: result.settings.introHighlightColor}
                };

                //Login
                req.surveyTemplate.template.login = {
                    title: result.settings.loginTitle,
                    descr: result.settings.loginDescr,
                    optInForEmail: result.settings.showOptInForCommunication,
                    useLogin: result.settings.useLogin,
                    useFBLogin: result.settings.useFBLogin,
                    useGoogLogin: result.settings.useGoogLogin,
                    isManualPrimary: result.settings.isManualPrimaryLogin,
                    usePassword: result.settings.useSurveyPassword,
                    password: result.settings.surveyPassword,
                    dataPolicy: result.settings.dataPolicyHtml,
                    termsOfUse: result.settings.termsOfUseHtml,
                    privacyPolicy: result.settings.privacyPolicyHtml,
                    renderStyle: {col: result.settings.loginHighlightColor}
                };

                //Profile
                req.surveyTemplate.template.profile = {
                    title: result.settings.profileTitle,
                    descr: result.settings.profileDescr,
                    showProfilePercent: result.settings.showProfilePercent,
                    completeProfile: result.settings.completeProfile,
                    showMedia: result.settings.uploadMediaToProfile,
                    showSocial: result.settings.showSocialSectionsInProfile,
                    isExpandedProfile: result.settings.isExpandedProfile,
                    hideProfileOption: result.settings.hideProfileOption,
                    socialHash: result.settings.profileSocialHash,
                    showReferral: result.settings.showReferralForm,
                    instructions: result.settings.profileInstructions,
                    instagramInstructions: result.settings.profileInstagramInstructions,
                    twitterInstructions: result.settings.profileTwitterInstructions,
                    mediaInstructions: result.settings.profileMediaInstructions,
                    renderStyle: {col: result.settings.profileHighlightColor}
                };
                if(result.settings.profileMediaTags) {
                    req.surveyTemplate.template.profile.mediaTags = result.settings.profileMediaTags.split('|');
                }

                //timeline
                req.surveyTemplate.template.timeline = {
                    descr: result.settings.timelineDescr,
                    tooltips: {
                        groundwork: result.settings.timelineTooltipGroundwork,
                        survey: result.settings.timelineTooltipSurvey,
                        profile: result.settings.timelineTooltipProfile,
                        invite: result.settings.timelineTooltipInvite,
                        analysis: result.settings.timelineTooltipAnalysis,
                        mapp: result.settings.timelineTooltipMapp
                    },
                    renderStyle: {col: result.settings.timelineHighlightColor}
                };

                //FAQ
                req.surveyTemplate.template.faq = {
                    title: result.settings.faqTitle,
                    descr: result.settings.faqBody,
                    renderStyle: {col: result.settings.faqHighlightColor}
                };

                //Thanks
                req.surveyTemplate.template.thanks = {
                    title: result.settings.thanksTitle,
                    descr: result.settings.thanksDescr,
                    showProfileBtn: result.settings.showProfileBtn,
                    img: result.settings.thanksImg,
                    gifts: result.gifts,
                    renderStyle: {col: result.settings.thanksHighlightColor}
                };
                if(result.settings.thanksTooltips) {
                    req.surveyTemplate.template.thanks.tooltips = [];
                    _.each(result.settings.thanksTooltips.split('|'), function(tt) {
                        req.surveyTemplate.template.thanks.tooltips.push({
                            descr: tt
                        });
                    });
                }

                //Coupons
                req.surveyTemplate.useCoupons = result.settings.useCoupons;
                req.surveyTemplate.noOfCoupons = result.settings.noOfCoupons;

                //Share Settings
                req.surveyTemplate.template.invite = {
                    title: result.settings.inviteTitle,
                    descr: result.settings.inviteDescr,
                    email: result.settings.invitationEmailSender,
                    password: result.settings.invitationEmailSenderPassword,
                    htmlTop: result.settings.invitationEmailHtmlTop,
                    htmlBottom: result.settings.invitationEmailHtmlBottom,
                    subject: result.settings.invitationSubject,
                    body: result.settings.invitationBody,
                    img: result.settings.inviteImg,
                    renderStyle: {col: result.settings.inviteHighlightColor}
                };

                //whether to show different sections
                req.surveyTemplate.template.showInvite = result.settings.showInvite;
                req.surveyTemplate.template.showIntro = result.settings.showIntro;
                req.surveyTemplate.template.showTimeline = result.settings.showTimeline;
                req.surveyTemplate.template.showFaq = result.settings.showFaq;


                //categories
                req.surveyTemplate.template.categories = [];
                var newCategory, newSlide;

                for (var k = 0, l = result.cats.length; k < l; k++) {
                    if(result.cats[k]){
                        console.log('------category----', result.cats[k]);
                        newCategory = {};
                        newCategory.id = result.cats[k].id;
                        newCategory.title = result.cats[k].title || "default category name";
                        newCategory.renderStyle =  {
                            col:   result.cats[k].col || "#747474",
                            bgCol: result.cats[k].bgCol || "#DDDDDD",
                            font1: result.cats[k].font1 || "20px arial,sans-serif",
                            font2: result.cats[k].font2 || "15px arial,sans-serif"
                        };
                        newCategory.visible = true;
                        newCategory.slideList = result.cats[k].slideList;
                        req.surveyTemplate.template.categories.push(newCategory);
                    }
                }

                //slides
                req.surveyTemplate.template.slides = [];

                for (var i = 0, l = result.questions.length; i < l; i++) {
                    //console.log('------ques----', result.questions[i]);
                    newSlide = {};
                    newSlide.id =               result.questions[i].id;
                    newSlide.titleText =        result.questions[i].titleText || 'Question for slide' + slideId;
                    newSlide.titleShortText =   result.questions[i].shortTitleText || (result.questions[i].titleText).substring(0,30) + '...'
                    newSlide.titleSubText =     result.questions[i].subText;
                    newSlide.renderType =       result.questions[i].renderType || 'radio';
                    newSlide.answerOptions =    result.questions[i].answerOptions || {rows: [{descr:'opt-1', value: 'opt-1'},{descr:'opt-2', value: 'opt-2'}], cols: [{descr:'Col-A', value: 'Col-A'},{descr:'Col-B', value: 'Col-B'}]};
                    newSlide.visible =          result.questions[i].visible;
                    newSlide.required =         result.questions[i].required;

                    req.surveyTemplate.template.slides.push(newSlide);
                }

                //profile questions
                req.surveyTemplate.template.profile.questions = [];

                for (var i = 0, l = result.profileQuestions.length; i < l; i++) {
                    console.log('------profile ques----', result.profileQuestions[i]);
                    newSlide = {};
                    newSlide.id =               result.profileQuestions[i].id;
                    newSlide.categoryId =       result.profileQuestions[i].categoryId;
                    newSlide.titleText =        result.profileQuestions[i].titleText || 'Question for slide' + slideId;
                    newSlide.titleShortText =   result.profileQuestions[i].shortTitleText || (result.profileQuestions[i].titleText).substring(0,30) + '...'
                    newSlide.titleSubText =     result.profileQuestions[i].subText;
                    newSlide.renderType =       result.profileQuestions[i].renderType || 'radio';
                    newSlide.answerOptions =    result.profileQuestions[i].answerOptions || {rows: [{descr:'opt-1', value: 'opt-1'},{descr:'opt-2', value: 'opt-2'}], cols: [{descr:'Col-A', value: 'Col-A'},{descr:'Col-B', value: 'Col-B'}]};
                    newSlide.visible =          result.profileQuestions[i].visible;
                    newSlide.required =         result.profileQuestions[i].required;

                    req.surveyTemplate.template.profile.questions.push(newSlide);
                }


                //console.log(req.surveyTemplate.template);


                //surveyTemplate update
                req.surveyTemplate.dateModified = Date.now();
                req.surveyTemplate.save(function(err, savedTemplate, numberAffected){
                    if(err){
                        console.log(err);
                        res.status(500).json('no donuts');
                    }else{

                        //republish survey adjusting columns (if already published)
                        // if(typeof req.surveyTemplate.rawDataSetRef === "undefined" || req.surveyTemplate.rawDataSetRef === null){
                        //  module.exports.publishSurveyTemplate(req, res);
                        // }
                        //console.log(req.surveyTemplate.template);

                        //update answer columns if published
                        if(req.surveyTemplate.isPublished) {
                            module.exports.updateSurveyAnswerColumns(req, function(err, data) {
                                if(err) {
                                    res.status(500).send(err);
                                } else {
                                    res.status(200).json(savedTemplate.template);
                                }
                            });
                        } else {
                            res.status(200).json(savedTemplate.template);
                        }
                    }
                });
            });
        }
    }
},

updateSurveyAnswerColumns: function(req, callback) {
        //create new set of columns
        var cols = [];

        //temporary injection of default columns in addition to the questions found in the template
        cols.push({colId: 'user-email',colName: 'email',colType: 'text'});
        cols.push({colId: 'user-name',colName: 'name',colType: 'text'});
        // cols.push({colId: 'user-gender',colName: 'gender',colType: 'text'});
        // cols.push({colId: 'user-hometown',colName: 'hometown',colType: 'text'});
        // cols.push({colId: 'user-birthday',colName: 'birthday',colType: 'date'});
        // cols.push({colId: 'user-profession',colName: 'profession',colType: 'text'});
        cols.push({colId: 'user-submitted',colName: 'submitted',colType: 'text'});

        for (var i = 0, l = req.surveyTemplate.template.slides.length; i < l; i++) {
            cols.push({
                colId: req.surveyTemplate.template.slides[i].id,
                colName: req.surveyTemplate.template.slides[i].titleShortText,
                colType: req.surveyTemplate.template.slides[i].renderType
            });
        }

        //push any profile questions into dataset as well
        for (var i = 0, l = req.surveyTemplate.template.profile.questions.length; i < l; i++) {
            cols.push({
                colId: req.surveyTemplate.template.profile.questions[i].id,
                colName: req.surveyTemplate.template.profile.questions[i].titleShortText,
                colType: req.surveyTemplate.template.profile.questions[i].renderType
            });
        }

        rawDataSetModel.updateColumns(req.surveyTemplate.rawDataSetRef, cols, function(err, rawSetDocs){
            //return associated data reference
            if(err) {
                callback(true, 'Error updating columns');
            } else {
                callback(false, req.surveyTemplate.rawDataSetRef);
            }
        });
    },
    listOrgSurveyTemplates: function(req, res) {
       if (req.org){
           res.json(req.org.surveyTemplates);
       } else {
           res.status(500).send('Error: org not found');
       }
   },


   addOrgSurveyTemplate: function(req, res){
        var p = req.body;
        console.log('[orgController.addOrgSurveyTemplate] Creating new surveyTemplate');

        var newSurveyTemplate = {};
        //required params
        newSurveyTemplate.surveyName = p.surveyName || 'Untitled Survey Template'; //name required
        newSurveyTemplate.org = {ref: req.org._id, orgName: req.org.orgName, picture: req.org.picture};
        newSurveyTemplate.owner = {ref: req.user._id, email: req.user.email, name: req.user.name, picture: req.user.picture};

        //add a default template
        newSurveyTemplate.template = {};
        newSurveyTemplate.template.categories = [];
        newSurveyTemplate.template.slides = [];

        newSurveyTemplate.template.slides.push({
            id: 'q'+ UIDUtils.generateShortUID4(),
            titleText: "Add your question title here",
            titleShortText: "Question title",
            titleSubText: "Check all that apply",
            renderType: 'checkbox',
            answerOptions: {rows: [{descr:'your option A', value: 'red'},{descr:'your option B', value: 'brown'}], cols:[]},
            required: true, 
            visible: true
         });

         newSurveyTemplate.template.categories.push({
             id: 'c' + UIDUtils.generateShortUID4(),
             title: 'New Category',
             renderStyle:{
                 col:   "#000000",
                 bgCol: "#DDDDDD",
                 font1: "20px arial,sans-serif",
                 font2: "15px arial,sans-serif"
             },
             visible: true,
             slideList:[newSurveyTemplate.template.slides[0].id]
         });

         //optional params
         if (p.descr) newSurveyTemplate.descr = p.descr;
         if (p.tags) newSurveyTemplate.tags = p.tags;

         console.log('[orgController.addOrgSurveyTemplate] SurveyTemplate creation start : user');
         console.log(req.user);
         console.log('[orgController.addOrgSurveyTemplate] SurveyTemplate creation start : params');
         console.log(newSurveyTemplate);

         surveyTemplateModel.addDoc(newSurveyTemplate, function(err, surveyTemplate) {
             if (err) {
                 console.log('[orgController.addOrgSurveyTemplate] Error creating SurveyTemplate. ' + err);
                 res.status(500).send('Error: Unable to create new SurveyTemplate. ' + err);
             } else {
                 console.log('[orgController.addOrgSurveyTemplate] SurveyTemplate created : ' + surveyTemplate.surveyName);
                 //console.log(surveyTemplate);

                 var newSurveyTemplate = {
                     ref: surveyTemplate._id,
                     surveyName: surveyTemplate.surveyName,
                     owner: {ref: surveyTemplate.owner.ref, name: surveyTemplate.owner.name, email: surveyTemplate.owner.email, picture: surveyTemplate.owner.picture},
                     dateModified: surveyTemplate.dateModified
                 };

                 console.log(newSurveyTemplate);

                 //update org
                 req.org.surveyTemplates.push(newSurveyTemplate);

                 //console.log('[orgController.addOrgSurveyTemplate] org update start : org.SurveyTemplates');
                 //console.log(req.org.SurveyTemplates);
                 req.org.save(function(err, orgDocs, numberAffected){
                     if(err){
                        console.log('[orgController.addOrgSurveyTemplate] SurveyTemplate created but could not update org. ' + err);
                     }
                     res.status(200).json(surveyTemplate);
                 });
             }
         });
},
};
