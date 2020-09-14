'use strict';
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var states = {
    srcType : ['uploadedData', 'URL'], // url to use the url scheme for datasource
    netgenAlgos : ['athena_netgen'],
    dataProcessAlgos : ['alchemy']
};


var RecipeSchema = new mongoose.Schema({
    name              : String,
    isLinkedToProject : { type : Boolean, default : true }, // associated with a project
    isGlobal          : { type : Boolean, default : false}, // global recipes are read only, show up for all organisations
    isFinal           : { type : Boolean, default : true}, // if finalized, then it is validated. otherwise it is still being worked upon
    isHidden          : { type : Boolean, default : false}, // flag to hide them from the ui
    org               : { ref : Schema.Types.ObjectId }, // null if isGlobal is true
    project           : { ref : Schema.Types.ObjectId }, // null if isLinkedToProject is false
    createdAt         : {type: Date, default: Date.now },
    modifiedAt        : { type : Date, default : Date.now},

    ///
    // config part
    ///

    // a place to store various switches which effect the generation process. Recipe Engine is initialized with this
    gen_opts : {
        skipPlayerGen : {type: Boolean, default : false},
        skipSnapshotGen : {type: Boolean, default : false}
    },

    // specify project options
    project_gen : {
        // whether to generate a new project or not. false is not supported for now
        generate     : { type: Boolean, default : true},
         // whether the player url is relinked to the latest generated project or not
        reLinkPlayer : { type : Boolean, default : true}
    },

    // how to convert user data into a raw dataset
    data_ingest : {
        // for now, only 'uploadedData or urls' are supported.
        srcType : { type : String, required: true, enum: states.srcType },
        // the url to the source.
        // For s3 it is s3://BUCKET/key
        // for file paths it is the url from where to download the file
        // can be a Array or a String or a glob pattern
        srcUrl : {}
    },
    etl_gen : {
        // Use the ETL pipeline or not
        enabled: {type: Boolean, default : false},
        // the name of the script to use for ETL
        scriptName : {type: String, default : "Transaction Processor"},
        // some switches on how to read the data
        readOpts : {
            tab_sep : {type: Boolean, default : true}
        },
        // filter selected rows
        'filterSpec': {
            'rowFilter' : String,
            'filterByColValues' : {
                // 'userID' : {
                //     'rowFilter' : ""
                // }
            }
        },
        colValFiltersEnabled : {type : Boolean, default: false},
        colValFilters : {
            // 'userID' : 's3://bucket/key_of_values_to_filter_userids.csv'
        },
        // enable demographics analysis of entities
        genDemographics : {type: Boolean, default : true},
        // which entity to summarize
        entity : {type: String, default : 'merchant'},
        // partName
        partName : String,
        isParquet : {type: Boolean, default : false}
    },
    // how to generate final dataset of the project
    dataset_gen : {
        // Post processing steps. like running athena, or for generic functions
        post_process : [{
            algoType : { type: String, enum : states.dataProcessAlgos },
            //
            // for alchemy, config object can be done 2 ways. the short form:
            // {
            //   "queryAttrId": "Abstract",
            //   "relevance" : 0.4, // default value
            //   "selectedAlgos" : ['keywords', 'concepts', 'entities', 'sentiment']
            // }
            //
            // And the full form:
            // {
            //   "queryAttrId": "Abstract", // the id of the dataset attr to query
            //   "relevance" : 0.4, // default value
            //   "selectedAlgos": [
            //     {
            //       "algo": "keywords",
            //       "newAttrTitle": "Abstract-keywords"
            //     },
            //     {
            //       "algo": "concepts",
            //       "newAttrTitle": "Abstract-concepts"
            //     },
            //     {
            //       "algo": "entities",
            //       "newAttrTitle": "Abstract-entities"
            //     },
            //     {
            //       "algo": "sentiment",
            //       "newAttrTitle": "Abstract-sentiment"
            //     }
            //   ],
            //   "relevance": 0.4
            // }
            //
            config : {}
        }],
        // specifies attr constraints. Validation errors halt generation
        attr_desc:[{
            id         : String, // the id to match with
            isRequired : { type: Boolean, default : true},
            attrType   : String,
            // ratio of node having values for this attr to all nodes. i.e 0.5 -> 50% of nodes should have it
            density    : { type : Number , min : 0, max : 1 },
            // optional attr info
            title      : String, // overrides title
            renderType : String,
            visible    : Boolean,
            metadata   : {}
        }]
    },
    // How to generate various networks
    network_gen : {
        "defNetworkName": String,
        networks : [{
            name           : String,
            // The algo to use for generating network. Whether athena or node selector API
            gen_algo       : {type : String, enum : states.netgenAlgos},
            // whether to generate default Force Directed layout
            gen_def_layout : { type: Boolean, default : true},
            // config object for netgen algo
            algo_config    : {}
        }]
    },
    // in future
    layout_gen : {
        layouts : [{}]
    },
    snapshot_gen : {
        // generate default snapshots for network. generally should be 'true'
        genDefaultForNetwork : { type: Boolean, default : true},
        snapshots : [{
            // an object containg custommized mappr settings for snapshots
            mapprSettings : {},
            // layout specifications, like scatterplot, geo
            layout : {},
            // name of snapshot
            "snapName" : String,
            // description of snapshot
            "description" : String,
            // the idx of the network in the network_gen.networks array
            networkIdx : Number
        }],

        defaultSnapConfig: {
            // an object containg custommized mappr settings for snapshots
            mapprSettings : {},
            // layout specifications, like scatterplot, geo
            layout : {}
        }
    },
    player_gen : {
        descr : String,
        isDisabled   : {type: Boolean, default:false},
        isPrivate    : {type: Boolean, default:false}, // private  needs token
        directAccess : {type: Boolean, default:true}, // whether token is manually entered or is in url
        // if is private is enabled, then access token needs to be given
        access_token : String
    }
});


var RecipeSchema = mongoose.model('Recipe', RecipeSchema);

module.exports = RecipeSchema;
