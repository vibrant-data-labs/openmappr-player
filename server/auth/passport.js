'use strict';
var LocalStrategy    = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy  = require('passport-twitter').Strategy;
var GoogleStrategy   = require('passport-google-oauth').OAuth2Strategy;
// var db            = require('../db.js');
var userModel        = require('../user/user_model');
var configAuth       = require('../config/auth.js');

// expose this function to our app using module.exports
module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        console.log('passport.serialize', user.id);
        done(null, user._id.toString());
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        userModel.listById(id, function(err, user) {
            if (err) {
                return done(err);
            }
            done(null, user);
        });
    });

    passport.use(new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
        usernameField: 'email',
        passwordField: 'password'
    },
    function(email, password, done) {
        userModel.listByEmail(email, function(err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, {
                    message: 'User not found. You may want to signup first!'
                });
            }
            if(!user.local || !user.local.password) {
                return done(null, false, {
                    message: 'Not a local user'
                });
            }
            if (!user.validPassword(password)) {
                return done(null, false, {
                    message: 'Oops! Wrong password'
                });
            }
            if(!user.isActive) {
                console.log('[passport:local] user disabled with email: ' + email);
                return done(null, false, {message: 'User account disabled'});
            }
            // all is well
            // update lastsignin and return successful user
            user.lastSignedIn.date = Date.now();
            user.save(function() {
                userModel.cache().insert(user.id, user);
                return done(null, user);
            });
        });
    }
    ));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    // passport.use('local-signup',
    //     new LocalStrategy({
    //             // by default, local strategy uses username and password, we will override with email
    //             usernameField: 'email',
    //             passwordField: 'password',
    //             passReqToCallback: true // allows us to pass back the entire request to the callback
    //         },
    //         function(req, email, password, done) {

    //             // asynchronous
    //             // User.findOne wont fire unless data is sent back
    //             process.nextTick(function() {

    //                 // find a user whose email is the same as the forms email
    //                 // we are checking to see if the user trying to login already exists
    //                 db.user.findOne({
    //                     'email': email
    //                 }, function(err, user) {
    //                     // if there are any errors, return the error
    //                     if (err)
    //                         return done(err);

    //                     // check to see if theres already a user with that email
    //                     if (user) {
    //                         return done('The email address is already taken. You may want to login using it.', false);
    //                     } else {

    //                         // if there is no user with that email
    //                         // create the user
    //                         var newUser = new db.user();

    //                         // set the user's local credentials
    //                         newUser.local.password = newUser.generateHash(password);
    //                         newUser.email = email;
    //                         newUser.name = email.split('@')[0]; //use the email as name

    //                         // save the user
    //                         newUser.save(function(err) {
    //                             if (err)
    //                                 throw err;
    //                             return done(null, newUser);
    //                         });
    //                     }

    //                 });
    //             });
    //         }
    //     )
    // );

    // // =========================================================================
    // // LOCAL LOGIN =============================================================
    // // =========================================================================
    // // we are using named strategies since we have one for login and one for signup
    // // by default, if there was no name, it would just be called 'local'

    // passport.use('local-login', new LocalStrategy({
    //         // by default, local strategy uses username and password, we will override with email
    //         usernameField: 'email',
    //         passwordField: 'password',
    //         passReqToCallback: true // allows us to pass back the entire request to the callback
    //     },
    //     function(req, email, password, done) { // callback with email and password from our form

    //         // find a user whose email is the same as the forms email
    //         // we are checking to see if the user trying to login already exists
    //         db.user.findOne({
    //             'email': email
    //         }, function(err, user) {
    //             // if there are any errors, return the error before anything else
    //             if (err)
    //                 return done(err);

    //             // if no user is found, return the message
    //             if (!user)
    //                 return done('User not found. You may want to signup first!', false); // req.flash is the way to set flashdata using connect-flash

    //             // if the user is found but the password is wrong
    //             if (!user.validPassword(password))
    //                 return done('Oops! Wrong password', false); // create the loginMessage and save it to session as flashdata

    //             // all is well
    //             // update lastsignin and return successful user
    //             user.lastSignedIn.date = Date.now;
    //             user.save(function(err){
    //                 return done(null, user);
    //             });

    //         });

    //     }));

    // =========================================================================
    // FACEBOOK ================================================================
    // =========================================================================
    passport.use(new FacebookStrategy({

        // pull in our app id and secret from our auth.js file
        clientID: configAuth.facebookAuth.clientID,
        clientSecret: configAuth.facebookAuth.clientSecret,
        callbackURL: configAuth.facebookAuth.callbackURL,
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },

    // facebook will send back the token and profile
    function(req, token, refreshToken, profile, done) {


        // asynchronous
        process.nextTick(function() {
            console.log(profile);
            console.log(req.user);

            // check if the user is already logged in
            // req.user is undefined if there is no ongoing session
            if (typeof req.user === 'undefined' || !req.user) {
                console.log('--- new session ----');
                // find the user in the database based on their facebook id
                userModel.findByFBProfile(profile.id, function(err, user) {

                    // if there is an error, stop everything and return that
                    // ie an error connecting to the database
                    if (err)
                        return done(err);

                    // if the user is found, then log them in
                    if (user) {
                        console.log('--- existing user ----');
                        // if there is a user id already but no token (user was linked at one point and then removed)
                        // just add our token and profile information
                        if (!user.facebook.token) {
                            user.facebook.token = token;
                            user.facebook.username = profile._json.username;
                            user.facebook.link = profile._json.link;
                            user.facebook.hometown = profile._json.hometown;
                            user.facebook.location = profile._json.location;
                            user.facebook.timezone = profile._json.timezone;
                            user.name = profile._json.name;
                            user.email = profile._json.email;
                            user.first_name = profile._json.first_name;
                            user.last_name = profile._json.last_name;
                            user.picture = 'https://graph.facebook.com/' + profile._json.username + '/picture?type=large';
                            user.gender = profile._json.gender;
                            user.verified = profile._json.verified;
                            user.locale = profile._json.locale;

                            user.save(function(err) {
                                if (err)
                                    throw err;
                                return done(null, user);
                            });
                        }
                        return done(null, user); // user found, return that user
                    } else {
                        console.log('--- new user ----');
                        // if there is no user found with that facebook id, create them
                        var newUser = userModel.create();

                        // set all of the facebook information in our user model
                        newUser.facebook.id = profile.id; // set the users facebook id
                        newUser.facebook.token = token; // we will save the token that facebook provides to the user                    
                        newUser.facebook.username = profile._json.username;
                        newUser.facebook.link = profile._json.link;
                        newUser.facebook.hometown = profile._json.hometown;
                        newUser.facebook.location = profile._json.location;
                        newUser.facebook.timezone = profile._json.timezone;
                        newUser.name = profile._json.name;
                        newUser.email = profile._json.email;
                        newUser.first_name = profile._json.first_name;
                        newUser.last_name = profile._json.last_name;
                        newUser.picture = 'https://graph.facebook.com/' + profile._json.username + '/picture?type=large';
                        newUser.gender = profile._json.gender;
                        newUser.verified = profile._json.verified;
                        newUser.locale = profile._json.locale;

                        // save our user to the database
                        newUser.save(function(err) {
                            if (err)
                                throw err;

                            // if successful, return the new user
                            return done(null, newUser);
                        });
                    }

                });
            } else {
                console.log('--- existing session ----');
                // user already exists and is logged in, we have to link accounts
                var user = req.user; // pull the user out of the session

                // update the current users facebook credentials
                user.facebook.id = profile.id;
                user.facebook.token = token;
                user.facebook.username = profile._json.username;
                user.facebook.link = profile._json.link;
                user.facebook.hometown = profile._json.hometown;
                user.facebook.location = profile._json.location;
                user.facebook.timezone = profile._json.timezone;
                user.name = profile._json.name;
                user.email = profile._json.email;
                user.first_name = profile._json.first_name;
                user.last_name = profile._json.last_name;
                user.picture = 'https://graph.facebook.com/' + profile._json.username + '/picture?type=large';
                user.gender = profile._json.gender;
                user.verified = profile._json.verified;
                user.locale = profile._json.locale;

                // save the user
                user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user);
                });
            }
        });

    }));

    // =========================================================================
    // TWITTER =================================================================
    // =========================================================================
    passport.use(new TwitterStrategy({
        consumerKey: configAuth.twitterAuth.consumerKey,
        consumerSecret: configAuth.twitterAuth.consumerSecret,
        callbackURL: configAuth.twitterAuth.callbackURL,
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },
    function(req, token, tokenSecret, profile, done) {
        process.nextTick(function() {
            // check if the user is already logged in
            if (!req.user) {
                userModel.findByTwitter(profile.id, function(err, user) {

                    // if there is an error, stop everything and return that
                    // ie an error connecting to the database
                    if (err)
                        return done(err);

                    // if the user is found then log them in
                    if (user) {
                        // if there is a user id already but no token (user was linked at one point and then removed)
                        // just add our token and profile information
                        if (!user.twitter.token) {
                            user.twitter.token = token;
                            user.twitter.username = profile.username;
                            user.twitter.displayName = profile.displayName;

                            user.save(function(err) {
                                if (err)
                                    throw err;
                                return done(null, user);
                            });
                        }
                        return done(null, user); // user found, return that user
                    } else {
                        // if there is no user, create them
                        var newUser = userModel.create();

                        // set all of the user data that we need
                        newUser.twitter.id = profile.id;
                        newUser.twitter.token = token;
                        newUser.twitter.username = profile.username;
                        newUser.twitter.displayName = profile.displayName;

                        // save our user into the database
                        newUser.save(function(err) {
                            if (err)
                                throw err;
                            return done(null, newUser);
                        });
                    }
                });
            } else {
                // user already exists and is logged in, we have to link accounts
                var user = req.user; // pull the user out of the session

                // update the current users facebook credentials
                user.twitter.id = profile.id;
                user.twitter.token = token;
                user.twitter.username = profile.username;
                user.twitter.displayName = profile.displayName;

                // save the user
                user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user);
                });
            }

        });

    }));

    // =========================================================================
    // GOOGLE ==================================================================
    // =========================================================================
    passport.use(new GoogleStrategy({

        clientID: configAuth.googleAuth.clientID,
        clientSecret: configAuth.googleAuth.clientSecret,
        callbackURL: configAuth.googleAuth.callbackURL,
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    },
    function(req, token, refreshToken, profile, done) {
        console.log(profile);
        // make the code asynchronous
        // User.findOne won't fire until we have all our data back from Google~
        process.nextTick(function() {

            // check if the user is already logged in
            if (!req.user) {
                // try to find the user based on their google id
                userModel.findByGoogle(profile.id, function(err, user) {
                    if (err)
                        return done(err);

                    if (user) {
                        // if there is a user id already but no token (user was linked at one point and then removed)
                        // just add our token and profile information
                        if (!user.google.token) {
                            user.google.token = token;
                            user.google.link = profile._json.link;
                            user.name = profile._json.name;
                            user.email = profile._json.email;
                            user.first_name = profile._json.given_name;
                            user.last_name = profile._json.family_name;
                            user.picture = profile._json.picture;
                            user.gender = profile._json.gender;
                            user.verified = profile._json.verified_email;
                            user.locale = profile._json.locale;

                            user.save(function(err) {
                                if (err)
                                    throw err;
                                return done(null, user);
                            });
                        }
                        // if a user is found, log them in
                        return done(null, user);
                    } else {
                        // if the user isnt in our database, create a new user
                        var newUser = userModel.create();

                        // set all of the relevant information
                        newUser.google.id = profile.id;
                        newUser.google.token = token;
                        newUser.google.link = profile._json.link;
                        newUser.name = profile._json.name;
                        newUser.email = profile._json.email;
                        newUser.first_name = profile._json.given_name;
                        newUser.last_name = profile._json.family_name;
                        newUser.picture = profile._json.picture;
                        newUser.gender = profile._json.gender;
                        newUser.verified = profile._json.verified_email;
                        newUser.locale = profile._json.locale;

                        // save the user
                        newUser.save(function(err) {
                            if (err)
                                throw err;
                            return done(null, newUser);
                        });
                    }
                });
            } else {
                // user already exists and is logged in, we have to link accounts
                var user = req.user; // pull the user out of the session

                // update the current users credentials
                // this will OVERWRITE some of the user details from the other login schemes
                user.google.id = profile.id;
                user.google.token = token;
                user.google.link = profile._json.link;
                user.name = profile._json.name;
                user.email = profile._json.email;
                user.first_name = profile._json.given_name;
                user.last_name = profile._json.family_name;
                user.picture = profile._json.picture;
                user.gender = profile._json.gender;
                user.verified = profile._json.verified_email;
                user.locale = profile._json.locale;

                // save the user
                user.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, user);
                });

            }
        });

    }));
};
