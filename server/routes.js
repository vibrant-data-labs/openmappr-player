"use strict";

var _ = require('lodash'),
    path = require('path'),
    passport = require('passport'),
    authController = require('./controllers/authController.js'),
    dataController = require('./controllers/dataController.js'),
    dataIngestionController = require('./controllers/dataIngestionController.js'),
    maintenanceController = require('./controllers/maintenanceController.js'),
    playerController = require('./controllers/playerController.js'),
    projController = require('./controllers/projController.js'),
    DSModelController = require('./controllers/DSModelController.js'),
    userController = require('./controllers/userController.js'),
    adminController = require('./controllers/adminController.js'),
    orgController = require('./controllers/orgController.js'),
    svgRenderController = require('./controllers/svgRenderController.js'),
    surveyTemplateController = require('./controllers/surveyTemplateController.js'),
    jobController = require('./controllers/jobController'),
    athenaController = require('./controllers/athenaController'),

    orgModel =   require("./models/orgModel.js"),
    db = require('./db.js');
    db_old = require('./db_old.js');

    var flash = require('connect-flash');

/*
    DESIGN NOTES (Draft)
    1.Routes will maintain the parent child entity relationship
        eg. Users and Orgs are high level entities
            Projects belong to Orgs
            To access projects, orgs have to be pinged.
            Will draw up the entity relationship soon.
    2.Routes will have enough information to authorize access to an entity.
        Logged in user info is available to us at all points and will not be
        captured in the route.
    4.Authorization happens at two levels
        level 1 (Router) - protect end points against user type (anon, user, admin).
        This does not require detailed knowledge of the entity itself, but simply the type. can an anonymous user access resource1?
        Level 2 (Controller) - protect entity with access information. does logged in userA have access to project1?
        The information required for performing level2 authorization in contained in the entity to be accessed.
    5.Routes will validate and pass on the query to the entity controller.
*/

