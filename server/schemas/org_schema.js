'use strict';
var mongoose = require('mongoose');


var OrgSchema = new mongoose.Schema({
    orgName   : String,
    picture   : String,
    createdAt : {type: Date, default: Date.now},
    owner     : {ref: String},
    users: {
        members :   [{
            ref:            String,
            name:           String,
            email:          String,
            role:           String,
            dateJoined:     Date,
            privileges: {              //no 0, read 2, write 4, delete 8
                profile   :   Number,
                users     :   Number,
                projects  :   Number,
                players   :   Number,
                dataPipes :   Number,
                billing   :   Number,
                activity  :   Number
            }
        }],
        pending : [{
            token:          String,
            expire:         String,
            hasAccount:     Boolean,
            first_name:     String,
            last_name:      String,
            name:           String,
            email:          String,
            role:           String,
            privileges: {              //read 0, write 2, delete 4
                profile:    Number,
                users:      Number,
                projects:   Number,
                players:    Number,
                dataPipes:  Number,
                billing:    Number,
                activity:   Number
            }
        }]
    },
    projects: [{
        ref:            String,
        projName:       String,
        picture:        String,
        owner:          {ref: String},
        lastViewed:   {
            userRef: {type: String, default: ''},
            date: {type: Date, default: Date.now}
        },
        lastModified:   {
            userRef: {type: String, default: ''},
            date: {type: Date, default: Date.now}
        },
        members:    [{
            ref:        String,
            email:      String,
            name:       String,
            isPending:  {type:Boolean, default:true},
            dateJoined: Date,
            token:      String
        }],
        dateModified:   Date
    }],
    surveyTemplates:[{
        ref:            String,
        surveyName:     String,
        owner:          {ref: String, email: String, name: String, picture:String},
        dateModified:   Date
    }],
    billing: {

    },
    activity: [{   //User.invite_member "Add userB to org_name/project_name" on May23,2014
        actor:          String,     //User
        actor_ip:       String,     //50.100.20.72
        action:         String,     //invite_member
        proj:           String,     //projB
        user:           String,     //userB
        note:           String,     //Add userB to org_name/projB_name
        dateCreated:    {type: Date, default: Date.now} //Date
    }],
    notifications:  {},
    settings: {}
});


var OrgDB = mongoose.model('Org', OrgSchema);

module.exports = OrgDB;
