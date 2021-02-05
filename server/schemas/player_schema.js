'use strict';
var mongoose = require('mongoose');

var PlayerSchema = new mongoose.Schema({
    playerUrl    : {type : String, index : true },
    descr        : String,
    picture      : String,
    tags         : [String],
    org          : {ref: String},
    project      : {ref: { type : String, index : true }},
    isDisabled   : {type: Boolean, default:true},
    isPrivate    : {type: Boolean, default:false},
    isFinal      : {type: Boolean, default:false},
    isEditable   : {type: Boolean, default:false},
    directAccess : {type: Boolean, default:true},
    access_token : String,
    buildVer     : String,
    settings:   {
        allowJoin:      Boolean,
        fontClass:      {type:String, default: ''},
        showModal:      {type:Boolean, default: false},
        simpleSplash:   {type:Boolean, default: true},
        modalIntroHtml: String,
        modalTitle:     String,
        searchAlg:      String,
        neighborhoodDegree: Number,
        startPage:      String,
        modalSubtitle:  String,
        modalLogo:      String,
        modalBackground: String,
        modalDescription: String,
        highlightColor: String,
        showHeader:     {type:Boolean, default: true},
        headerType:     {type:String, default: 'simple'},
        headerHtml:     String,
        headerImageUrl: String,
        headerTitle:    String,
        shareTitle:     {type:String, default: 'Check out this map'},
        shareTitleCompare: {type:String, default: 'Check out my node'},
        shareTitleSelect: {type:String, default: 'Check out these nodes'},
        shareServerPrefix: String,
        shareEnableSelect: {type:Boolean, default: false},
        showExportBtn: {type:Boolean, default: true},
        facebookShare:  {type:Boolean, default: false},
        twitterShare:   {type:Boolean, default: false},
        colorTheme:     {type:String, default: 'light'},
        showPanels:     {type:Boolean, default: true},
        showSearch:     {type:Boolean, default: false},
        showTimeline:   {type:Boolean, default: true},
        showSnapDescrs: {type:Boolean, default: false},
        infoClickToParent: {type:Boolean, default: false}, //allow iframe to trigger event in parent
        infoClickParentHost: String, //host of parent embedded in if triggering event from info button
        // minimizeSnapDescrs: {type:Boolean, default: false},
        timelineType:   String,
        snapDuration:   Number,
        showSnapTooltips: {type:Boolean, default: false},
        panelLayoutType:{type:String, default: 'interactive'}, //'static'
        autoPlay:       {type:Boolean, default: false},
        totalDuration:  Number,
        snapTransition: {type:String, default: 'tween'}, //tween, slide, none, blur
    },
    metrics:    {
        viewCount:      Number,
        likes:          Number
    },
    dateCreated:    Date,
    dateModified:   Date,
    dateFinalised:  Date,
    cached:         {type: Boolean, default: false}
});
var PlayerDB = mongoose.model('Player', PlayerSchema);

module.exports = PlayerDB;
