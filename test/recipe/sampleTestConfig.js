var _ = require('lodash');
// use a recipe and a dataset to generate a project
var sampleRecipe = {
    "name": "real template for TED_Fellows_April2015_Trim",
    "snapshot_gen": {
        "snapshots": [{
            networkIdx : 0,
            mapprSettings : {
                "nodeSizeMin" : 0.4
            }
        }],
        "genDefaultForNetwork": true
    },
    "layout_gen": {
        "layouts": [{
            networkIdx : "biteme",
            mapprSettings : {
                nodeSizeMin : 0.4
            }
        }]
    },
    "network_gen": {
        "networks": [{
            "name": "gen Network 1",
            "gen_algo": "athena_netgen",
            "algo_config": {
                "options": {
                    "questions": [{
                        "Question": "Fellowship Class",
                        "qAnalysisType": 5
                    }, {
                        "Question": "Country 1",
                        "qAnalysisType": 5
                    }]
                }
            },
            "gen_def_layout": true
        }]
    },
    "dataset_gen": {
        "attr_desc": [{
            "id": "Fellowship Class",
            "attrType": "string",
        }, {
            "id": "Country 1",
            "attrType": "string",
        }]
    },
    "data_ingest": {
        "srcType": "uploadedData"
    },
    "project_gen": {
        "reLinkPlayer": true,
        "generate": true
    },
    "gen_opts": {
        "skipPlayerGen": true
    },
    "isGlobal": false,
    "isLinkedToProject": false
};
var s3MultiSampleConfig = _.cloneDeep(sampleRecipe);
s3MultiSampleConfig.data_ingest.srcUrl = ["s3://recipe-test/bunchOf-Random/TED_Fellows_April2015_Trim.xlsx", "s3://recipe-test/simple/TED_Fellows_April2015_Trim.xlsx"];

var alchemySampleRecipe = {
    "name": "alchemySampleRecipe for GatesNewsDataset-10.xlsx",
    "snapshot_gen": {
        "snapshots": [],
        "genDefaultForNetwork": true
    },
    "layout_gen": {
        "layouts": []
    },
    "network_gen": {
        "networks": [{
            "name": "full text ngrams Network 1",
            "gen_algo": "athena_netgen",
            "algo_config": {
                "options": {
                    "questions": [{
                        "Question": "Full_text-keywords-ngrams",
                        "qAnalysisType": 3
                    }]
                }
            },
            "gen_def_layout": true
        }]
    },
    "dataset_gen": {
        "post_process": [{
            "algoType": 'alchemy',
            'config': {
                'selectedAlgos': ['concepts', 'keywords'],
                'relevance': 0.4,
                'queryAttrId': 'Full text'
            }
        }]
    },
    "data_ingest": {
        "srcType": "URL",
        "srcUrl": "s3://recipe-test/simple/GatesNewsDataset-10.xlsx"
    },
    "project_gen": {
        "reLinkPlayer": true,
        "generate": true
    },
    "gen_opts": {
        "skipPlayerGen": true,
    },
    "isGlobal": false,
    "isLinkedToProject": false
};
var globbingRecipe = {
    "name": "April Privacy Dataset analyser",
    "snapshot_gen": {
        "snapshots": [],
        "genDefaultForNetwork": true
    },
    "layout_gen": {
        "layouts": []
    },
    "network_gen": {
        "networks": [{
            "name": "gen Network 1",
            "gen_algo": "athena_netgen",
            "algo_config": {
                "options": {
                    "questions": [{
                        "Question": "topRankedSourceCategory",
                        "qAnalysisType": 5
                    }, {
                        "Question": "topRankedSourcePublisher",
                        "qAnalysisType": 5
                    }]
                }
            },
            "gen_def_layout": true
        }]
    },
    "dataset_gen": {
        "attr_desc": [{
            "id": "topRankedSourceCategory",
            "attrType": "string",
        }, {
            "id": "topRankedSourcePublisher",
            "attrType": "string",
        }]
    },
    "data_ingest": {
        "srcType": "URL",
        "srcUrl": "s3://recipe-test/privacy_dataset/April_*.xlsx"
            // "srcUrl" : "s3://recipe-test/privacy_dataset/April_*.xlsx"
    },
    "project_gen": {
        "reLinkPlayer": true,
        "generate": true
    },
    "gen_opts": {
        "skipPlayerGen": false
    },
    "isGlobal": false,
    "isLinkedToProject": false
};

