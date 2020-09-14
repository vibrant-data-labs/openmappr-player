'use strict';
var path = require('path');

var authRouter = require('./auth/auth_router'),
    userRouter = require('./user/user_router'),
    orgRouter  = require('./org/org_router'),
    recipeRouter  = require('./recipe/recipe_router'),
    projRouter  = require('./project/proj_router'),
    datasysRouter  = require('./datasys/datasys_router'),
    diRouter  = require('./datasys/di_router'),
    uploadsRouter  = require('./datasys/uploads_router'),
    snapRouter  = require('./snapshot/snapshot_router'),
    playerRouter  = require('./player/player_router'),
    playerTopRouter  = require('./player/player_top_router'),
    dataApiRouter  = require('./data_api/data_api_router'),
    scriptStoreRouter  = require('./scriptStore/scriptStore_router'),
    commonOpsRouter = require('./commonOps/commonOps_router'),
    adminRouter = require('./admin_router');


var orgModel = require('./org/org_model'),
    projModel = require('./project/proj_model'),
    playerModel = require('./player/player_model'),
    surveyTemplateModel = require("./survey/surveyTemplateModel.js"),
    recipeModel = require("./recipe/recipe_model.js");

var playerController = require('./player/player_controller');
var sourceFinder = require('./source_finder/process');
var emailService = require("./services/EmailService.js");

var miscRoutes = require('./misc_routes');



function setupRoutes (app) {
    // mount data router on project, listens to /dataset and /network requests
    projRouter.use('/:pid([0-9a-fA-F]{24})', setupParams(datasysRouter));
    projRouter.use('/:pid([0-9a-fA-F]{24})/common_ops', setupParams(commonOpsRouter));
    // di router
    projRouter.use('/:pid([0-9a-fA-F]{24})/di', setupParams(diRouter));

    projRouter.use('/:pid([0-9a-fA-F]{24})/snapshots', setupParams(snapRouter));
    projRouter.use('/:pid([0-9a-fA-F]{24})/players', setupParams(playerRouter));

    // moute proj, recipe and data router on organization
    orgRouter.use('/:oid([0-9a-fA-F]{24})/projects', setupParams(projRouter));
    orgRouter.use('/:oid([0-9a-fA-F]{24})/recipes', setupParams(recipeRouter));
    orgRouter.use('/:oid([0-9a-fA-F]{24})/uploads', setupParams(uploadsRouter));
    orgRouter.use('/:oid([0-9a-fA-F]{24})/scripts', setupParams(scriptStoreRouter));

    app
        .use('/auth' ,setupParams(authRouter))
        .use('/api/users', setupParams(userRouter))
        .use('/api/orgs', setupParams(orgRouter))
        .use('/api/players', setupParams(playerTopRouter))
        .use('/api/admin', setupParams(adminRouter));
        // .use('/api/org_admin', setupParams(orgAdminRouter));

    app.use('/data_api', dataApiRouter);
    // For finding sources which provide maximun resources needed
    app.post('/get_sources_sheet', sourceFinder.getSheetWithMatches);
    app.post('/get_clean_sheet', sourceFinder.getCleanSheet);

    // send email route
    app.post('/support', emailService.sendSupportEmail);

    // setup misc routes like athena / elasticsearch / jobs / maintenenaces and so on
    miscRoutes(app);

    // Ping
    app.get('/heartbeat', (req, res) => res.status(200).send('beating'));

    // admin
    // app.get('/admin/*', (req, res) => res.render(path.join('./', req.url)));

    // partials
    app.get('/partials/*', function renderPartials(req, res) {
        var requestedView = path.join('./', req.url);
        // console.log(requestedView);
        res.render(requestedView, function(err, html) {
            if(err) return console.error(err);
            res.send(html);
        });
    });

    // user-projects / projects
    app.get('/user-projects', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });
    app.get('/recipes/*', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });
    app.get('/recipes', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });
    app.get('/projects/*', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });
    app.get('/admin', ensureLoggedIn, (req,res) => {
        if(req.user && req.user._isAdmin) {
            return res.render('index_mappr.jade');
        }
        else {
            return res.redirect('/');
        }
    });
    app.get('/owner', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });
    app.get('/signup-org', (req,res) => { res.render('index_mappr.jade'); });
    app.get('/signin-org', (req,res) => { res.render('index_mappr.jade'); });
    app.get('/reset_password', (req,res) => {
        if(req.query.expire < Date.now()) {
            res.render('linkExpired.jade');
        }
        else {
            res.render('index_mappr.jade');
        }
    });
    app.get('/user-profile', ensureLoggedIn, (req,res) => { res.render('index_mappr.jade'); });

    //pattern library
    app.get('/pattern-library', (req,res) => { res.render('index_mappr.jade'); });

    // index
    app.get('/', function(req, res) {
        var role = 'anon',
            _id = '';
        // if a user exists, then set the cookie
        if (req.user) {
            return res.redirect('/user-projects');
            // console.log("[main_router] '/*' path has a user!. where did this come form!!!");
            // role = req.user.role;
            // _id = req.user._id;
            // console.log('[routes/*] req.user: '+ _id);
        }
        res.cookie('user', JSON.stringify({
            '_id': _id,
            'role': role
        }));
        // console.log('[routes /*] referrer: ',req.headers.referer);
        res.render('index_mappr.jade');
    });

    app.get('/play/*', playerController.renderPlayer);
    app.get('/survey/*', (req, res) => { res.render('survey.jade'); });
    app.get('/getsources', (req, res) => { res.render("index_sources.jade"); });
}
function ensureLoggedIn(req, res, next) {
    if(req.user && req.user._id) { return next(); }
    res.cookie('user', JSON.stringify({
        '_id': 'anon',
        'role': ''
    }));
    res.redirect('/');
}


