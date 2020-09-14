'use strict';
var mongoose = require('mongoose'),
    bcrypt       = require('bcrypt');
var gridfsStream = require('gridfs-stream');
var gfs = null,
    Promise = require("bluebird");

Promise.promisifyAll(mongoose);

function getGridFStream(){return gfs;}

var OrgSchema = new mongoose.Schema({
    orgName:            String,
    picture:            String,
    createdAt:          {type: Date, default: Date.now},
    owner:              {ref: String, email: String, name: String, picture: String},
    users:          {
                        members :   [{
                                        ref:            String,
                                        name:           String,
                                        email:          String,
                                        role:           String,
                                        dateJoined:     Date,
                                        priviledges: {              //no 0, read 2, write 4, delete 8
                                            profile:    Number,
                                            users:      Number,
                                            projects:   Number,
                                            players:    Number,
                                            dataPipes:  Number,
                                            billing:    Number,
                                            activity:   Number
                                        }
                                    }],
                        pending :   [{
                                        token:          String,
                                        expire:         String,
                                        hasAccount:     Boolean,
                                        name:           String,
                                        email:          String,
                                        role:           String,
                                        priviledges: {              //read 0, write 2, delete 4
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
    projects:       [{
                        ref:            String,
                        projName:       String,
                        picture:        String,
                        owner:          {ref: String, email: String, name: String, picture:String},
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
    players:        [{
                        playerUrl:      String, //mappr.io/play/xxxxxxxx
                        ref:            String,
                        owner:          {ref: String, email: String, name: String, picture: String},
                        picture:        String,
                        dateModified:   Date,
                        isDraft:        {type: Boolean, default: true}
                    }],
    dataPipes:      [{
                        num:            Number,
                        sourceType:     String,
                        transformer:    String,
                        dataSetRef:     String,
                        isDataChunked:  {type: Boolean, default: false}
                    }],
    billing:        {

    },
    activity:       [{                              //User.invite_member "Add userB to org_name/project_name" on May23,2014
                        actor:          String,     //User
                        actor_ip:       String,     //50.100.20.72
                        action:         String,     //invite_member
                        proj:           String,     //projB
                        user:           String,     //userB
                        note:           String,     //Add userB to org_name/projB_name
                        dateCreated:    {type: Date, default: Date.now} //Date
                    }],
    notifications:  {}
});

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
                        ref:String,
                        owner:{name: String, email: String, ref: String},
                        orgName:String,
                        picture:String,
                        role:String, //role : isOwner, isMember
                        dateJoined: Date,
                        isPending: {type:Boolean, default:true},
                        token: String
                    }],
    projects:       [{
                        ref:        String,
                        org:        String,
                        owner:      String,
                        permission: String,
                        projName:       {type: String,  default: 'Untitled Map'},
                        dateJoined:     {type: Date,    default: Date.now}
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
    role:           {
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

var ProjectSchema = new mongoose.Schema({
    projName:       String,
    descr:          String,
    picture:        String,
    tags:           [String],
    org:            {ref: String, orgName: String, picture: String},
    owner:          {ref: String, email: String, name: String, picture: String},
    users:          {
                        members :   [{
                                        ref:            String,
                                        name:           String,
                                        email:          String,
                                        permission:     String,
                                        dateJoined:     Date
                                    }],
                        pending :   [{
                                        token:          String,
                                        expire:         String,
                                        hasAccount:     Boolean,
                                        isOrgMember:    Boolean,
                                        name:           String,
                                        email:          String,
                                        permission:     String
                                    }]
                    },
    versions:       [{
                        num:        Number, //n
                        name:       String, //version-n
                        dataSetRef: String, //reference data set
                        isDataChunked: {type:Boolean, default: false},
                        author:     {ref: String, email: String, name: String, picture: String},
                        dateModified:Date,
                        isDeleted:  {type:Boolean, default: false}
                    }],
    snapshots:      [{
                        id:             String,
                        snapName:       String,
                        descr:          String,
                        picture:        String,
                        type:           {type: String, default: 'network'},
                        embed:          String,
                        text:           String,
                        author:         {ref: String, email: String, name: String, picture: String},
                        //layout
                        layout:     {
                                        plotType:   {type: String, default: 'original'},
                                        settings:   {},
                                        xaxis:      {title:String, type:String},
                                        yaxis:      {title:String, type:String}
                                    },
                        //selection
                        ndSelState:     [{id: String, state: Number}],
                        edSelState:     [{id: String, state: Number}],
                        //camera
                        camera:         {x: Number, y: Number, r: Number},
                        //pin
                        pinState:       [{id: String, state: Number}],
                        dateModified:   Date,
                        isDeleted:      {type:Boolean, default: false},
                        isEnabled:      {type:Boolean, default: true}

                    }],
    layers:         [{                      //layers are essentially a grouping mechanism
                        id:         String, //n
                        name:       String, //layer-n
                        parent:     Number, //can be nested
                        col:        String, //layer color can be used for selection markers
                        locked:     {type: Boolean, default: false},
                        visible:    {type: Boolean, default: true},
                        author:     {ref: String, email: String, name: String, picture: String},
                        dateModified:Date,
                        isDeleted:  {type:Boolean, default: false}
                    }],
    pins:           [{                      //pins are small post-its attached to objects 
                        id:         String,
                        offX:       Number, //relative to parent
                        offY:       Number, //relative to parent
                        parentId:   String, //id
                        parentType: String, //screen, node, edge
                        content:    String,
                        contentType:String, //HTML
                        author:     {ref: String, email: String, name: String, picture: String},
                        dateModified:Date,
                        isDeleted:  {type:Boolean, default: false}
                    }],
    activity:       [{
                        actor:      String,
                        action:     String,
                        timestamp:  {type: Date, default: Date.now}
                    }],
    trash:          [{
                        itemType:   String, //version, snapshot, player, layer
                        itemNum:    Number,
                        deletedBy:  {ref: String, email: String, name: String, picture: String},
                        dateDeleted: {type: Date, default: Date.now}
                    }],
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date,
});

var RawDataSetSchema = new mongoose.Schema({
    setName:        String,
    source:         String,
    sourceType:     String,
    org:        {   ref: String, orgName: String, picture: String},
    owner:      {   ref: String, email: String, name: String, picture: String},
    columns:    [{
                    colId: String,
                    colName: String,
                    colType: String
                }],
    data:       [{
                    rowId: String,
                    row: [{colId: String, response: String, isPrivate: {type:Boolean, default:false}, notes: String, timestamp: {type: Date, default:Date.now()}}]
                }],
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date
});

var DataSetSchema = new mongoose.Schema({
    setName:        String,
    descr:          String,
    picture:        String,
    org:        {   ref: String, orgName: String, picture: String},
    owner:      {   ref: String, email: String, name: String, picture: String},
    projects:   [{
                    ref:        String,
                    projName:   String,
                    picture:    String,
                    owner:      {ref: String, email: String, name: String, picture:String}
                }],
    data:   {
             graph:     [
                            {id:String, val:String}
                        ],
             nodeAttrs:[{
                        id:                 String,
                        title:              String,
                        attrType:           String,
                        generatorType:      String,
                        generatorOptions:   String,
                        visible:            {type:Boolean,default:true}
                        }],
                nodes:[{
                        id:                 String,
                        label:              {type:String, default: "node"},
                        size:               Number,
                        posX:               Number,
                        posY:               Number,
                        col:                {r:Number, g:Number, b:Number},
                        layerId:            {type:Number, default: 0},
                        visible:            {type:Boolean,default:true},
                        attr:[
                                            {id:String, val:String}
                             ]
                       }],
            edgeAttrs: [{
                        id:                 String,
                        title:              String,
                        attrType:           String,
                        generatorType:      String,
                        generatorOptions:   String,
                        visible:            {type:Boolean, default:true}
                        }],
                edges:[{
                        id:                 String,
                        source:             String,
                        target:             String,
                        edgeType:           String, //directional or not
                        label:              {type:String, default: "edge"},
                        layerId:            {type:Number, default: 0},
                        col:                {r:Number, g:Number, b:Number},
                        visible:            {type:Boolean, default:true},
                        attr:[
                                            {id:String, val:String}
                             ]
                        }],
            clusterings: [{
                            name:                   String, 
                            clusters:[{
                                        cluster:    String,
                                        rawAnswer:  String,
                                        answer:     String,
                                        freq:       Number,
                                        globalFreq: Number,
                                        wtdFreq:    Number,
                                        importance: Number
                                     }]
                          }]
            },
    activity:       [{
                        actor:      String,
                        action:     String,
                        timestamp:  {type: Date, default: Date.now}
                    }],
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date
});

var PlayerSchema = new mongoose.Schema({
    playerUrl:                      String,
    descr:                          String,
    picture:                        String,
    tags:                           [String],
    org:                            {ref: String, orgName: String, picture: String},
    project:                        {ref: String, projName: String, picture: String},
    owner:                          {ref: String, email: String, name: String, picture: String},
    dataSet:                        {ref: String, isDataChunked: {type:Boolean, default:false}},
    isDisabled: {type:Boolean, default:true},
    isPrivate: {type:Boolean, default:false},
    directAccess: {type:Boolean, default:true},
    access_token: String,
    snapshots:      [{
                        id:             String,
                        snapName:       String,
                        descr:          String,
                        picture:        String,
                        embed:          String,
                        type:           {type: String, default: 'network'},
                        text:           String,
                        author:         {ref: String, email: String, name: String, picture: String},
                        //layout
                        layout:     {
                                        plotType:   {type: String, default: 'original'},
                                        settings:   {},
                                        xaxis:      {title:String, type:String},
                                        yaxis:      {title:String, type:String}
                                    },
                        //selection
                        ndSelState:     [{id: String, state: Number}],
                        edSelState:     [{id: String, state: Number}],
                        //camera
                        camera:         {x: Number, y: Number, r: Number},
                        //pin
                        pinState:       [{id: String, state: Number}],
                        dateModified:   Date,
                        isDeleted:      {type:Boolean, default: false},
                        isEnabled:      {type:Boolean, default: true}

                    }],
    settings:   {
                    allowJoin:      Boolean,
                    showModal:      {type:Boolean, default: false},
                    modalIntroHtml: String,
                    showHeader:     {type:Boolean, default: false},
                    headerType:     {type:String, default: 'img'},
                    headerHtml:     String,
                    headerImageUrl: String,
                    colorTheme:     {type:String, default: 'light'},
                    showPanels:     {type:Boolean, default: true},
                    showSearch:     {type:Boolean, default: false},
                    showSnapDescrs: {type:Boolean, default: false},
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
    cached:         {type: Boolean, default: false}
});

var SurveyTemplateSchema = new mongoose.Schema({
    surveyName: String,
    descr:      String,
    org:        {ref: {type: String, index : true }, orgName: String, picture: String},
    owner:      {ref: String, email: String, name: String, picture: String},
    tags:       [String],
    shareUrl:   String,
    isPublished:{type: Boolean, default: false},
    isConcluded:{type:Boolean, default:false}, //if the survey is concluded no future responses are accepted
    useCoupons: {type: Boolean, default: false},
    coupons:    [String], //should be generated by the admin
    couponCriteria: {type: Number, default: 0}, //currently it simply the number of user-answers required for the coupon to flash
    noOfCouponsUsed: {type: Number, default: 0},
    packets:    [{
                    packetId: Number,
                    slides: [{
                        ques: String,
                        ans: String
                    }]      
                }],
    metrics:    {
                    viewCount:      Number,
                    likes:          Number
                },
    template:   {
                    base:               {type:String, default:"styleHC"}, //this will hold the survey jade to be included
                    backgroundImage :   String,
                    logo:               String,
                    logoLink:           String,
                    locale:             {type:String, default:"english"},
                    showCatsInSlides :  {type:Boolean, default:"false"},
                    showIntro: {type:Boolean, default:true},
                    showInvite: {type:Boolean, default:true},
                    showTimeline: {type:Boolean, default:true},
                    showFaq: {type:Boolean, default:true},
                    hideProfile: {type:Boolean, default:false},
                    canAnswerAfterSubmission: {type:Boolean, default:false},
                    nQuestions:         Number,
                    nAnswers:           Number,
                    header: {
                        title:          String,
                        titleHelper:    String,
                        renderStyle: {
                            bkCol:      String,
                            col:        String,
                            font:       String
                                    }
                    },
                    intro:  {
                        showIntroVideo: {type:Boolean, default:true},
                        hideIntroNav:   {type:Boolean, default:false},
                        videoUrl:       String,
                        renderStyle: {
                            bkCol:      String,
                            col:        String,
                            font:       String
                                    },
                        sections: [
                            {
                                slides: [
                                    {
                                        title:  String,
                                        descr:  String,
                                        img:    String,
                                        next:   String
                                    }
                                ],
                                invite: {type:Boolean, default:false}
                            }
                        ],
                        loginText: {type:String, default: 'Login'}
                    },
                    invite: {
                        title:      String,
                        descr:      String,
                        email:      String,
                        password:   String,
                        htmlTop:    String,
                        htmlBottom: String,
                        subject:    String,
                        body:       String,
                        img:        String,
                        renderStyle: {
                            col:    String
                        }
                    },
                    faq: {
                        title:      String,
                        descr:      String,
                        renderStyle: {
                            col:    String
                        }
                    },
                    login: {
                        title:              String,
                        descr:              String,
                        usePassword:        {type:Boolean, default:false},
                        optInForEmail:      {type:Boolean, default:false},
                        isManualPrimary:    {type:Boolean, default:false},
                        password:           String,
                        useLogin:           Boolean,
                        useFBLogin:         Boolean,
                        useGoogLogin:       Boolean,
                        dataPolicy:         String,
                        termsOfUse:         String,
                        privacyPolicy:      String,
                        renderStyle: {
                            bkCol:      String,
                            col:        String,
                            font:       String
                                    }
                    },
                    profile: {
                        title:          String,
                        descr:          String,
                        renderStyle: {
                            col:    String
                        },
                        completeProfile:        Boolean,
                        showProfilePercent:     Boolean,
                        showMedia:              Boolean,
                        showSocial:             Boolean,
                        isExpandedProfile:      Boolean,
                        hideProfileOption:      Boolean,
                        instructions:           String,
                        twitterInstructions:    String,
                        instagramInstructions:  String,
                        mediaInstructions:      String,
                        socialHash:             String,
                        showReferral:           {type:Boolean, default: false},
                        mediaTags:              [String],
                        questions: [{
                                id:                     String,
                                categoryId:             String,
                                titleText:              String,
                                titleShortText:         String,
                                titleSubText:           String,
                                titleHelpText:          String,
                                renderType:             String, //radio, check, range, text
                                required:               {type:Boolean, default:true},
                                answerOptions:          {
                                                            rows: [{descr:String, value: String}],
                                                            cols: [{descr:String, value: String}]
                                                        },
                                dataHook:               {},     //writeback url
                                visible:                {type:Boolean, default:true},
                           }]
                    },
                    timeline: {
                        descr:          String,
                        renderStyle: {
                            col:        String
                        },
                        tooltips: {
                            groundwork: String,
                            survey:     String,
                            profile:    String,
                            invite:     String,
                            analysis:   String,
                            mapp:       String
                        }
                    },
                    thanks: {
                        title:          String,
                        descr:          String,
                        showProfileBtn: {type: Boolean, default: false},
                        img:            String,
                        renderStyle: {
                            bkCol:      String,
                            col:        String,
                            font:       String
                                    },
                        tooltips:[{
                            descr:      String
                        }],
                        gifts: [{
                            title:          String,
                            img:            String,
                            url:            String,
                            requirement:    String
                        }]
                    },
                    categories:[{
                                id:                     String,
                                title:                  String,
                                renderStyle:            {
                                                            col:     String,
                                                            bgCol:   String,
                                                            font1:   String,
                                                            font2:   String
                                                        },
                                visible:                {type:Boolean, default:true},
                                slideList:              [String]
                            }],
                    slides:  [{
                                id:                     String,
                                titleText:              String,
                                titleShortText:         String,
                                titleSubText:           String,
                                titleHelpText:          String,
                                titleTooltipText:       String,
                                renderType:             String, //radio, check, range, text
                                required:               {type:Boolean, default:true},
                                answerOptions:          {
                                                            rows: [{descr:String, value: String, tooltip: String}],
                                                            cols: [{descr:String, value: String, tooltip: String}]
                                                        },
                                dataHook:               {},     //writeback url
                                visible:                {type:Boolean, default:true},
                           }]
                },
    data: [{
            userToken: String,
            userResponses : [{slideNum:   Number, answer: String}]
          }],
    rawDataSetRef:  String,
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date
});


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
                        dateCompleted:      {type: Date,    default: Date.now},
                        isComplete:         {type:Boolean,  default: false},
                        isPolicyAccepted:   {type:Boolean, default:false},
                        optInEmail:         {type: Boolean, default: false},
                        surveyPassword:     String,
                        referName:          String
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


function onConnect (conn) {
    UserDB = conn.model('User', UserSchema);
    OrgDB = conn.model('Org', OrgSchema);
    ProjectDB = conn.model('Project', ProjectSchema);
    RawDataSetDB = conn.model('RawDataSet', RawDataSetSchema);
    DataSetDB = conn.model('DataSet', DataSetSchema);
    PlayerDB = conn.model('Player', PlayerSchema);
    SurveyTemplateDB = conn.model('SurveyTemplate', SurveyTemplateSchema);
    SurveyUserDB = conn.model('SurveyUser', SurveyUserSchema);
    RawDataSetDB = conn.model('RawDataSet', RawDataSetSchema);

    conn.once('open', function() {
        gfs = gridfsStream(conn.db, mongoose.mongo);
        console.log('[gridFStream access available for old database]');
        ProjectDB.count({}).exec(function(err, res) {
            console.log("OldDB Project count query result: ", res);
        });
        UserDB.count({}).exec(function(err, res) {
            console.log("OldDB User count query result: ", res);
        });
        OrgDB.count({}).exec(function(err, res) {
            console.log("OldDB Org count query result: ", res);
        });
        PlayerDB.count({}).exec(function(err, res) {
            console.log("OldDB Player count query result: ", res);
        });
        SurveyTemplateDB.count({}).exec(function(err, res) {
            console.log("OldDB SurveyTemplate count query result: ", res);
        });
        SurveyUserDB.count({}).exec(function(err, res) {
            console.log("OldDB SurveyUser count query result: ", res);
        });  
        RawDataSetDB.count({}).exec(function(err, res) {
            console.log("OldDB RawDataSet count query result: ", res);
        });   
    });
}

var SurveyUserDB = null;
var SurveyTemplateDB = null;
var UserDB = null;
var OrgDB = null;
var ProjectDB = null;
var RawDataSetDB = null;
var DataSetDB = null;
var PlayerDB = null;

module.exports = {
    onConnect     : onConnect,
    org           : function() { return OrgDB; },
    user          : function() { return UserDB; },
    proj          : function() { return ProjectDB; },
    dataSet       : function() { return DataSetDB; },
    rawDataSet    : function() { return RawDataSetDB; },
    player        : function() { return PlayerDB; },
    surveyTemplate: function() { return SurveyTemplateDB; },
    surveyuser    : function() { return SurveyUserDB; },
    // files      : FilesDB,
    // chunks     : ChunksDB,
    gfs           : getGridFStream
};
