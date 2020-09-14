'use strict';
/**
 * Snapshot Generator Mixin
 *
 */

var _       = require('lodash');

var generateShortUID6 = require('../services/UIDUtils').generateShortUID6,
    CacheMaster = require('../services/CacheMaster');

var SNAPSHOT_PHASE_NAME = 'snapshot_gen';
// mixed into RecipeEngine. 'this' refers to that object
function SnapshotGeneratorMixin () {
    // returns the modified project
    this.gen_snapshot = function(scope, reporter) {
        var cfg     = this.recipe.snapshot_gen,
            self    = this,
            project = scope.project,
            networks= scope.networks,
            networkIds = scope.networkIds;

        reporter.setPhase(SNAPSHOT_PHASE_NAME);
        cfg.defaultSnapConfig = cfg.defaultSnapConfig || {};
        // the index of generated network == num of networks read from dataSource
        var genNWIdStartIdx = _.get(scope.dataSource, "networks.length", 0);
        self.emit('info', `[gen_snapshot] genNWIdStartIdx: ${genNWIdStartIdx}`);

        if(!cfg.genDefaultForNetwork) {
            self.emit('info', `[gen_snapshot] skipping default snapshot generation`);
            // return Promise.resolve(project);
        } else {
            self.emit('info', `[gen_snapshot] generating default snapshot for ${networkIds.length} networks...`);
            console.log("[gen_snapshot] Network Ids: ", networkIds);
            // generate snapshots for each generated network
            _(networks)
                .map(network => this.gen_snapshot_for_one(network))
                .map(snap => this.apply_snap_config(snap, cfg.defaultSnapConfig))
                .map(snap => project.snapshots.push(snap)).value();
            self.emit('info', `[gen_snapshot] generating default snapshot for ${networkIds.length} networks...done`);
        }
        // generate custom snapshots
        _.each(cfg.snapshots, function gen_snaps(snapDescr) {
            self.emit('info', `[gen_snapshot] generating custom snapshot with config ${snapDescr} for network ${snapDescr.networkIdx}...`);
            var network = networks[snapDescr.networkIdx + genNWIdStartIdx];
            var snap = self.gen_snapshot_for_one(network);
            snap = self.apply_snap_config(snap, snapDescr);
            project.snapshots.push(snap);
            self.emit('info', `[gen_snapshot] generating custom snapshot with config ${snapDescr} for network ${snapDescr.networkIdx}...done`);
        });
        return project.save();
    };
    /**
     * Generates a default snapshot for the network
     * @return {Snapshot}         generated snapshot
     */
    this.gen_snapshot_for_one = function(network) {
        var snap = _.cloneDeep(snapTmpl);

        snap.id = "snap-" + generateShortUID6();
        snap.author = { ref : this.user.id };
        snap.dateModified = Date.now();

        console.log("[gen_snapshot_for_one] Snapshot with Id: ", snap.id);

        // find the center
        // var maxX = _.max(network.nodes, 'attr.OriginalX').attr.OriginalX,
        //     maxY = _.max(network.nodes, 'attr.OriginalY').attr.OriginalY;

        // var minX = _.min(network.nodes, 'attr.OriginalX').attr.OriginalX,
        //     minY = _.min(network.nodes, 'attr.OriginalY').attr.OriginalY;

        // var centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
        // snap.camera.x = centerX;
        // snap.camera.y = centerY;
        snap.camera.x = 160; //layoutService.offsetX
        snap.camera.y = -20; //layoutService.offsetY

        snap.networkId = network.id;

        // setup layout
        snap.layout = _.cloneDeep(defaultOriginalLayout);
        // set settings
        _.assign(snap.layout.settings, {
            nodeColorAttr : 'Cluster',
            nodeSizeAttr : 'ClusterArchetype',
            nodeSizeMultiplier : 0.4,
            nodeSizeMin: 4,
            nodeSizeMax: 15,
            drawGroupLabels : true,
            labelSizeRatio : 0.5,
            minLabelSize: 6,
            maxLabelSize: 14
        });

        // naming and other stuff
        var snapName = '', descr = '';
        var networkAttrsList = getNetworkAttrs(network);

        snapName = network.name + ' - ' + 'cluster 1';

        descr = formatContent('Network', network.name);
        descr += formatContent('Attributes used to create network', networkAttrsList.join(', '));

        descr += formatContent('Node color attribute', snap.layout.settings.nodeColorAttr);
        descr += formatContent('Node size attribute', snap.layout.settings.nodeSizeAttr);

        function formatContent(title, content) {
            var formattedContent = '<p><b>' + title + '</b> - ';
            formattedContent += content + '\n\n';
            return formattedContent;
        }
        snap.snapName = snapName;
        snap.description = descr;


        return snap;
    };
    this.apply_snap_config = function (snap, snapDescr) {
        _.assign(snap.layout, snapDescr.layout || {});
        _.assign(snap.layout.settings, snapDescr.mapprSettings || {});
        snap.snapName = snapDescr.snapName || snap.snapName;
        snap.descr = snapDescr.description || snap.descr;
        return snap;
    };
}

function getNetworkAttrs (network) {
    var genInfo = network.generatorInfo;
    if(_.isObject(genInfo) && genInfo.links_FromAttributes) {
        return _.pluck(genInfo.links_FromAttributes.questions, 'Question');
    } else return [];
}

var snapTmpl = {
    snapName      : 'Snapshot',
    description   : 'Add a description',
    type          : 'network',
    isEnabled     : true,
    picture       : '',
    audio         : '',
    embed         : '',
    text          : '',
    author        : null,
    layout        : null,
    networkId     : null,
    ndSelState  : [],
    edSelState  : [],
    camera        : {
        x:0,
        y:0,
        r:1,
        normalizeCoords: false // set to false as they are already normalized
    },
    pinState      : null,   //rsd.pinState,
    dateModified  : null,//rsd.dateModified,
    isDeleted     : false   //rsd.isDeleted
};
var defaultOriginalLayout = {
    plotType: 'original',
    settings: {},

    xaxis: null,
    yaxis: null,
    x_scaler_type :  'linear',
    x_scaler_base :  2,
    x_scaler_exponent :  2,

    y_scaler_type :  'linear',
    y_scaler_base :  2,
    y_scaler_exponent :  2
};
module.exports = SnapshotGeneratorMixin;
