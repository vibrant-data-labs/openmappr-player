'use strict';

var Promise = require('bluebird');

var db_old           = require('../db_old.js');

function fetchOldUser (email) {
    return new Promise(function(resolve, reject) {
        db_old.user().findOne({
            'email': email
        }, function(err, docs) {
            if (err) {
                console.log('[UserHelpers.fetchOldUser] DB error Error: ' + err);
                reject(err);
            } else if(!docs) {
                console.log('[UserHelpers.fetchOldUser] Email not found!');
                reject(new Error('[UserHelpers.fetchOldUser] Email not found!'));
            } else {
                //obscuring password
                docs.password = '*';
                //delete docs.password
                console.log('[UserHelpers.fetchOldUser] ' + email + ' found');
                resolve(docs);
            }
        });
    });
}
module.exports = {
    fetchOldUser : fetchOldUser
};
