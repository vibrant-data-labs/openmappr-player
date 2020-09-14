angular.module('common')
.factory('surveyTemplateFactory', ['$http','$q',
function($http, $q) {

    'use strict';


    /*************************************
    *************** API ******************
    **************************************/
    var API = {
        //list
        getOrgSurveyTemplates:  listSurveyTemplatesByOrgId,

        //read surveyTemplatedocument
        getSurveyTemplateDoc:   getSurveyTemplateDoc,
        getSurveyTemplateDocPublic: getSurveyTemplateDocPublic,

        //edit surveyTemplate
        addSurveyTemplate:      addNewSurveyTemplate,
        updateSurveyTemplate:   updateSurveyTemplate,
        removeSurveyTemplate:   removeSurveyTemplate,

        //edit slides
        addSlide:               addSlide,
        updateSlide:            updateSlide,
        removeSlide:            removeSlide,

        //edit Category
        addCategory:            addCategory,
        updateCategory:         updateCategory,
        removeCategory:         removeCategory,

        //publish
        publishSurveyTemplate:          publishSurveyTemplate,
        concludeSurveyTemplate:         concludeSurveyTemplate,
        generateSurveyTemplateCoupons : generateSurveyTemplateCoupons,

        //data
        writeData:              writeData,
        fetchData:              fetchData,
        getSurveyDataAnalytics: getDataAnalytics,
        getSurveyDataAsXLSX:    getDataAsXLSX,

        //current surveyTemplate
        currSurveyTemplate: function(){
            if(currSurveyTemplate){
                console.log('surveyTemplateFactory.currSurveyTemplate cached result');
                return $q.when(currSurveyTemplate);
            } else {
                console.log('surveyTemplateFactory.currSurveyTemplate promised result');
                return currSurveyTemplateDefer.promise;
            }
        }
    };




    /*************************************
    ********* Local Data *****************
    **************************************/
    var currSurveyTemplate = null;
    var currSurveyTemplateDefer = $q.defer();



    /*************************************
    ********* Core Functions *************
    **************************************/

    function changeSurveyTemplate(SurveyTemplate) {
        currSurveyTemplate = SurveyTemplate;
        currSurveyTemplateDefer.resolve(currSurveyTemplate);
        //console.log('[surveyTemplateFactory.changeSurveyTemplate] currSurveyTemplate: ' + JSON.stringify(currSurveyTemplate.surveyName));
    }

    //logged-in-user.must-have(ORG.readAccessProj)
    function listSurveyTemplatesByOrgId(orgId) {
        return $http.get('/api/orgs/' + orgId + '/surveytemplates')
        .then(function(response) {
            return response.data;
        });
    }

    //adds surveyTemplate to the organization
    //logged-in-user.must-have(ORG.writeAccessProj)
    function addNewSurveyTemplate(orgId, newSurveyTemplate) {
        var postData = {
            surveyName: newSurveyTemplate.surveyName,
            descr: newSurveyTemplate.descr,
            picture: newSurveyTemplate.picture,
            tags: newSurveyTemplate.tags
        };
        console.log('[surveyTemplateFactory.addNew]  ..');
        return $http.post('/api/orgs/' + orgId + '/surveytemplates', postData)
        .then(function(response) {
            console.log('[surveyTemplateFactory.addNew]  surveyName:[' + response.data.surveyName + '] added');
            //expect new surveyTemplate document
            changeSurveyTemplate(response.data);
            return response.data;
        });
    }
    //logged-in-user.must-have(ORG.readAccess)
    function getSurveyTemplateDoc(orgId, surveyTemplateId) {
        //returns a promise
        console.log('[surveyTemplateFactory.getSurveyTemplateDoc]');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId)
        .then(function(response) {

            //update current surveyTemplate
            changeSurveyTemplate(response.data);

            //expect new surveyTemplate document
            return response.data;
        });
    }

    //public access
    function getSurveyTemplateDocPublic(surveyId){
        console.log('[surveyTemplateFactory.getSurveyTemplateDocPublic]');
        return $http.get('/api/survey/' + surveyId)
        .then(function(response) {
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function generateSurveyTemplateCoupons(orgId, surveyTemplateId) {
        console.log('[surveyTemplateFactory.generateSurveyTemplateCoupons]');
        var postData = {noOfCoupons: 1500, couponCriteria: 0};

        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/gencoupons', postData)
        .then(function(response) {
            console.log('[surveyTemplateFactory.update] post success');
            //expect updated surveyTemplate document
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function updateSurveyTemplate(orgId, surveyTemplateId, updateParams) {

        var postData = updateParams;
        console.debug('updateParams', postData);

        //console.log('[surveyTemplateFactory.update] attempting surveyTemplate update -> ' + JSON.stringify(postData));
        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId, postData)
        .then(function(response) {
            console.log('[surveyTemplateFactory.update] post success');
            //expect updated surveyTemplate document
            return response.data;
        });
    }

    //logged-in-user.must-have(ORG.deleteAccess)
    function removeSurveyTemplate(orgId, surveyTemplateId) {
        return $http.delete('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId)
        .then(function(response) {
            console.log('[surveyTemplateFactory.removeSurveyTemplate]  surveyTemplateId:[' + surveyTemplateId + ']');
            return response.data;
        });
    }

    //logged-in-user.must-have(ORG.writeAccess)
    function addCategory(orgId, surveyTemplateId) {
        var postData = {};

        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/categories', postData)
        .then(function(response) {
            //console.log('[surveyTemplateFactory.addCategory] success');
            //expect the updated list of Categories
            //console.log(response.data);
            return response.data;
        });
    }

    //logged-in-user.must-have(ORG.writeAccess)
    function updateCategory(orgId, surveyTemplateId, categoryId, categoryParams) {
        //console.log(categoryParams);
        var postData = categoryParams;
        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/categories/' + categoryId, postData).then(function(response) {
            //console.log('[surveyTemplateFactory.updateCategory] post success');
            //expect the updated category
            return response.data;
        });
    }

    //logged-in-user.must-have(ORG.writeAccess)
    function removeCategory(orgId, surveyTemplateId, categoryId) {
        return $http.delete('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/categories/' + categoryId)
        .then(function(response) {
            console.log('[surveyTemplateFactory.update] delete success. reponse: %O', response.data);
            //expect the deletion index
            return response.data;
        });
    }

    //logged-in-user.must-have(ORG.writeAccess)
    function addSlide(orgId, surveyTemplateId, slideParams){
        var postData = slideParams && {
            'categoryRef': slideParams.categoryRef,
            'titleText': slideParams.titleText,
            'titleShortText': slideParams.titleShortText,
            'titleSubText': slideParams.titleSubText,
            'titleHelpText': slideParams.titleHelpText,
            'renderType': slideParams.renderType,
            'answerOptions': slideParams.answerOptions,
            'visible': slideParams.visible,
            'required': slideParams.required
        };

        console.log('[surveyTemplateFactory.create] attempting to add a slide -> %O', postData);
        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/slides', postData)
        .then(function(response) {
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function updateSlide(orgId, surveyTemplateId, slideNum, slideParams){
        var postData = slideParams && {
            'categoryRef': slideParams.categoryRef,
            'titleText': slideParams.titleText,
            'titleShortText': slideParams.titleShortText,
            'titleSubText': slideParams.titleSubText,
            'titleHelpText': slideParams.titleHelpText,
            'renderType': slideParams.renderType,
            'answerOptions': slideParams.answerOptions,
            'visible': slideParams.visible,
            'required': slideParams.required
        };
        //console.log('[surveyTemplateFactory.updateSlide] attempting to update a slide -> %O', postData);
        return $http.post('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/slides/' + slideNum, postData)
        .then(function(response) {
            //expect updated slide
            return response.data;
        });
    }

    //logged-in-user.must-have(PROJ.writeAccess)
    function removeSlide(orgId, surveyTemplateId, slideNum){
        console.log('[surveyTemplateFactory.removeSlide] attempting to remove a slide -> ' + slideNum);
        return $http.delete('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/slides/' + slideNum)
        .then(function(response) {
            console.log('[surveyTemplateFactory.removeSlide] slide removed -> ' + JSON.stringify(response.data));
            return response.data;
        });
    }

    function publishSurveyTemplate(orgId, surveyTemplateId){
        console.log('[surveyTemplateFactory.publishTemplate]');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/publish')
        .then(function(response) {
            console.log('[surveyTemplateFactory.publishTemplate] published with data reference ' + response.data);
            return response.data;
        });
    }



    function concludeSurveyTemplate(orgId, surveyTemplateId){
        console.log('[surveyTemplateFactory.concludeTemplate]');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/conclude')
        .then(function(response) {
            console.log('[surveyTemplateFactory.concludeTemplate] concluded with data reference ' + response.data);
            return response.data;
        });
    }


    function fetchData(orgId, surveyTemplateId){
        console.log('[surveyTemplateFactory.fetchData] retrieve survey responses');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/data')
        .then(function(response){
            //console.log(response);
            return response.data;
        });
    }

    function getDataAsXLSX(orgId, surveyTemplateId){
        console.log('[surveyTemplateFactory.getDataAsXLSX] retrieve survey responses as xlsx');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/xlsx')
        .then(function(response){
            return response.data;
        });
    }

    function getDataAnalytics(orgId, surveyTemplateId){
        console.log('[surveyTemplateFactory.getDataAnalaytics] retrieve survey analytics');
        return $http.get('/api/orgs/' + orgId + '/surveytemplates/' + surveyTemplateId + '/analytics')
        .then(function(response){
            return response.data;
        });
    }

    function writeData(surveyTemplateId, data){
        console.log('[surveyTemplateFactory.writedata]');
        var postData = data;
        return $http.post('/api/survey/' + surveyTemplateId + '/data', postData)
        .then(function(response) {
            console.log('[surveyTemplateFactory.writedata] ' + response.data);
            return response.data;
        });
    }

    return API;
}
]);