angular.module('mappr')
.controller('sortableController',['$scope', '$route', 'orgFactory', 'surveyTemplateFactory',
function($scope, $route, orgFactory, surveyTemplateFactory) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var currSurvey = null;
    var categoryListTemp = [];

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.sortingLog = [];

    $scope.sortableCatOptions = {
        activate: function() {
            //console.log("activate");
        },
        beforeStop: function() {
            //console.log("beforeStop");
        },
        change: function() {
            //console.log("change");
        },
        create: function() {
            //console.log("create");
        },
        deactivate: function() {
            //console.log("deactivate");
            // $route.reload();
        },
        out: function() {
            //console.log("out");
        },
        over: function() {
            //console.log("over");
        },
        receive: function() {
            //console.log("receive");
        },
        remove: function() {
            //console.log("remove");
        },
        sort: function() {
            //console.log("sort");
        },
        start: function() {
            //console.log("start");
        },
        update: function() {
            console.log("update");
            var logEntry = categoryListTemp.map(function(i) {
                return (typeof i !== "undefined" && i)? i.id : 'blip';
            }).join(', ');
            console.log('category list -> ' + logEntry);
        },
        stop: function() {
            console.log("stop");
            var logEntry = categoryListTemp.map(function(i) {
                return (typeof i !== "undefined" && i)? i.id : 'blip';
            }).join(', ');
            console.log('category list -> ' + logEntry);
            // this callback has the changed model

            //categoryListTemp = _.filter(categoryListTemp, function(cat){return typeof cat !== "undefined" && cat !== null;});
            //currSurvey.template.categories = categoryListTemp;

            orgFactory.currOrg()
            .then(function(orgDocs){
                //there can be contamination during DOM manipulation
                var sanitizedCategoryListTemp = _.filter(categoryListTemp, function(cat){return typeof cat !== "undefined" && cat !== null;});
                return surveyTemplateFactory.updateSurveyTemplate(orgDocs._id, currSurvey._id, {categories: sanitizedCategoryListTemp});
                //$route.reload();
            })
            .then(function(stDocs) {
                console.log(stDocs.template.categories);
            });
        }
    };

    $scope.sortableSlideOptions = {
        stop: function() {

            orgFactory.currOrg()
            .then(function(orgDocs){
                return surveyTemplateFactory.updateSurveyTemplate(orgDocs._id, currSurvey._id, {categories: $scope.categoryList});
            })
            .then(function(stDocs) {
                console.log(stDocs.template.categories);
            });
        }
    };

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    surveyTemplateFactory.currSurveyTemplate()
    .then(function(stDocs){
        currSurvey = stDocs;
        categoryListTemp = stDocs.template.categories;
        $scope.categoryList = categoryListTemp;
        console.log('categories found %O', categoryListTemp);
    });



    /*************************************
    ********* Core Functions *************
    **************************************/


}
]);