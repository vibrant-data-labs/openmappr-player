// expose our config directly to our application using module.exports
'use strict';

module.exports = {
    'facebookAuth' : {
        'clientID'      : '<>', // your App ID
        'clientSecret'  : '<>', // your App Secret
        'callbackURL'   : '/auth/facebook/callback'
    },
    'twitterAuth' : {
        'consumerKey'       : '<>',
        'consumerSecret'    : '<>',
        'callbackURL'       : 'http://54.219.160.146/auth/twitter/callback'
    },
    'googleAuth' : {
        'clientID'      : '<>',
        'clientSecret'  : '<>',
        'callbackURL'   : '/auth/google/callback'
    }

};
