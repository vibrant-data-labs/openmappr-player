'use strict';
var mongoose = require('mongoose');
var gridfsStream = require('gridfs-stream');

var gfs = null;

var connection = mongoose.connection;
connection.once('open', function() {
    gfs = gridfsStream(connection.db, mongoose.mongo);
    //console.log('gfs:_______', gfs);
    console.log('[datasys_schema][gridFStream access available]');
});
// The func exported
function getGridFStream(){ return gfs; }


/**
 * Since data is stored in the grid, these schemas are for reference only
 * It is possible they are obsolete
 */

// Not used
var RawDataSetSchema = new mongoose.Schema({
    setName:        String,
    source:         String,
    sourceType:     String,
    org:        {   ref: String, orgName: String, picture: String},
    owner:      {   ref: String, email: String, name: String, picture: String},
    columns:    [{
                    colId: String,
                    colName: String,
                    colType: {type: Number, default: 0} 
                }],
    data:       [{
                    rowId: String,
                    row: [{colId: String, response: String, isPrivate: {type:Boolean, default:false}, notes: String, timestamp: {type: Date, default:Date.now()}}]
                }],
    dateCreated:    {type: Date, default: Date.now},
    dateModified:   Date
});

// Not Used
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
                            name:                       String,
                            clusters:[{
                                        cluster:        String,
                                        nNodes:         Number,
                                        nLinks:         Number,
                                        nIntraClus:     Number,
                                        significance:   Number,
                                        linkingAttr: [{
                                            wtdFreq:        Number,
                                            globalFreq:     Number,
                                            freq:           Number,
                                            importance:     Number,
                                            value:          String,
                                            cluster:        String
                                        }],
                                        attrSignificance: [{
                                            attr:       String,
                                            mean:       String,
                                            meanpct:    Number,
                                            var:        String,
                                            nonRandom:  Boolean,
                                            topValues: [String]
                                        }],
                                        clusterLinks: []
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

module.exports = getGridFStream;