var routes = [
    // {
    //     path: '/partials/*',
    //     httpMethod: 'GET',
    //     middleware: [
    //         function(req, res) {
    //             var requestedView = path.join('./', req.url);
    //             console.log(requestedView);
    //             res.render(requestedView, function(err, html) {
    //                 if(err) console.error(err);
    //                 else res.send(html);
    //             });
    //         }
    //     ]
    // },

    // {
    //     path: '/admin/*',
    //     httpMethod: 'GET',
    //     middleware: [
    //         // ensureAuthenticated,
    //         function(req, res) {
    //             var requestedView = path.join('./', req.url);
    //             //console.log(requestedView);
    //             res.render(requestedView);
    //         }
    //     ]
    // },

    // // ----------- Ping
    // {
    //     path: '/heartbeat',
    //     httpMethod: 'GET',
    //     middleware: [
    //         function(req, res) {
    //             res.send(200, 'beating');
    //         }
    //     ]
    // },

    // ----------- Auth
    // {
    //     path: '/auth/logout',
    //     httpMethod: 'GET',
    //     middleware:[
    //         function(req, res) {
    //             req.user = null;
    //             console.log(req.session);
    //             req.logout();
    //             console.log('logged out');
    //             console.log('-------------- req.session: ', req.session);
    //             res.send(200, 'logged out');
    //         }
    //     ]
    // },

    // // =============================================================================
    // // AUTHENTICATE (FIRST LOGIN) ==================================================
    // // =============================================================================

    // // locally --------------------------------
    // {
    //     path: '/auth/register',
    //     httpMethod: 'POST',
    //     middleware: [
    //         function(req, res, next) {
    //             passport.authenticate('local-signup', function(err, user, info) {
    //                 if (err) {
    //                     return next(err);
    //                 }
    //                 if (!user) {
    //                     return res.redirect('/signup');
    //                 }
    //                 req.logIn(user, function(err) {
    //                     if (err) {
    //                         return next(err);
    //                     }
    //                     user.local.password = null;
    //                     req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7;
    //                     return res.send(user);

    //                 });

    //             })(req, res, next);
    //         }
    //     ]
    // },

    // {
    //     path: '/auth/local',
    //     httpMethod: 'POST',
    //     middleware:[
    //         function(req,res,next){console.log('[route] /auth/local'); next();},
    //         function(req, res, next) {
    //             passport.authenticate('local-login', function(err, user, info) {
    //                 if (err) {
    //                     return next(err);
    //                 }
    //                 if (!user) {
    //                     return res.redirect('/signup');
    //                 }
    //                 req.logIn(user, function(err) {
    //                     if (err) {
    //                         return next(err);
    //                     }
    //                     user.local.password = null;
    //                     console.log('--------------logged in - req.session---------', req.session);
    //                     req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7;
    //                     return res.send(user);
    //                 });

    //             })(req, res, next);
    //         }
    //     ]
    // },

    // // facebook -------------------------------
    // {
    //     path: '/auth/facebook',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('facebook', { scope : 'email' })
    //     ]
    // },

    // // handle the callback after facebook has authenticated the user
    // {
    //     path: '/auth/facebook/callback',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('facebook', {
    //             successRedirect : '/user-projects',
    //             failureRedirect : '/'
    //         })
    //     ]
    // },

    // // twitter --------------------------------
    // {
    //     path: '/auth/twitter',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('twitter')
    //     ]
    // },

    // // handle the callback after twitter has authenticated the user
    // {
    //     path: '/auth/twitter/callback',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('twitter', {
    //             successRedirect : '/user-projects',
    //             failureRedirect : '/'
    //         })
    //     ]
    // },

    // // google ---------------------------------
    // // send to google to do the authentication
    // // profile gets us their basic information including their name
    // // email gets their emails
    // {
    //     path: '/auth/google',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('google', { scope : ['profile', 'email'] })
    //     ]
    // },

    // // the callback after google has authenticated the user
    // {
    //     path: '/auth/google/callback',
    //     httpMethod: 'GET',
    //     middleware:[
    //         passport.authenticate('google', {
    //             successRedirect : '/user-projects',
    //             failureRedirect : '/'
    //         })
    //     ]
    // },

    // // linkedIn Auth ---------------------------------
    // //
    // // Authentication system
    // {
    //     path: '/auth/linkedin',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, dataIngestionController.genLinkedInAuthUrl]
    // },
    // {
    //     path: '/auth/linkedin/callback',
    //     httpMethod: 'GET',
    //     middleware:[
    //         dataIngestionController.onLinkedInCallback
    //     ]
    // },
    // ----------- Athena routs
    // {
    //     path: '/athena/algos',
    //     httpMethod: 'GET',
    //     middleware: [athenaController.listAlgo]
    // },
    // {
    //     path: '/athena/algo',
    //     httpMethod: 'POST',
    //     middleware: [athenaController.create]
    // },

    // ----------- User (FIRST CLASS CITIZENS)

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, userController.readDoc]
    // },

    // {
    //     path: '/api/users/:uname',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, userController.readDoc]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})',
    //     httpMethod: 'PUT',
    //     middleware: [ensureAuthenticated, userController.updateDoc]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, userController.deleteDoc]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/orgs',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, userController.listUserOrgs]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/orgs/:oid([a-z0-9]{24})/accept/:inviteToken',
    //     httpMethod: 'GET',
    //     middleware: [userController.acceptOrgInvite]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/orgs/:oid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, userController.leaveOrg]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/projects',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, userController.listUserProjects]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/accept/:inviteToken',
    //     httpMethod: 'GET',
    //     middleware: [userController.acceptProjectInvite]
    // },

    // {
    //     path: '/api/users/:uid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, userController.leaveProject]
    // },

    // ----------- Org (FIRST CLASS CITIZENS)

    {
        path: '/api/orgs',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, orgController.create]
    },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, orgController.readDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projectsDetails',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, orgController.readOrgProjectsDetails]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveysDetails',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, orgController.readOrgSurveysDetails]
    // },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/profile',
        httpMethod: 'GET',
        middleware: [orgController.readPublicProfile]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})',
        httpMethod: 'PUT',
        middleware: [ensureAuthenticated, orgController.updateDoc]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})',
        httpMethod: 'DELETE',
        middleware: [ensureAuthenticated, orgController.removeDoc]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/members',
        httpMethod: 'GET',
        middleware: [ensureAuthenticated, orgController.listOrgMembers]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/members',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, orgController.addOrgMember]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/members/:memberId([a-z0-9]{24})',
        httpMethod: 'PUT',
        middleware: [ensureAuthenticated, orgController.updateOrgMember]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/members/:memberId([a-z0-9]{24})',
        httpMethod: 'DELETE',
        middleware: [ensureAuthenticated, orgController.removeOrgMember]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/invite',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, orgController.addOrgPending]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/invite/:inviteToken',
        httpMethod: 'DELETE',
        middleware: [ensureAuthenticated, orgController.removeOrgPending]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/projects',
        httpMethod: 'GET',
        middleware: [ensureAuthenticated, orgController.listOrgProjects]
    },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, orgController.addOrgProject]
    // },

    // ----------- Projects (OWNED BY ORG)

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, projController.readDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/settings',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateProjSettings]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, projController.deleteDoc]
    // },
    // // clone
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/clone',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.clone]
    // },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/cloneToOrg',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, projController.cloneToOrg]
    },
    // Useless routes
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/users',
        httpMethod: 'GET',
        middleware: [ensureAuthenticated, projController.listProjectMembers]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/invite/:uid([a-z0-9]{24})',
        httpMethod: 'GET',
        middleware: [ensureAuthenticated, projController.inviteProjectMember]
    },

    {
        path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/kickout/:uid([a-z0-9]{24})',
        httpMethod: 'GET',
        middleware: [ensureAuthenticated, projController.removeProjectMember]
    },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.addProjectVersion]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateProjectVersion]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, projController.removeProjectVersion]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/restore',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, projController.restoreProjectVersion]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/data',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, projController.getProjectData]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/csv',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, projController.getProjectVersionDataAsCSV]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/xlsx',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, projController.getProjectDataAsXLSX]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/data',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.addDataToProjectVersion]
    // },

    //
    // TODO : Better way to do this
    // SVG renderer area
    //
    // {
    //     path: '/api/svg_render',
    //     httpMethod: 'POST',
    //     middleware: [ svgRenderController.rendersvg ]
    // },
    // {
    //     path: '/api/svg_get/:svg_id',
    //     httpMethod: 'GET',
    //     middleware: [ svgRenderController.getSvg ]
    // },

    // // @CHECKPOINT need to decide an appropriate route for this
    // // and also appropriate access levels
    // // Tested via POSTMAN and it works well
    // {
    //     path: '/api/elasticsearch/search_nodes',
    //     httpMethod: 'GET',
    //     middleware: [ projController.searchNodes ]
    // },
    // {
    //     path: '/api/elasticsearch/ping',
    //     httpMethod: 'GET',
    //     middleware: [ projController.pingSearchServer ]
    // },
    // {
    //     path: '/api/elasticsearch/reindex/:project_id',
    //     httpMethod: 'GET',
    //     middleware: [ DSModelController.reIndexDataset ]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset',
    //     httpMethod: 'GET',
    //     middleware: [DSModelController.getDataset]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset/savedata',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.validateAndStoreData]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset/data',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.saveDataToProject]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks',
    //     httpMethod: 'GET',
    //     middleware: [DSModelController.getAllNetworks]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/nwdownload',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.downloadNetworksData]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/changescope',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.changeAttrsScope]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid',
    //     httpMethod: 'GET',
    //     middleware: [DSModelController.getNetwork]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.updateNetwork]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, DSModelController.deleteNetwork]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid/nwattrs',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.updateNetworkAttrs]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid/sub_graph',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.createNetworkFromSubGraph]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset/dsattrs',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.updateDatasetAttrs]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset/gen_attr',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.addAttributeToDataset]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/dataset/datapoints/update_attr_cat_names',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.updateAttrCategoriesForDataset]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/networks/:nwid/nodes/update_attr_cat_names',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, DSModelController.updateAttrCategoriesForNetworkNodes]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/savedata',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.saveDataToProjectVersion]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/versions/:vnum/attrs',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateProjectDataAttrs]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/layers',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.addProjectLayer]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/snapshots',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.addProjectSnapshot]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/snapshots/sequence',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateProjectSnapshotSequence]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/snapshots/update_players',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateSnapshotsInPlayers]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/snapshots/:snapId',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, projController.updateProjectSnapshot]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/snapshots/:snapId',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, projController.removeProjectSnapshot]
    // },

    // ----------- Datasets (OWNED BY ORGS)
    // not working
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/dataset/:dsid([a-z0-9]{24})/attrs',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, dataController.updateDataAttrs]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/dataset/:dsid([a-z0-9]{24})',
        httpMethod: 'POST',
        middleware: [ensureAuthenticated, dataController.addData]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/dataset/:dsid([a-z0-9]{24})/node/:nodeId',
        httpMethod: 'DELETE',
        middleware: [ensureAuthenticated, dataController.removeNode]
    },
    {
        path: '/api/orgs/:oid([a-z0-9]{24})/dataset/:dsid([a-z0-9]{24})/edge/:edgeId',
        httpMethod: 'DELETE',
        middleware: [ensureAuthenticated, dataController.removeEdge]
    },
    // //
    // //  ----------- Data Ingestion
    // //
    // // linkedIn ingestion
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/linkedin',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.importLinkedInContent]
    // },
    // // import.io ingestion
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/importio',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.importImportIO]
    // },
    // // Alchemy ingestion
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/alchemyapi',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.runAlchemy]
    // },
    // // Alchemy news generator
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/alchemynews',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.importAlchemyNews]
    // },
    // // Merge Algo
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/mergedata',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.mergeNetworkData]
    // },
    // // Merge Algo
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/di/merge_stats',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, dataIngestionController.mergeStats]
    // },


    // ----------- Player (OWNED BY ORGS)

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, playerController.readByProjId]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, playerController.create]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, playerController.read]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, playerController.update]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid/finalise',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, playerController.finalisePlayer]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid/regenToken',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, playerController.regenerateAccessToken]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid/isDisabled',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, playerController.updateDisabledStatus]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/players/:plid',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, playerController.delete]
    // },



    // PLAYER
    // // this path has been changed to /api/players
    // {
    //     path: '/api/players/:urlStr',
    //     httpMethod: 'GET',
    //     middleware: [playerController.readByUrl]
    // },
    // // not used, won't work
    // {
    //     path: '/api/players/:plid([a-z0-9]{24})/data',
    //     httpMethod: 'GET',
    //     middleware: [playerController.readData]
    // },

    // {
    //     path: '/api/players/checkurlavailable',
    //     httpMethod: 'POST',
    //     middleware: [playerController.checkUrlAvailable]
    // },

    // SURVEY
    // {
    //     path: '/survey/*',
    //     httpMethod: 'GET',
    //     middleware: [
    //         function(req, res) {
    //             res.render('survey.jade');
    //         }
    //     ]
    // },


    // SURVEY owned by org
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, orgController.listOrgSurveyTemplates]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, orgController.addOrgSurveyTemplate]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.readDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.updateDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, surveyTemplateController.deleteDoc]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/categories',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.addSurveyCategory]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/categories/:catId',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.updateSurveyCategory]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/categories/:catId',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, surveyTemplateController.removeSurveyCategory]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/slides',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.addSurveySlide]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/slides/:slideId',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.updateSurveySlide]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/slides/:slideId',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, surveyTemplateController.removeSurveySlide]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/publish',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.publishSurveyTemplate]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/conclude',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.concludeSurveyTemplate]
    // },

    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/data',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.getSurveyData]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/xlsx',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.getSurveyDataAsXLSX]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/analytics',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, surveyTemplateController.getSurveyDataAnalytics]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/gencoupons',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.generateCoupons]
    // },
    // {
    //     path: '/api/orgs/:oid([a-z0-9]{24})/surveytemplates/:stid([a-z0-9]{24})/xlsx',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.generateTemplateFromXLS]
    // },

    //all data submissions / survey view delegated to the the dedicated koala server

    // {
    //     path: '/api/survey/:stid([a-z0-9]{24})/slides/:slideId/token/:tokenId/response',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, surveyTemplateController.submitSurveyData]
    // },

    // {
    //     path: '/api/survey/:stid([a-z0-9]{24})/data',
    //     httpMethod: 'POST',
    //     middleware: [surveyTemplateController.addData]
    // },

    // {
    //     path: '/api/survey/:stid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [surveyTemplateController.getSurveyTemplateById]
    // },

    // {
    //     path: '/survey/*',
    //     httpMethod: 'GET',
    //     middleware: [
    //         function(req, res) {
    //             var requestedView = path.join('./views/', req.url);
    //             console.log(requestedView);
    //             res.render('survey.jade');
    //         }
    //     ]
    // },

    //rawDataSet owned by org
    // {
    //     path: '/api/data',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, orgController.addOrgRawDataSet]
    // },

    // ----------- ADMIN API ------------

    // {
    //     path: '/api/admin/orgs',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, adminController.listAllOrgs]
    // },

    // {
    //     path: '/api/admin/org/:oname',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, orgController.readDoc]
    // },

    // {
    //     path: '/api/admin/org/:oid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, orgController.readDoc]
    // },

    // {
    //     path: '/api/admin/users',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, userController.create]
    // },

    // {
    //     path: '/api/admin/users',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, userController.listAll]
    // },

    // {
    //     path: '/api/admin/users/:uid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, userController.readDoc]
    // },
    // {
    //     path: '/api/admin/projects',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, projController.create]
    // },

    // {
    //     path: '/api/admin/projects',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, projController.listAll]
    // },

    // {
    //     path: '/api/admin/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, projController.readDoc]
    // },

    // {
    //     path: '/api/admin/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'POST',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, projController.updateDoc]
    // },

    // {
    //     path: '/api/admin/projects/:pid([a-z0-9]{24})',
    //     httpMethod: 'DELETE',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, projController.deleteDoc]
    // },

    // {
    //     path: '/api/admin/players',
    //     httpMethod: 'GET',
    //     middleware: [ensureAuthenticated, ensureAdminAccess, playerController.listAll]
    // },

    // {
    //     path: '/api/jobs',
    //     httpMethod: 'GET',
    //     middleware: [jobController.find]
    // },
    // {
    //     path: '/api/jobs',
    //     httpMethod: 'POST',
    //     middleware: [jobController.create]
    // },
    // {
    //     path: '/api/jobs/dummy',
    //     httpMethod: 'GET',
    //     middleware: [jobController.dummy]
    // },
    // {
    //     path: '/api/jobs/:id',
    //     httpMethod: 'GET',
    //     middleware: [jobController.findOne]
    // },
    // {
    //     path: '/api/jobs/:id',
    //     httpMethod: 'DELETE',
    //     middleware: [jobController.destroy]
    // },
    // {
    //     path: '/api/maintain/sort_versions',
    //     httpMethod: 'GET',
    //     middleware: [maintenanceController.sortVersions]
    // },
    // {
    //     path: '/api/maintain/migrate_project',
    //     httpMethod: 'POST',
    //     middleware: [maintenanceController.migrateProject]
    // },
    // {
    //     path: '/api/maintain/list_old_projects',
    //     httpMethod: 'POST',
    //     middleware: [maintenanceController.listProjectsForEmail]
    // },

    // All other get requests should be handled by AngularJS's client-side routing system
    // {
    //     path: '/play/*',
    //     httpMethod: 'GET',
    //     middleware: [playerController.renderPlayer]
    // },
    // {
    //     path: '/*',
    //     httpMethod: 'GET',
    //     middleware: [
    //         function(req, res) {
    //             var role = 'anon',
    //                 _id = '';

    //             if (req.user) {
    //                 role = req.user.role;
    //                 _id = req.user._id;
    //                 console.log('[routes/*] req.user: '+ _id);
    //             }
    //             res.cookie('user', JSON.stringify({
    //                 '_id': _id,
    //                 'role': role
    //             }));
    //             console.log('[routes /*] referrer: ',req.headers.referer);
    //             res.render('index_mappr');
    //         }
    //     ]
    // }
];

