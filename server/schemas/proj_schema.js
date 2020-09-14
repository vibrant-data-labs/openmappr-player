var mongoose = require('mongoose');

var SnapshotDescr = {
    id:             String,
    snapName:       String,
    subtitle:       String,
    summaryImg:     String,
    descr:          String,
    picture:        String,
    audio:          String,
    type:           {type: String, default: 'network'},
    embed:          String,
    text:           String,
    author:         {ref: String},
    pinnedAttrs:    [String],
    //layout
    layout:     {
		plotType          : {type: String, default: 'original'},
		settings          : {},
		xaxis             : {title:String, type:String},
		yaxis             : {title:String, type:String},
		gridAttr          : {title:String, type:String},
		gridSortAttr      : {title: String, type:String},
        listAttrs         : [String],
        listSortAttr      : {title:String, type:String},
        listSortReverse   : {type:Boolean, default: false},
        listSortAttrAr      : [String],
        listSortReverseAr   : [String],
        listColSizes        : [Number],
        listCompareIds    : [String],
		x_scaler_type     : { type : String, default : 'linear'},
		x_scaler_base     : { type : Number, default : 2},
		x_scaler_exponent : { type : Number, default : 2},
		y_scaler_type     : { type : String, default : 'linear'},
		y_scaler_base     : { type : Number, default : 2},
		y_scaler_exponent : { type : Number, default : 2}
    },
    networkId : String,
    //selection
    ndSelState:     [{id: String, state: Number}],
    edSelState:     [{id: String, state: Number}],
    //camera
    camera:         {x: Number, y: Number, r: Number,  normalizeCoords : { type: Boolean, default : false}},
    //pin
    pinState:       [{id: String, state: Number}],
    dateModified:   Date,
    isDeleted:      {type:Boolean, default: false},
    isEnabled:      {type:Boolean, default: true},
    processSelection: {type: Boolean, default: true}
};


var ProjectSchema = new mongoose.Schema({
    projName:       String,
    descr:          String,
    picture:        String,
    tags:           [String],
    org:            {ref: String},
    owner:          {ref: String},
    lastViewed:   {
        userRef: {type: String, default: ''},
        date: {type: Date, default: Date.now}
    },
    lastModified:   {
        userRef: {type: String, default: ''},
        date: {type: Date, default: Date.now}
    },
    recipe:         {ref : String}, // the recipe to which it belongs
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
    snapshots:      [SnapshotDescr],
    dataset : {
        ref : {type:String, default:''},
        dateModified: {type:Date,  default:Date.now},
        sourceInfo : {} // for google, it contains filepath which can be used to fetch it again
    },
    networks : [{
        ref : String
    }],
    allGenNWIds : [String], // all generated network Ids, deleted or otherwise. Useful for giving counts
    settings: {},
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date,
});
var ProjectDB = mongoose.model('Project', ProjectSchema);

module.exports = ProjectDB;
