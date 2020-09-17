angular.module('mappr')
.service('mergeService', ['$q', '$http', 'projFactory', 'snapshotService',
function($q, $http, projFactory, snapshotService) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.mergeMachine = MergeMachine;



    /*************************************
    ********* CLASSES ********************
    **************************************/
    /**
     * MergeMachine is a 3 step process.
     * 1) When merge starts, initialize the machine with the current dataset, network
     * 2) once the file to be merged has been uploaded, the returned data is fed to the machine.
     * 3) then machine pings server for statistics, which is used to create the AttrVM listing. This listing is used to
     *    populate the merge result
     * 4) Once the user has carried out the correct operations, merge function is called with hits the server with correct arguments
     *
     */
    function MergeMachine (dataset, network) {
        this.dataset = dataset;
        this.network = network;
        this.graphData = null;

        var attrListing = this.attrListing = []; // a list of attrVM
        this.attrVMIdx = {};
        this.datasetAdditions = [];
        this.networkAdditions = []; // probably will display this
        // filled up via server
        this.stats = {
            datasetResults : null,
            networkResults : null
        };

        this.allExistingSelected = false;
        this.allNewSelected = false;

        this.conflicts = false;
        this.mergeErrorObj = {
            error: '',
            action: ''
        };

        // add existings to attr listings
        _.each(this.dataset.attrDescriptors, function (attr) {
            attrListing.push(new AttrVM(attr.id, true, false, true));
        });
        _.each(this.network.nodeAttrDescriptors, function (attr) {
            attrListing.push(new AttrVM(attr.id, false, false, true));
        });
    }
    MergeMachine.prototype.processSaveDataReqResult = function(saveDataResult) {
        // of form
        // {
        //  fileId: cacheId,
        //  columns: tempData.dataset.attrDescriptors,
        //  nodesCount: tempData.dataset.datapoints.length,
        //  edgesCount : tempData.networks.length > 0 ? tempData.networks[0].links.length : 0,
        //  nodesInfo: tempData.dataset.datapoints,
        //  sourceInfo : tempData.sourceInfo,
        //  networks: tempData.networks
        // }
        var attrListing = this.attrListing;
        var attrVMIdx = _.indexBy(attrListing,"id");

        this.graphData = saveDataResult;
        // see which operation to perform on the parsed attributes
        _.each(saveDataResult.columns, function (attrDesc) {
            var existingVM = attrVMIdx[attrDesc.id];
            if(existingVM) {
                // attr exists in current and new data
                existingVM.inNewData = true;
                if(!existingVM.isGlobal) {
                    // commented out since policy change of adding new attrs into Dataset
                    // Hence aren't mismatched anymore
                    // existingVM.mismatched = true;
                }
            }
            else {
                if(attrDesc.id === "DataPointLabel" || attrDesc.id === "DataPointColor") {
                    console.log("Ignoring %s since it wasn't found in current dataset", attrDesc.id);
                    return;
                }

                // commented out since policy change of adding new attrs into Dataset
                // var attr = new AttrVM(attrDesc.id, false, true, false);
                // attr.mismatched = true;
                var attr = new AttrVM(attrDesc.id, true, true, false);
                attrListing.push(attr);
                existingVM = attr;
            }
            existingVM.preferNew = true;
            existingVM.preferExisting = false;
        });
        if(_.isObject(saveDataResult.networks[0]) &&  saveDataResult.networks[0].nodeAttrDescriptors) {
            _.each(saveDataResult.networks[0].nodeAttrDescriptors, function (attrDesc) {
                var existingVM = attrVMIdx[attrDesc.id];
                if(existingVM) {
                    // attr exists in current and new data
                    existingVM.inNewData = true;
                } else {
                    var attr = new AttrVM(attrDesc.id, false, true, false);
                    attrListing.push(attr);
                    existingVM = attr;
                }
                existingVM.preferNew = true;
                existingVM.preferExisting = false;
            });
        }

        // these aren't thrown across :|
        _.each(['OriginalX','OriginalY','OriginalSize','OriginalLabel','OriginalColor'], function (attrId) {
            attrVMIdx[attrId].inNewData = true;
        });
        this.attrVMIdx = _.indexBy(this.attrListing,'id');
        return this.getMergeStats();
    };
    MergeMachine.prototype.getMergeStats = function() {
        var self = this;
        return $http.post(buildOrgProjUrl() + '/di/merge_stats', {
            dataId : this.graphData.fileId,
            networkId : this.network.id
        })
        .then(function(resp) {
            console.log("Merge Stats result", resp.data);
            // resp.data contains { datasetResults, networkResults }
            // "Results": {
            //     "attrUpdates": {},
            //     "attrInserts": {},
            //     "attrDeletes": {},
            //     "additions": []
            // }
            // this is proccessed to find out the counts by VM
            var datasetResults = resp.data.datasetResults,
                networkResults = resp.data.networkResults,
                attrCounts = resp.data.attrCounts;
            var attrVMIdx = _.indexBy(self.attrListing,"id");

            _.each(datasetResults, function (opsObj, key) {
                if(key === 'additions') { return; }
                _.forOwn(opsObj, function (val, attrId) {
                    attrVMIdx[attrId].setMergeStatInfo(val);
                });
            });

            _.each(networkResults, function (opsObj, key) {
                if(key === 'additions') { return; }
                _.forOwn(opsObj, function (val, attrId) {
                    attrVMIdx[attrId].setMergeStatInfo(val);
                });
            });

            self.datasetAdditions = datasetResults.additions;
            self.networkAdditions = networkResults.additions;
            // load up counts
            // var attrCounts = {
            //     ds : getAttrCounts(dataset.datapoints),
            //     nw : getAttrCounts(network.nodes),
            //     gdDs : getAttrCounts(graphData.dataset.datapoints),
            //     gdNw : getAttrCounts(graphData.networks[0].nodes),
            // };
            _.each(attrVMIdx, function (attrVM) {
                attrVM.generateStatus(attrCounts);
                attrVM.sanitizeInitPreferredAttr();
            });
            return self;
        });
    };
    MergeMachine.prototype.toggleAllAttrs = function(attrsOrigin) {
        if(attrsOrigin == 'new') {
            if(this.allNewSelected) {
                _.each(this.attrListing, function(attrVM) {
                    attrVM.preferNew = false;
                    attrVM.preferExisting = false;
                    attrVM.updateState();
                });
                this.allNewSelected = false;
                this.allExistingSelected = false;
            }
            else {
                _.each(this.attrListing, function(attrVM) {
                    if(attrVM.inNewData) attrVM.preferNew = true;
                    attrVM.preferExisting = false;
                    attrVM.updateState();
                });
                this.allNewSelected = true;
                this.allExistingSelected = false;
            }
        }
        else if(attrsOrigin == 'existing') {
            if(this.allExistingSelected) {
                _.each(this.attrListing, function(attrVM) {
                    attrVM.preferNew = false;
                    attrVM.preferExisting = false;
                    attrVM.updateState();
                });
                this.allExistingSelected = false;
                this.allNewSelected = false;
            }
            else {
                _.each(this.attrListing, function(attrVM) {
                    attrVM.preferNew = false;
                    if(attrVM.inExistingData) attrVM.preferExisting = true;
                    attrVM.updateState();
                });
                this.allExistingSelected = true;
                this.allNewSelected = false;
            }
        }
        else throw new Error('Incorrect attr origin');
    };
    MergeMachine.prototype.checkForAllAttrSelection = function(attrOrigin) {
        if(attrOrigin == 'new') {
            if(allNewSelected.call(this)) {
                this.allNewSelected = true;
            }
            else {
                this.allNewSelected = false;
                this.allExistingSelected = false;
            }
        }
        else if(attrOrigin == 'existing') {
            if(allExistingSelected.call(this)) {
                this.allExistingSelected = true;
            }
            else {
                this.allExistingSelected = false;
                this.allNewSelected = false;
            }
        }
        else throw new Error('Incorrect attr origin');

        function allNewSelected() {
            var newAttrs = _.filter(this.attrListing, 'inNewData');
            var existingAttrs = _.filter(this.attrListing, 'inExistingData');
            return _.every(newAttrs, 'preferNew') && !_.any(existingAttrs, 'preferExisting');
        }

        function allExistingSelected() {
            var newAttrs = _.filter(this.attrListing, 'inNewData');
            var existingAttrs = _.filter(this.attrListing, 'inExistingData');
            return _.every(existingAttrs, 'preferExisting') && !_.any(newAttrs, 'preferNew');
        }
    };
    MergeMachine.prototype.canMerge = function() {
        if(_.any(this.attrListing, function(attrVM) {
            return attrVM.isRequired && attrVM.state == 'delete';
        })) {
            this.conflicts = true;
            return false;
        }
        else {
            this.conflicts = false;
            return true;
        }
    };
    MergeMachine.prototype.setErrorMsg = function() {
        this.mergeErrorObj.error = 'One or more required attributes are marked to be deleted.';
        this.mergeErrorObj.action = 'Select these attributes to proceed';
    };
    MergeMachine.prototype.getUpdatedAttrIds = function() {
        return _.pluck(_.filter(this.attrListing, 'state', ATTR_UPDATE), 'id');
    };
    MergeMachine.prototype.merge = function() {
        var self = this;
        // process attrListing and generate the correct globalOps / localOps
        var ops = _.map(_.partition(this.attrListing, 'isGlobal'), function (attrList) {
            return {
                toUpdate : _.pluck(_.filter(attrList, { 'state' : ATTR_UPDATE }), 'id'),
                toRemove : _.pluck(_.filter(attrList, { 'state' : ATTR_DELETE }), 'id'),
                toAdd    : _.pluck(_.filter(attrList, { 'state' : ATTR_ADD }), 'id')
            };
        });
        // ops[0] is global ops, [1] is local ops

        return $http.post(buildOrgProjUrl() + '/di/mergedata', {
            dataId : self.graphData.fileId,
            networkId : self.network.id,
            globalAttrOpts : ops[0],
            localAttrOpts : ops[1]
        });
    };


    // viewModel of merge Dialog box
    function AttrVM (attrId, isGlobal, inNewData, inExistingData) {
        this.id = attrId;
        this.isGlobal = isGlobal; // whether part of dataset or not

        this.inNewData = inNewData;
        this.inExistingData = inExistingData;
        // which has been checked?
        this.preferNew = false;
        this.preferExisting = true;

        this.state = ATTR_NO_CHANGE;
        this.stateLine = "no change";
        this.counts = {
            total_existing : 0,
            total_new : 0,
            ops : 0 // number related to operation
        };

        this.isRequired = false;
        this.persistReason = '';
        this._setRequiredInfo();

        this.mismatched = false; // Data exists in graphData.dataset, but should be added to network. (new attrs are always added to network)

        this.mergeStatInfo = []; // each attrib has merge stat info!
    }
    AttrVM.prototype.togglePreferNew = function() {
        this.preferNew = !this.preferNew;
        if(this.preferNew) this.preferExisting = false;
        return this.updateState();
    };
    AttrVM.prototype.togglePreferExisting = function() {
        this.preferExisting = !this.preferExisting;
        if(this.preferExisting) this.preferNew = false;
        return this.updateState();
    };
    AttrVM.prototype.sanitizeInitPreferredAttr = function() {
        console.log("Sanitizing initial preferred attr");
        if(this.inNewData && this.preferNew && this.state == ATTR_NO_CHANGE) {
            console.log('Using old attr as no change found for : ' + this.id);
            this.preferExisting = true;
            this.preferNew = false;
        }
    };
    AttrVM.prototype.updateState = function() {
        console.log("State updated!");

        if(this.preferNew && this.inNewData) {
            if(!this.inExistingData) { // attr added
                this.state = ATTR_ADD;
                this.stateLine = "new attribute";
            }
            else {

                if(this.counts.ops > 0){
                    this.state = ATTR_UPDATE;
                    this.stateLine = this.counts.ops + " nodes will be updated";
                }
                else { // nothing to update
                    this.state = ATTR_NO_CHANGE;
                    this.stateLine = "no change";
                }
            }
        }
        else if(this.preferExisting && this.inExistingData) {
            this.state = ATTR_NO_CHANGE;
            this.stateLine = "no change";
        }
        else if(!this.preferExisting && !this.preferNew) {
            if(this.inExistingData) {
                this.state = ATTR_DELETE;
                if(this.isRequired) this.stateLine = "attribute can\'t' be removed";
                else this.stateLine = "attribute will be removed";
            }
            else if(this.inNewData) {
                this.state = ATTR_NO_CHANGE;
                this.stateLine = "no change";
            }
        }
        else {
            console.error(this);
            throw new Error("Invalid state reached!");
        }
        return this;
    };
    AttrVM.prototype.setMergeStatInfo = function(info) {
        this.mergeStatInfo = info || [];
    };
    AttrVM.prototype.generateStatus = function(attrCounts) {
        // set global counts
        if(this.isGlobal) {
            this.counts.total_existing = attrCounts.ds[this.id] || 0;
            this.counts.total_new = attrCounts.gdDs[this.id] || 0;
        } else {
            this.counts.total_existing = attrCounts.nw[this.id] || 0;
            this.counts.total_new = this.mismatched ? attrCounts.gdDs[this.id] :  attrCounts.gdNw[this.id];
            this.counts.total_new = this.counts.total_new || 0;
        }
        this.counts.ops = _.size(this.mergeStatInfo) || 0;
        this.updateState();
    };
    AttrVM.prototype._setRequiredInfo = function() {
        var snapDependentAttrs = snapshotService.getDependentAttrs();
        var attrsSnaps = snapDependentAttrs[this.id];
        var snapDependentAttrIds = _.keys(snapDependentAttrs);
        if(snapDependentAttrIds.indexOf(this.id) > -1) {
            // used in snapshots
            this.isRequired = true;
            this.persistReason = 'Used in ' + attrsSnaps.length + ' snapshots: ' + attrsSnaps.join(', ');
        }
        else if(isAttrOriginal(this.id)) {
            this.isRequired = true;
            this.persistReason = 'Can\'t delete Original Attributes!';
        }
    };

    /*************************************
    ********* Local Data *****************
    **************************************/
    // possible operations available to attribute
    var ATTR_NO_CHANGE = "no_change",
        ATTR_UPDATE = "update",
        ATTR_ADD = "add",
        ATTR_DELETE = "delete";

    /*************************************
    ********* Core Functions *************
    **************************************/

    function isAttrOriginal(attrId) {
        var originals = ["OriginalLabel", "OriginalSize", "OriginalX", "OriginalY", "OriginalColor"];
        return originals.indexOf(attrId) > -1;
    }

    function buildOrgProjUrl () {
        var proj = projFactory.currProjectUnsafe();
        var orgId = proj.org.ref,
            projId = proj._id;
        return '/api/orgs/' + orgId + '/projects/' + projId;
    }

}
]);