module.exports = function(app, passport) {

    _.each(routes, function(route) {
        var args = _.flatten([route.path, route.middleware]);
        console.log('[' + route.httpMethod.toUpperCase().substring(0,3) + "] " + route.path);
        switch (route.httpMethod.toUpperCase()) {
            case 'GET':
                app.get.apply(app, args);
                break;
            case 'POST':
                app.post.apply(app, args);
                break;
            case 'PUT':
                app.put.apply(app, args);
                break;
            case 'DELETE':
                app.delete.apply(app, args);
                break;
            default:
                throw new Error('[ROUTE] Invalid HTTP method ' + route.path);
        }
    });

    //PARAMS
    app.param('pname', function(req, res, next, name) {
        //validate project name
        console.log("[ROUTE.param] ---------------------------------");
        console.log("[ROUTE.param] validating project name");
        db.proj.findOne({
            name: req.params.pname
        }, function(err, docs) {
            if (!docs || docs.length < 1) {
                console.log('Project not found with name: ' + req.params.pname);
                //next();
                res.send(404, "Project not found");
            } else {
                req.project = docs;
                console.log('Product name param detected for ' + req.project.name);
                next();
            }
        });
    });

    app.param('uname', function(req, res, next, name) {
        //validate username
        console.log("[ROUTE.param] ---------------------------------");
        console.log("[ROUTE.param] validating email");
        db.user.findOne({
            'local.email': req.params.uname
        }, function(err, docs) {
            if (!docs || docs.length < 1) {
                console.log('User not found with email: ' + req.params.uname);
                //next();
                res.send(404, "Error: User not found");
            } else {
                req.user_q = docs;
                console.log('User email param detected for ' + JSON.stringify(req.user_q.local.email));
                next();
            }
        });
    });



    app.param('lid', function(req, res, next, id) {
        //validate user id
        console.log("[ROUTE.param] --------------------------------");
        console.log("[ROUTE.param] Validating layer id");
        db.layer.findOne({
            _id: req.params.lid
        }, function(err, docs) {
            if (!docs || docs.length === 0) {
                console.log('[ROUTE.param] Layer [id: ' + req.params.lid + '] not found!');
                res.send(404, "Error: Layer not found");
            } else {
                req.layer = docs;
                console.log('[ROUTE.param] Layer [id: ' + req.layer._id + '] found!');
                next();
            }
        });
    });

    app.param('dsid', function(req, res, next, id) {
        //validate dataset id
        console.log("[ROUTE.param] --------------------------------");
        console.log("[ROUTE.param] Validating dataset id");

        db.gfs().exist({
            _id: req.params.dsid
        }, function(err, found) {
            if (!found) {
                console.log('[ROUTE.param] Dataset [id: ' + req.params.dsid + '] not found!');
                //next();
                res.send(400, "Error: Dataset not found");
            } else {
                var dataString = '';
                console.log('[ROUTE.param] Reading data file stream', req.params.dsid);

                var readstream = db.gfs().createReadStream({
                    _id: req.params.dsid
                });

                readstream.on('data', function(chunk) {
                    var part = chunk.toString();
                    dataString += part;
                    console.log('got %d bytes of data', chunk.length);
                });

                readstream.on('end', function() {
                    var dataDocs = JSON.parse(dataString);
                    //create xlsx file
                    req.dataset = dataDocs;
                    console.log('[ROUTE.param] Dataset [id: ' + req.params.dsid + '] found!');
                    next();
                });
            }
        });
    });


    app.param('token', function(req, res, next, id) {
        //validate reset_token
        console.log("[ROUTE.param] --------------------------------");
        console.log("[ROUTE.param] Validating reset token");
        db.user.find({
            'local.reset_token': req.params.token
        }, function(err, docs) {
            if (!docs || docs.length === 0) {
                //if reset token not found, redirect to login
                console.log('[ROUTE.param] Token [reset_token: ' + req.params.token + '] not found!');
                res.redirect('login');
            } else {
                //make sure the expiration isn't too long
                var exp_time = docs[0].reset_expire;
                var cur_time = new Date().getTime();
                if(exp_time < cur_time)
                {
                    console.log('[ROUTE.param] Password Reset [reset_token: ' + req.params.token + '] has expired!');
                    res.redirect('login');
                } else {
                    req.user_q = docs[0];
                    console.log('[ROUTE.param] Email for [reset_token: ' + req.user_q.reset_token + '] found!');
                    next();
                }
            }
        });
    });
};

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        //console.log('[ROUTE.ensureAuthenticated] found [user :'  + JSON.stringify(req.user) + ']');
        return next();
    } else {
        //not logged in
        return res.send(401);
    }
}

function ensureAdminAccess(req, res, next) {
    //TODO : find better solution
    if (req.user.role !== 'admin'){
        console.log('[ROUTE.ensureAdminAccess] access denied: ' + req.route.path);
        return res.send(403);
    }
    return next();
}
