'use strict';
var mongoose = require('mongoose'),
bcrypt       = require('bcrypt');

var UserSchema = new mongoose.Schema({
    name:           String,
    email:          { type: String, index: { unique: true } },
    first_name:     String,
    last_name:      String,
    picture:        String,
    gender:         String,
    verified:       Boolean,
    locale:         String,
    bio:            String,
    orgs:           [{
        ref        : String,
        owner      : {ref: String},
        orgName    : String,
        picture    : String,
        role       : String, //role : owner, member
        dateJoined : Date,
        isPending  : { type:Boolean, default:true },
        token      : String
    }],
    projects:       [{
        ref:        String,
        org:        String,
        owner:      String,
        permission: String,
        projName:   { type: String,  default: 'Untitled Map'},
        dateJoined: { type: Date,    default: Date.now }
    }],
    url:            String,
    local:{
        password:   String,
        resetToken: String,
        resetExpire:String
    },
    facebook:{
        id:         String,
        token:      {type: String, default: null},
        username:   String,
        link:       String,
        hometown:   {id: String, name: String},
        location:   {id: String, name: String},
        timezone:   Number
    },
    twitter:{
        id:         String,
        token:      {type: String, default: null},
        displayName:String,
        username:   String
    },
    google:{
        id:         String,
        token:      {type: String, default: null},
        link:       String
    },
    linkedin : {
        expires_at : Number, // number of seconds
        access_token: String
    },
    isActive:       {type: Boolean, default: true},
    dateCreated:    {type: Date, default: Date.now},

    lastSignedIn:   {
        orgId:          String,
        projId:         String,
        surveyId:       String,
        date:           {type: Date,    default: Date.now}
    },
    notifications:  [{
        timestamp:      {type:Date,     default:Date.now},
        content:        String
    }],
    role: {
        bitMask: {type: Number, default: 2},
        title: {type: String, default:'user'}
    }
});
// generating a hash for user password
UserSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid via hash
UserSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// compile the schema
var UserDB = mongoose.model('User', UserSchema);

module.exports = UserDB;