var retailerEcoConfig = {
    "name": "template for slice etl data",
    "snapshot_gen": {
        "snapshots": [{
            "networkIdx" : -1,
            "mapprSettings" : {
                "nodeSizeAttr" : "growthRate(capped)",
                "nodeSizeMultiplier" : 0.5,
                "maxLabelSize" : 16,
                "minLabelSize" : 12
            },
            "snapName" : "Customer Segments"
        },{
            "networkIdx" : -1,
            "mapprSettings" : {
                "nodeSizeAttr" : "log_spend",
                "nodeSizeMultiplier" : 0.5
            },
            "snapName" : "Product Segments"
        },{
            "networkIdx" : -1,
            "layout" : {
                "plotType" : "scatterplot",
                "xaxis" : "log_orders",
                "yaxis" : "log_spend"
            },
            "mapprSettings": {
                "labelSizeRatio" : 0.5,
                "maxLabelSize" : 16,
                "minLabelSize" : 12,
                "nodeColorAttr" : "log_spend",
                "nodeSizeAttr" : "log_spend",
                "nodeSizeMultiplier" : 0.5,
                "drawEdges" : false
            },
            "snapName" : "Spend vs Orders"
        }],
        "genDefaultForNetwork": true
    },
    "network_gen": {
        "defNetworkName": "Customers",
        "networks": [{
            "name": "gen Network 1",
            "gen_algo": "athena_netgen",
            "algo_config": {
                "options": {
                    "questions": [{
                        "Question": "topCategories",
                        "qAnalysisType": 3
                    }]
                }
            },
            "gen_def_layout": true
        }]
    },
    "dataset_gen": {
        "attr_desc": [{
            "id": "growthRate(capped)",
            "attrType": "float"
        }, {
            "id": "log_spend",
            "attrType": "float"
        }, {
            "id": "topCategories",
            "attrType" : "liststring"
        }]
    },
    "data_ingest": {
        // "srcType": "uploadedData"
        "srcUrl" : "s3://recipe-test/sample_inputs/Retailer_Ecosystem.xls",
        "srcType": "URL",
    },
    "project_gen": {
        "reLinkPlayer": true,
        "generate": true
    },
    "player_gen": {
        "isDisabled" : false
    },
    "gen_opts": {
        "skipPlayerGen": true
    },
    "isGlobal": false,
    "isLinkedToProject": false
};

var sliceETLConfig = {
    "name": "template for slice etl process",
    "snapshot_gen": {
        "genDefaultForNetwork": true
    },
    "etl_gen" : {
        "enabled": true,
        "colValFilters": {
            "userID": "/mnt/mappr-datasets/bombfell_for_vish.csv"
        },
        "entity": "merchant",
        "genDemographics": true,
        "colValFiltersEnabled": true,
        "filterSpec": {
            "rowFilter": ""
        },
        "readOpts": {
            "tab_sep": true
        },
        "scriptName": "Transaction Processor"
    },
    "network_gen": {
        "defNetworkName": "Merchants",
        "networks": [{
            "name": "gen Network 1",
            "gen_algo": "athena_netgen",
            "algo_config": {
                "options": {
                    "questions": [{
                        "Question": "topCategory_tags",
                        "qAnalysisType": 3
                    }]
                }
            },
            "gen_def_layout": true
        }]
    },
    "dataset_gen": {
        "attr_desc": [{
            "id": "topCategory_tags",
            "attrType" : "liststring"
        }]
    },
    "data_ingest": {
        "srcType": "URL",
        "srcUrl": "/mnt/mappr-datasets/slicesubsample2.txt"
    }
};
module.exports = {
    sampleRecipe,
    s3MultiSampleConfig,
    alchemySampleRecipe,
    globbingRecipe,
    retailerEcoConfig,
    sliceETLConfig
};
