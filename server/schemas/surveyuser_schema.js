'use strict';
var mongoose = require('mongoose'),
    bcrypt       = require('bcrypt');

var SurveyUserSchema = new mongoose.Schema({
    name:               String,
    email:              String,
    first_name:         String,
    last_name:          String,
    picture:            String,
    gender:             String,
    verified:           Boolean,
    locale:             String,
    bio:                String,
    website1:           String,
    website2:           String,
    website3:           String,
    maritalStatus:      String,
    children:           String,
    profession:         String,
    optInEmail:         {type: Boolean, default: false},
    isPrivate:          [{type: Boolean, default: false}],
    isProfileHidden:    [{type: Boolean, default: false}],
    lastEdit:           Date,
    surveys:       [{
                        ref:                String,
                        org:                String,
                        owner:              String,
                        surveyName:         {type: String,  default: 'Untitled Survey'},
                        dateJoined:         {type: Date,    default: Date.now},
                        dateCompleted:      {type: Date},
                        isComplete:         {type:Boolean,  default: false},
                        isPolicyAccepted:   {type:Boolean, default:false},
                        referName:          String,
                        optInEmail:         {type: Boolean, default: false},
                        surveyPassword:     String
                    }],
    local:{
        password:   {type:String, default: null},
        resetToken: {type:String, default: null},
        resetExpire:{type:String, default: null}
    },
    facebook:{
        id:         {type:String, default:''},
        token:      {type: String, default: null},
        link:       String,
        birthday:   String,
        hometown:   {id: String, name: String},
        location:   {id: String, name: String},
        timezone:   Number
    },
    twitter:{
        id:         {type: String, default: null},
        token:      {type: String, default: null},
        displayName:{type: String, default: null},
        username:   {type: String, default: null},
        isNew:      {type: Boolean, default: true},
        hasNone:    {type: Boolean, default: false}
    },
    google:{
        id:         String,
        token:      {type: String, default: null},
        link:       String
    },
    instagram:{
        username:   {type: String, default: null},
        hasNone:    {type: Boolean, default: false}
    },
    media: [{
        name:       {type: String, default: ''},
        url:        {type: String, default: null},
        embed:      {type: String, default: null},
        videoId:    {type: String, default: null},
        type:       {type: String, default: null},
        tags:       [{type: String, default: null}],
        descr:      {type: String, default: ''},
        attr:      {type: String, default: ''},
        dateAdded:  {type: Date, default: Date.now},
        surveyRef:   {type: String, default: null}
    }],
    questionMedia: [{
        question:   {type: String, default: ''},
        answer:     {type: String, default: null},
        videoId:    {type: String, default: null},
        type:       {type: String, default: null},
        dateAdded:  {type: Date, default: Date.now}
    }],
    isActive:       {type: Boolean, default: true},
    dateCreated:    {type: Date, default: Date.now},

    lastSignedIn:   {
                        surveyId:       String,
                        categoryId:     String,
                        answerId:       String,
                        date:           {type: Date,    default: Date.now}
                    },
    notifications:  [{
                        timestamp:      {type:Date,     default:Date.now},
                        content:        String
                    }],
    role:           {
                        bitMask: {type: Number, default: 2},
                        title: {type: String, default:'user'}
                    }
});
// generating a hash for user password
SurveyUserSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};
// checking if password is valid via hash
SurveyUserSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};
var SurveyUserDB = mongoose.model('SurveyUser', SurveyUserSchema);

module.exports = SurveyUserDB;