//
// Setup Params like :oid / :pid / :plid
//
function setupParams (router) {
    // org injection
    router.param('oid', function(req, res, next, id) {
        //validate org id
        // console.log("[ROUTE.param] --------------------------------");
        // console.log("[ROUTE.param] Validating org id");
        orgModel.listById(req.params.oid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: org not found: ", err);
            }
            if (!docs || docs.length === 0) {
                console.error('[ROUTE.param] org [id: ' + req.params.oid + '] not found!');
                res.status(404).send("Error: org not found");
            } else {
                req.org = docs;
                console.log('[ROUTE.param] org [id: ' + req.org._id + '] found!');
                next();
            }
        });
    });
    // project injection
    router.param('pid', function(req, res, next, id) {
        //validate project id
        // console.log("[ROUTE.param] ---------------------------------");
        // console.log("[ROUTE.param] validating project id.", req.params.pid);
        projModel.listById(req.params.pid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: project not found: ", err);
            }
            if (!docs || !docs._id) {
                console.log('[ROUTE.param] Project [id: ' + req.params.pid + '] not found!');
                res.status(404).send("Error: Project not found");
            } else {
                req.project = docs;
                console.log('[ROUTE.param] Project [id: ' + req.project._id + '] found!');
                next();
            }
        });
    });
    //player injection
    router.param('plid', function(req, res, next, id) {
        //validate player id
        // console.log("[ROUTE.param] --------------------------------");
        // console.log("[ROUTE.param] Validating player id");
        playerModel.listById (req.params.plid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: Player not found: ", err);
            }
            if (!docs || docs.length === 0) {
                console.log('[ROUTE.param] Player [id: ' + req.params.plid + '] not found!');
                return res.status(404).send("Error: Player not found");
            }
            req.player = docs;
            console.log('[ROUTE.param] Player [id: ' + req.player._id + '] found!');
            next();
        });
    });

    router.param('stid', function(req, res, next, id) {
        //validate project id
        // console.log("[ROUTE.param] ---------------------------------");
        // console.log("[ROUTE.param] validating survey template id.");
        surveyTemplateModel.read(req.params.stid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: Survey not found: ", err);
            }
            if (!docs || docs.length === 0) {
                console.log('[ROUTE.param] Survey [id: ' + req.params.stid + '] not found!');
                //next();
                res.send(404, "Error: Survey not found");
            } else {
                req.surveyTemplate = docs;
                console.log('[ROUTE.param] Survey [id: ' + req.surveyTemplate._id + '] found!');
                next();
            }
        });
    });

    router.param('recipeid', function(req, res, next, id) {
        //validate project id
        // console.log("[ROUTE.param] ---------------------------------");
        // console.log("[ROUTE.param] validating recipe id.");
        recipeModel.listById(req.params.recipeid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: Recipe not found: ", err);
            }
            if (!docs || docs.length === 0) {
                console.log('[ROUTE.param] Recipe [id: ' + req.params.recipeid + '] not found!');
                res.send(404, "Error: Recipe not found");
            } else {
                req.recipe = docs;
                console.log('[ROUTE.param] Recipe [id: ' + req.recipe._id + '] found!');
                next();
            }
        });
    });
    return router;
}


module.exports = setupRoutes;
