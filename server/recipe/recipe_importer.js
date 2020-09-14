'use strict';

var _       = require('lodash'),
    Promise = require('bluebird');

var playerModel      = require("../player/player_model"),
    DSModel = require('../datasys/datasys_model'),
    defaultLayout = require('../snapshot/def_layout');

var recipe_base_cfg = {
    "name": "sample recipe",
    "snapshot_gen": {
        "snapshots": [],
        "genDefaultForNetwork": true
    },
    "layout_gen": {
        "layouts": []
    },
    "network_gen": {
        "defNetworkName": "My first network",
        "networks": []
    },
    "dataset_gen": {
        "attr_desc": []
    },
    "data_ingest": {
        "srcType": "uploadedData"
    },
    "project_gen": {
        "reLinkPlayer": true,
        "generate": true
    },
    "gen_opts": {
        "skipPlayerGen": false,
        "skipSnapshotGen": false
    },
    "isGlobal": false,
    "isLinkedToProject": false
};

function _getDatasetCfg(dataset) {
    // var logPrefix = '[_getDatasetCfg: ] ';
    var attrDescrs = dataset.attrDescriptors;
    var attr_desc_cfg = _.map(attrDescrs, attrDescr =>
        _.pick(attrDescr, ['id', 'attrType', 'renderType', 'visible', 'metadata'])
    );

    return {
        attr_desc: attr_desc_cfg
    };
}

function _getSnapshotsCfg(snapshots, networks) {
    var logPrefix = '[_getSnapshotsCfg: ] ';
    var def_mappr_settings = defaultLayout.settings;
    var def_layout_settings = _.omit(defaultLayout, ['settings']);
    var networks_split_arr = _.partition(networks, _isGeneratedNetw);
    var networksIdxMap = {};
    var generatedNetworks = _.reject(networks_split_arr[0], _isSubNetw);
    var defaultNetworks = networks_split_arr[1];

    _.each(defaultNetworks, network => {
        networksIdxMap[network._id] = -1;
    });

    _.each(generatedNetworks, (network, idx) => {
        networksIdxMap[network._id] = idx;
    });

    var snapsCfg = _.reduce(snapshots, (snapCfgArr, snap) => {
        if(_isSubNetw(_.find(networks, 'id', snap.networkId))) {
            console.warn(logPrefix + 'ignoring snapshots config of subnet: ' + snap.networkId);
            return snapCfgArr;
        }

        snap = snap.toObject();
        var snapCfg = {
            mapprSettings: {},
            layout: {}
        };
        snapCfg.snapName = snap.snapName;
        snapCfg.description = snap.descr;
        snapCfg.networkIdx = networksIdxMap[snap.networkId];

        var snapLayoutSettings = _.omit(snap.layout, ['settings']);
        var snapMapprSettings = _.get(snap, 'layout.settings');
        _.forOwn(snapLayoutSettings, function(val, key) {
            if(!_.isEqual(val, def_layout_settings[key])) {
                snapCfg.layout[key] = val;
            }
        });

        _.forOwn(snapMapprSettings, function(val, key) {
            if(!_.isEqual(val, def_mappr_settings[key])) {
                snapCfg.mapprSettings[key] = val;
            }
        });

        snapCfgArr.push(snapCfg);
        return snapCfgArr;
    }, []);

    return {
        genDefaultForNetwork: false,
        snapshots: snapsCfg
    };
}

function _getPlayerCfg(player) {
    return _.pick(player, ['descr', 'isDisabled', 'isPrivate', 'directAccess', 'access_token']);
}

function _getNetworksCfg(networks) {
    var logPrefix = '[_getNetworksCfg: ] ';
    var defaultNetworkName;
    var networksCfg = _.reduce(networks, (nwCfgArr, network) => {
        var nwCfg = {};

        if(!_isGeneratedNetw(network)) {
            console.warn(logPrefix + 'ignoring networks config for default network: ' + network._id);
            defaultNetworkName = network.name;
            return nwCfgArr;
        }
        if(_isSubNetw(network)) {
            console.warn(logPrefix + 'ignoring networks config for subnet: ' + network._id);
            return nwCfgArr;
        }

        var nwAttrInfo = _.get(network, 'generatorInfo.links_FromAttributes');

        nwCfg.name = network.name;
        nwCfg.gen_algo = 'athena_netgen';
        nwCfg.gen_def_layout = true;
        nwCfg.algo_config = {
            options: {
                questions: _.map(nwAttrInfo.questions, ques => _.pick(ques, ['Question', 'qAnalysisType']))
            }
        };

        nwCfgArr.push(nwCfg);
        return nwCfgArr;
    }, []);

    return {
        networks: networksCfg,
        defNetworkName: defaultNetworkName
    };
}

function _isGeneratedNetw(network) {
    return !_.isEmpty(_.get(network, 'generatorInfo.links_FromAttributes'));
}

function _isSubNetw(network) {
    return _isGeneratedNetw(network)
        && !_.isEmpty(_.get(network, 'generatorInfo.subGraph'));
}

var api = {
    importFromProject: function (project) {
        var logPrefix = '[recipe_importer:importFromProject ] ';
        console.log(logPrefix + 'importing recipe from project');
        var imported_recipe = _.cloneDeep(recipe_base_cfg);

        var playerP = playerModel.listByProjectIdAsync(project._id);
        var datasetP = DSModel.readDataset(project.dataset.ref, false);
        var networksP = Promise.all(_.map(project.networks, function(networkObj) {
            return DSModel.readNetwork(networkObj.ref, false, false);
        }));

        imported_recipe.name = 'Recipe for ' + project.projName;

        return Promise.join(datasetP, networksP, playerP)
        .spread((dataset, networks, player) => {
            imported_recipe.dataset_gen = _getDatasetCfg(dataset);
            imported_recipe.player_gen = _getPlayerCfg(player);
            imported_recipe.network_gen = _getNetworksCfg(networks);
            imported_recipe.snapshot_gen = _getSnapshotsCfg(project.snapshots, networks);
            return imported_recipe;
        });

    }
};
module.exports = api;