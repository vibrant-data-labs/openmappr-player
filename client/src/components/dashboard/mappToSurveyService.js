angular.module('common')
    .service('mappToSurveyService', ['$q', '$http', 'dataGraph', 'surveyTemplateFactory', 'orgFactory', 'uiService',
        function($q, $http, dataGraph, surveyTemplateFactory, orgFactory, uiService) {
            "use strict";

            //--------------------------------------Building and Publishing Survey

            var params = {};

            function renderSurvey(renderParams) {

                _.assign(params, renderParams);

                var graph = dataGraph.getRenderableGraph().graph;

                //generate packets of question, answer combinations
                var packets = distributeQA(_.clone(graph.nodes), renderParams.noOfPackets, renderParams.noOfQuesPerPacket, renderParams.noOfAnsPerQuestion);
                console.debug('packets', packets);

                //generate the base survey
                var category = {
                    id: 1,
                    title: 'Questions',
                    renderStyle: {
                        col: '#fff',
                        bgCol: '#db1a57',
                        font1: '20px, arial,sans-serif',
                        font2: '15px, arial,sans-serif'
                    },
                    slideList: []
                };

                var nodeList = _.clone(graph.nodes);
                //
                var slides = generateSlidesFromNodes(nodeList, category);
                console.log(slides);
                //
                var template = _.assign(_.clone(SurveySchema.template), {slides: slides, categories: [category]});
                var survey = buildAndPublishSurvey(template, packets, params);

            }

            function generateSlidesFromNodes(nodes, category) {

                var slides = [];

                _.each(nodes, function(sourceNode) {

                    //OPTION 1 select all other nodes as targets
                    var targetNodes = _.reject(nodes, sourceNode);

                    //OPTION ALT select first 5
                    //var targetNodes = _.slice(_.reject(nodes, sourceNode), 0, 5);

                    //OPTION ALT2 sample from the noOfAnsPerQuestion
                    //var targetNodes = sampleNodes(_.reject(nodes, sourceIssue), params.noOfAnsPerQuestion);

                    //generate the question from the template and source / target nodes.
                    var slide = convertNodeToSlide(sourceNode, targetNodes);
                    console.log(slide);

                    slides.push(slide);

                    //convert new question to a survey slide object and store in array.
                    //slides.push(convertQuestionToSurveySlide(sourceNode.id, question));

                    //add slide id to the category.slideList
                    category.slideList.push(sourceNode.id);
                });

                return slides;
            }

            /*
            	this function takes a source node, a list of target nodes and builds a question object
            	using a supplied template
            */
            function convertNodeToSlide(source, targets) {

                var attrMap = params.questionAttrMaps;
                var questTemplate = params.questionTemplate;

                var quesParams = {
                    source: source.attr[attrMap.srcAttr],
                    sourceSub: source.attr[attrMap.srcSubAttr] || null,
                    sourceTooltip: source.attr[attrMap.srcTooltipAttr] || null,
                    target: _.map(targets, function(t) {
                        return t.attr[attrMap.trgAttr]
                    }),
                    targetTooltip: _.map(targets, function(t) {
                        return t.attr[attrMap.trgTooltipAttr]
                    }).join('|')
                }

                var question = _.assign(_.clone(questTemplate), quesParams);


                var slideTemplate = {
                    id: 2,
                    titleText: "Question title is a long form of the question",
                    titleShortText: "Question ti..",
                    titleTooltipText: "This is a tooltip",
                    renderType: "matrix_radio",
                    answerOptions: {
                        cols: [{
                            descr: "Col-A",
                            value: "Col-A",
                            tooltip: 'col-tip-A'
                        }, {
                            descr: "Col-B",
                            value: "Col-B",
                            tooltip: 'col-tip-B'
                        }],
                        rows: [{
                            descr: "opt-1",
                            value: "opt-1",
                            tooltip: 'row-tip-1'
                        }, {
                            descr: "opt-2",
                            value: "opt-2",
                            tooltip: 'row-tip-2'
                        }]
                    },
                    required: true
                }

                var rows = []; //rows render the different answer descriptions (eg: issue A | issue B | issue C)
                _.each(targets, function(t) {
                    rows.push({
                        descr: t.attr[attrMap.trgAttr],
                        value: t.attr[attrMap.trgAttr],
                        tooltip: t.attr[attrMap.trgTooltipAttr]
                    })
                });

                var cols = []; //columns render the different answer choices (eg: increases | decreases | unchanged)
                _.each(question.effect.split('|'), function(col_Option) {
                    cols.push({
                        descr: col_Option,
                        value: col_Option,
                        tooltip: ""
                    })
                });

                var quesString = question.prefix.concat(' ', question.condition, ' ', question.source, ' ', question.conjunction);

                var slideParams = {
                    id: source.id,
                    titleText: quesString,
                    titleShortText: question.source,
                    titleSubText: question.sourceSub,
                    titleTooltipText: question.sourceTooltip,
                    renderType: params.questionType,
                    answerOptions: {
                        cols: cols,
                        rows: rows
                    },
                    required: typeof isRequired !== 'undefined' ? isRequired : false
                }

                return _.assign(_.clone(slideTemplate), slideParams);

            }

            function buildAndPublishSurvey(template, packets) {
                var newSt;
                orgFactory.currOrg()
                    .then(function(currentOrg) {

                        var surveyParams = {
                            surveyName: 'Autogenerated - New',
                            descr: 'Autogenerated from mapp',
                            org: {
                                ref: currentOrg._id,
                                orgName: currentOrg.orgName,
                                picture: null
                            },
                            owner: currentOrg.owner,
                            template: template,
                            //save so can reference in surveyTemplate list
                            noOfPackets: packets.length,
                            noOfQuesPerPacket: params.noOfQuesPerPacket,
                            noOfAnsPerQuestion: params.noOfAnsPerQuestion,
                            packets: packets,
                            dateCreated: Date.now()
                        };

                        var survey = _.assign(SurveySchema, surveyParams);
                        console.log(survey);

                        //needs to be modified - add / update sequence should be consolidated
                        surveyTemplateFactory.addSurveyTemplate(currentOrg._id, {
                                surveyName: surveyParams.surveyName,
                                descr: surveyParams.descr
                            })
                            .then(function(stDocs) {
                                surveyTemplateFactory.updateSurveyTemplate(currentOrg._id, stDocs._id, surveyParams)
                                    .then(function(updatedDoc) {

                                        //add to survey list in org
                                        if (updatedDoc._id) {
                                            var newSt = {
                                                ref: stDocs._id,
                                                surveyName: stDocs.surveyName,
                                                owner: {
                                                    ref: stDocs.owner.ref,
                                                    name: stDocs.owner.name,
                                                    email: stDocs.owner.email,
                                                    picture: stDocs.owner.picture
                                                },
                                                dateModified: stDocs.dateModified
                                            };
                                            currentOrg.surveyTemplates.unshift(newSt);
                                        }

                                        console.log(updatedDoc);

                                        surveyTemplateFactory.publishSurveyTemplate(currentOrg._id, stDocs._id)
                                            .then(function(result) {
                                                uiService.logUrl('Survey generated - click to view', 'https://koala.mappr.io/survey/' + updatedDoc._id);
                                            })
                                    });
                            });
                    });
            }

            //--------------------------------------
            // Distributing questions into packets
            // n nodes -> questions, (n-1) answers
            // p emails -> ques id, answer id

            //
            // The logic
            // nQ = num of questions
            // nA = num of answers per question
            // cQ = cursor for the question list and it points to the question node we are at
            // cA[nQ] = cursors for the answer list and it points to the answer node we are at per question
            // pN = packet num
            // stats[cQ][cA]

            // list of questions
            // find cQ -> cQ + 1,2,3...nQ
            // force cQ to be within bounds cQ mod nL

            // list of answers per question
            // loop
            // cA[cQ]++
            // cA[cQ] mod nA
            // make sure that the question node and the answer node doesnt coincide
            // if cA == cQ, shift forward. cA[cQ]++.

            // keep stats
            // stats[cQ][cA]++

            function distributeQA(nodeList, numPackets, numQuesPerPack, numAnsPerQues) {

                var nL = nodeList.length,

                    //num of packets
                    nP = numPackets,

                    //num of questions per survey
                    nQ = numQuesPerPack,

                    //num of answers per question
                    nA = numAnsPerQues,

                    //cursor for the question list and it points to the question node we are at
                    cQ = 0,

                    //cursors for the answer list and it points to the answer node we are at per question
                    cA = [],

                    //packet num
                    pN = 0,

                    //stats
                    stats = [],

                    //packet
                    pack = {};

                var i, j;

                // Initialize Arrays
                for (i = 0; i < nL; i++) {
                    //set initial cursors at 0
                    cA[i] = 0;

                    //set all stats[][] = 0
                    stats[i] = [];
                    for (j = 0; j < nL; j++) {
                        stats[i][j] = 0;
                    }
                }

                //printStats(stats);

                // packet loop
                var packets = [];
                for (var pC = 0; pC < nP; pC++) {

                    console.log('[mapp2survey] packet loop -------------------------', pC);

                    // question loop
                    var packetQuestions = [];
                    for (var offQ = 0; offQ < nQ; offQ++) {

                        // answers loop
                        var answerArr = Array.apply(null, Array(nL)).map(function() {
                            return 0
                        });
                        for (var offA = 0; offA < nA; offA++) {

                            //if answer index and question index is same shift cursor
                            if (cA[cQ] == cQ) {
                                cA[cQ]++;
                                if (cA[cQ] > nL - 1) cA[cQ] = 0;
                            }

                            var answerIndex = cA[cQ];
                            answerArr[answerIndex]++;

                            // update stats
                            stats[cQ][answerIndex]++;

                            // shift cursor
                            cA[cQ]++;
                            if (cA[cQ] > nL - 1) cA[cQ] = 0;
                        }

                        console.log('[mapp2survey] Q', cQ, '-> ', mapAnswerNodes(nodeList, answerArr));
                        packetQuestions.push({
                            ques: nodeList[cQ].id,
                            ans: mapAnswerNodes(nodeList, answerArr)
                        });

                        // update cursor
                        cQ++;
                        if (cQ > nL - 1) cQ = 0;
                    }

                    packets.push({
                        packetId: pC,
                        slides: _.clone(packetQuestions)
                    });
                    packetQuestions = [];
                    //printStats(stats);
                }

                //console.log(packets);
                return packets;
            }

            function mapAnswerNodes(nodesList, answerArr) {
                var answerNodeIds = _.compact(_.map(answerArr, function(isAnswerIncluded, index) {
                    return (isAnswerIncluded) ? nodesList[index].id : null;
                }));
                return answerNodeIds.join('|')
            }

            function printStats(stats) {
                console.log('[mapp2survey] new packet stats -------------------------------------');
                var nodeCount = 0;
                for (var i = 0; i < stats.length; i++) {
                    nodeCount = _.reduce(stats[i], function(total, n) {
                        return total + n;
                    });
                    console.log('[mapp2survey] Q', i, ':', nodeCount);
                    //console.log(stats[i].join(','));
                }
            }

			//random
            function distributeQA_random(nodes) {

                var packets = [];
                var slideIds = [];
                var nodeStats = {};
                _.each(nodes, function(nd) {
                    nodeStats[nd.id] = 0;
                });

                //per packet
                for (var i = params.noOfPackets - 1; i >= 0; i--) {

                    slideIds = [];

                    //sample a set of the sourceNodes
                    var sourceNodes = sampleNodes(nodes, params.noOfQuesPerPacket);
                    _.each(sourceNodes, function(nd) {
                        nodeStats[nd.id]++;
                    });

                    //for each source issue - find another sample of target issues to compare
                    _.each(sourceNodes, function(sourceNode) {
                        //console.log(sourceNode);
                        var targetNode = sampleNodes(_.reject(nodes, sourceNode), params.noOfAnsPerQuestion);
                        slideIds.push({
                            ques: sourceNode.id,
                            ans: _.pluck(targetNode, 'id').join('|')
                        });
                    });

                    packets.push({
                        packetId: i,
                        slides: slideIds
                    });
                };

                console.log("packets: ", packets);
                console.log(nodeStats);

                return packets;
            }

            function sampleNodes(nodes, numOfNodes) {
                //Fisher-Yates Shuffle + Random Sampling to remove bias
                var nodeArray = _.sample(_.shuffle(nodes), numOfNodes);
                return nodeArray;
            }

            //----------------------------------------------------


            //API
            this.renderSurvey = renderSurvey;

            var SurveySchema = {
                surveyName: 'Autogenerated',
                descr: 'Autogenerated',
                org: {
                    ref: null,
                    orgName: null,
                    picture: null
                },
                owner: {
                    ref: null,
                    email: null,
                    name: null,
                    picture: null
                },
                isPublished: false,
                isConcluded: false,
                useCoupons: false,
                metrics: {
                    viewCount: 0,
                    likes: 0
                },
                packets: null,
                template: {
                    base: "styleHC",
                    backgroundImage: null,
                    showIntro: false,
                    showInvite: false,
                    showTimeline: false,
                    showFaq: false,
                    hideProfile: true,
                    canAnswerAfterSubmission: false,
                    logo: null,
                    logoLink: null,
                    locale: "english",
                    showCatsInSlides: true,
                    header: {
                        title: 'autogenerated',
                        titleHelper: 'survey',
                    },
                    categories: [{
                        id: null,
                        title: null,
                        renderStyle: {
                            col: '#fff',
                            bgCol: '#db1a57',
                            font1: '20px, arial,sans-serif',
                            font2: '15px, arial,sans-serif'
                        },
                        visible: true,
                        slideList: []
                    }],
                    slides: [{
                        id: null,
                        titleText: null,
                        titleShortText: null,
                        titleSubText: null,
                        titleHelpText: null,
                        renderType: null, //radio, check, range, text
                        required: false,
                        answerOptions: {
                            rows: [{
                                descr: null,
                                value: null
                            }],
                            cols: [{
                                descr: null,
                                value: null
                            }]
                        },
                        visible: true,
                    }]
                },
                rawDataSetRef: null,
                dateCreated: Date.now()
            };
        }
    ]);
