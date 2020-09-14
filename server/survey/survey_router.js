'use strict';

var _ = require('lodash'),
	express = require('express');

var controller    = require('./survey_controller'),
	commonRouter  = require('../common/common_routers');


var ensureAuth        = commonRouter.ensureAuthenticated,
	ensureAdminAccess = commonRouter.ensureAdminAccess;


//mounted on /api/orgs/:oid([a-z0-9]{24})/surveytemplates
var router = express.Router({mergeParams : true});

router
    .get('/',ensureAuth, controller.listOrgSurveyTemplates)
    .post('/', ensureAuth, writeAccess, controller.addOrgSurveyTemplate);


router.route('/:stid')
    .get(ensureAuth, readAccess, controller.readDoc)
    .post(ensureAuth, writeAccess, controller.updateDoc)
    .delete(ensureAuth, deleteAccess, controller.deleteDoc);

//categories
router
    .post('/:stid/categories', ensureAuth, writeAccess, controller.addSurveyCategory)
    .route('/:stid/categories/:catId')
        .post(ensureAuth, writeAccess, controller.updateSurveyCategory)
        .delete(ensureAuth, writeAccess, controller.removeSurveyCategory);

// slides
router
    .post('/:stid/slides', ensureAuth, writeAccess, controller.addSurveySlide)
    .route('/:stid/slides/:slideId')
        .post(ensureAuth, writeAccess, controller.updateSurveySlide)
        .delete(ensureAuth, writeAccess, controller.removeSurveySlide);

router.get('/:stid/publish', ensureAuth, writeAccess, controller.publishSurveyTemplate);
router.get('/:stid/conclude', ensureAuth, writeAccess, controller.concludeSurveyTemplate);

router.get('/:stid/data', ensureAuth, readAccess, controller.getSurveyData);
router.get('/:stid/xlsx', ensureAuth, readAccess, controller.getSurveyDataAsXLSX);

router.get('/:stid/analytics', ensureAuth, controller.getSurveyDataAnalytics);

router.post('/:stid/gencoupons', ensureAuth, writeAccess, controller.generateCoupons);
router.post('/:stid/xlsx', ensureAuth, writeAccess, controller.generateTemplateFromXLS);

module.exports = router;




function publicAccess (req, res, next) {
	if(true || req.surveyTemplate.isPublished){
		next();
	} else {
		res.json(403);
	}
}

function readAccess (req, res, next) {
	console.log(req.org.users.members, req.user._id);
	if(_.filter(req.org.users.members, {ref: req.user._id})){
		console.log('[surveyTemplateController] view access granted to user: ' + req.user.email);
		next();
	} else {
		res.json(403);
	}
}

function writeAccess (req, res, next) {
	console.log(req.org.users.members, req.user._id);
	if(	_.filter(
			req.org.users.members,
			function(member){
				return ((member.ref === req.user._id.toHexString()) && (member.permission === 'isEditor'));
			}
		))
	{
		console.log('[surveyTemplateController] edit access granted to editor: ' + req.user.email);
		next();
	} else {
		res.json(403);
	}
}

function deleteAccess (req, res, next) {
	if(req.org.owner.ref === req.user._id.toHexString()){
		console.log('[surveyTemplateController] deletion access granted to owner: ' + req.user.email);
		next();
	} else {
		res.json(403);
	}
}