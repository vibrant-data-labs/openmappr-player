/**
* Used to create custom node groups & perform ops on them
*/
angular.module('common')
.service('SelectionSetService', ['$q', '$rootScope', 'uiService', 'dataService', 'projFactory', 'graphSelectionService', 'nodeSelectionService', 'zoomService', 'dataGraph', 'networkService', 'FilterPanelService', 'BROADCAST_MESSAGES',
function($q, $rootScope, uiService, dataService, projFactory, graphSelectionService, nodeSelectionService, zoomService, dataGraph, networkService, FilterPanelService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getSelectionVMs = getSelectionVMs;
    this.addNewSelection = addNewSelection;
    this.bakeSelections  = bakeSelections;
    this.getSelectionSets  = getSelectionSets;
    this.hiddenDataPointIds  = hiddenDataPointIds;
    this.clear = clear;




    /*************************************
    ********* CLASSES ********************
    **************************************/
    function Selection(sel, createMode) {
        this.selName = sel.selName;
        this.dpIDs = sel.dpIDs;
        this.editMode = false;
        this.createMode = createMode || false;
        this.selected = false;
        this.origSelection = _.clone(sel);
        this.visible = sel.visible != null ? sel.visible : true;
    }

    Selection.prototype.create = function() {
        var propsToUpdate = ['selName', 'dpIDs'],
            self = this;
        // if(this.dpIDs.length === 0) {
        //     uiService.logError('Can\'t create a selection with empty nodes!');
        //     return;
        // }
        if(!this.selName) {
            uiService.logError('Can\'t create a group with empty name!');
            return;
        }
        if(selNameAlreadyExists(this.selName)) {
            uiService.logError('Group name already exists!');
            return;
        }

        var projSettings = projFactory.getProjectSettings(),
            selectionData = _.get(projSettings, 'selectionData'),
            selectionSets = selectionData.selections;

        if(!this.createMode) throw new Error('Should only be called in create mode');

        selectionSets.unshift(_.pick(this, propsToUpdate));
        selectionData.genCount++;

        projFactory.updateProjectSettings(projSettings)
        .then(function() {
            self.createMode = false;
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.added, {groupName: self.selName});
            console.log(logPrefix + 'selection saved');
            uiService.log('Group created!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in saving selection', err);
            uiService.logError('Could not create group!');
        });

    };

    Selection.prototype.addDatapoints = function(dpIdsToAdd) {
        if(!dpIdsToAdd) {
            dpIdsToAdd = _.map(graphSelectionService.getSelectedNodes(), 'dataPointId');
        }
        var self = this;
        if(dpIdsToAdd.length === 0) {
            uiService.logError('No nodes selected!');
            return;
        }
        this.dpIDs = _.unique(this.dpIDs.concat(dpIdsToAdd));
        this._update(['dpIDs'])
        .then(function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.datapointsAdded, {groupName: self.selName});
            // If group is hidden, hide the newly added datapoints
            if(!self.visible) {
                updateGraph();
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.visiblityToggled, {groupName: self.selName});
            }
            console.log(logPrefix + 'selection saved');
            uiService.log('Nodes added to group!');
        })
        .catch(function(err) {
            this.dpIDs = _.difference(this.dpIDs, dpIdsToAdd);
            console.error(logPrefix + 'error in saving selection', err);
            uiService.logError('Could not update group!');
        });
    };

    Selection.prototype.invertSelection = function() {
        var allDatapoints = _.get(dataService.currDataSetUnsafe(), 'datapoints');
        var self = this;
        if(_.isEmpty(allDatapoints)) throw new Error('Dataset not loaded or has no datapoints');
        var allDatapointIDs = _.map(allDatapoints, 'id');
        this.dpIDs = _.difference(allDatapointIDs, this.dpIDs);

        this._update(['dpIDs'])
        .then(function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.inverted, {groupName: self.selName});
            console.log(logPrefix + 'selection inverted');
            uiService.log('Group selection inverted!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in saving inverted selection', err);
            uiService.logError('Could not invert group selection!');
        });
    };

    Selection.prototype.removeSelectedDPs = function(dpIdsToRemove) {
        if(!dpIdsToRemove) {
            dpIdsToRemove = _.map(graphSelectionService.getSelectedNodes(), 'dataPointId');
        }
        if(dpIdsToRemove.length === 0) return uiService.log('Nothing to remove');

        var self = this,
            newSelectionIds = _.difference(this.dpIDs, dpIdsToRemove),
            oldDpIds = this.dpIDs,
            removedDPsCount = this.dpIDs.length - newSelectionIds.length;

        if(removedDPsCount === 0) return uiService.log('0 nodes removed from group');
        this.dpIDs = newSelectionIds;

        this._update(['dpIDs'])
        .then(function() {
            console.log(logPrefix + 'nodes removed successfully');
            if(removedDPsCount === 1) {
                uiService.log(removedDPsCount + ' node removed from ' + self.selName);
            }
            else {
                uiService.log(removedDPsCount + ' nodes removed from ' + self.selName);
            }
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.datapointsRemoved, {groupName: self.selName});
        })
        .catch(function(err) {
            self.dpIDs = oldDpIds;
            console.error(logPrefix + 'error in removing datapoints', err);
            uiService.logError('Could not remove nodes!');
        });
    };

    Selection.prototype.updateName = function() {
        if(!this.selName) {
            uiService.logError('Group name can\'t be empty!');
            return;
        }
        if(selNameAlreadyExists(this.selName)) {
            uiService.logError('Group name already exists!');
            return;
        }

        var self = this;

        this._update(['selName'])
        .then(function() {
            self.editMode = false;
            self.origSelection.selName = self.selName;
            console.log(logPrefix + 'selection saved');
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.nameUpdated, {groupName: self.selName});
            uiService.log('Group name updated!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in saving selection', err);
            uiService.logError('Could not update group name!');
        });
    };

    Selection.prototype.updateSelection = function() {
        this.dpIDs = _.map(graphSelectionService.getSelectedNodes(), 'dataPointId');
        if(this.dpIDs.length === 0) {
            uiService.logError('Group can\'t be empty!');
            return;
        }

        this._update(['dpIDs'])
        .then(function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.datapointsReplaced, {groupName: self.selName});
            console.log(logPrefix + 'selection saved');
            uiService.log('Group updated!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in saving selection', err);
            uiService.logError('Could not update group!');
        });
    };

    Selection.prototype.delete = function() {
        var self = this;
        var groupName = self.origSelection.selName;
        this._update(null, true)
        .then(function() {
            _.remove(selectionVMs, 'selName', self.origSelection.selName);
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.deleted, {groupName: groupName});
            console.log(logPrefix + 'selection deleted');
            uiService.log('Group deleted!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in deleting selection', err);
            uiService.logError('Could not delete group!');
        });
    };

    Selection.prototype.toggleVisibility = function() {
        var self = this;
        this.visible = !this.visible;

        this._update(['visible'])
        .then(function() {
            updateGraph();
            $rootScope.$broadcast(BROADCAST_MESSAGES.dataGroup.visiblityToggled, {groupName: self.selName});
            var opText = self.visible ? 'visible' : 'hidden';
            console.log(logPrefix + 'group visiblity Toggled');
            uiService.log('Group ' + opText + '!');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in toggling visiblity', err);
            uiService.logError('Could not update group!');
        });

    };

    Selection.prototype._update = function(propsToUpdate, deleteSel) {
        var projSettings = projFactory.getProjectSettings(),
            selectionData = _.get(projSettings, 'selectionData'),
            selectionSets = selectionData.selections;

        if(deleteSel) {
            _.remove(selectionSets, 'selName', this.origSelection.selName);
        }
        else {
            var origSelection = _.find(selectionSets, 'selName', this.origSelection.selName);
            _.assign(origSelection, _.pick(this, propsToUpdate));
        }
        return projFactory.updateProjectSettings(projSettings);
    };

    Selection.prototype.cancelNameChange = function() {
        this.selName = this.origSelection.selName;
        this.editMode = false;
    };

    Selection.prototype.select = function($event) {
        var selNodeIds = [];

        if ($event.shiftKey || $event.ctrlKey || $event.metaKey) {
            if(this.selected) {
                this.selected = false;
            }
            else {
                this.selected = true;
            }
            selNodeIds = _(selectionVMs)
                            .filter(function(selVM) { return selVM.selected; })
                            .map('dpIDs')
                            .flatten()
                            .unique()
                            .thru(getDpNodeIds)
                            .compact()
                            .value();
        }
        else {
            if(this.dpIDs.length === 0) return uiService.log('This group currently has no nodes');
            _.each(selectionVMs, function(selVM) {
                selVM.selected = false;
            });
            selNodeIds = _.compact(getDpNodeIds(this.dpIDs));
            this.selected = true;
        }

        graphSelectionService.clearSelections();
        hoverNodesByIds([], $event);
        setTimeout(function() {
            graphSelectionService.selectByIds(selNodeIds, 0);
            zoomService.zoomToNodes(graphSelectionService.getSelectedNodes());
            FilterPanelService.rememberSelection(false);
        });
    };

    Selection.prototype.hover = function() {
        // if(this.dpIDs.length === 0) return uiService.log('This group currently has no nodes');
        debHoverNodes(_.compact(getDpNodeIds(this.dpIDs)), window.event);
    };

    Selection.prototype.getNodeIds = function() {
        return getDpNodeIds(this.dpIDs);
    };

    Selection.prototype.nodeExistsInGroup = function(nodeId) {
        return getDpNodeIds(this.dpIDs).indexOf(nodeId) > -1;
    };

    Selection.prototype.clear = function() {
        debHoverNodes([], window.$event);
    };


    /*************************************
    ********* Local Data *****************
    **************************************/
    var logPrefix = '[SelectionSetService: ] ';
    var selectionVMs = null;



    /*************************************
    ********* Core Functions *************
    **************************************/
    var debHoverNodes = _.debounce(hoverNodesByIds, 100);
    var debSelectNodes = _.debounce(selectNodesByIds, 100);

    function getSelectionVMs() {
        if(selectionVMs) {
            return selectionVMs;
        }
        var projSettings = projFactory.getProjectSettings();
        var selectionData = _.get(projSettings, 'selectionData'),
            selectionSets;
        if(!selectionData) {
            projSettings.selectionData = {
                genCount: 0,
                selections: []
            };
            selectionSets = projSettings.selectionData.selections;
            projFactory.currProject()
            .then(function () {
                return projFactory.updateProjectSettings(projSettings);
            })
            .then(function() {
                console.log(logPrefix + 'added selection sets');
            })
            .catch(function(err) {
                console.error(logPrefix + 'error in saving selection', err);
                // uiService.logError('Could not add selection sets!');
            });
        }
        else {
            selectionSets = projSettings.selectionData.selections;
        }

        selectionVMs = _.map(selectionSets, function(selection) {
            return new Selection(selection);
        });

        return selectionVMs;
    }

    function addNewSelection(allowEmptyGroup) {
        if(_.any(selectionVMs, 'createMode')) {
            return;
        }
        var selectedNodes = graphSelectionService.getSelectedNodes();
        if(!allowEmptyGroup && selectedNodes.length === 0) {
            uiService.log('Please make a selection first!');
            return;
        }

        var newSelection = {
            selName: 'Group' + (_.get(projFactory.getProjectSettings(), 'selectionData.genCount') + 1),
            dpIDs: _.map(selectedNodes, 'dataPointId')
        };

        var newSelectionVM = new Selection(newSelection, true);
        selectionVMs.unshift(newSelectionVM);
        return newSelectionVM;
    }
    function bakeSelections () {
        return projFactory.bakeSelections()
        .then(function() {
            var proj = projFactory.currProjectUnsafe(),
                network = networkService.getCurrentNetwork();
            console.log("Reloading dataset and network...");
            uiService.log("Reloading data...");
            return $q.all([
                dataService.fetchProjectDataSet(proj.org.ref, proj._id),
                networkService.fetchProjectNetwork(network.id)
            ]);
        })
        .then(function(vals) {
            uiService.log("Re rendering graph...");
            var network = vals[1];
            $rootScope.$broadcast(BROADCAST_MESSAGES.network.changed, { network : network });
            return dataGraph.mergeAndLoadNetwork(network);
        })
        .catch(function(err) {
            uiService.logError(err.toLocaleString());
            return $q.reject(err);
        });
    }

    function selNameAlreadyExists(selName) {
        var otherSelVMs = _.reject(selectionVMs, function(selVM) {
            return selVM.createMode || selVM.editMode;
        });
        return _.map(otherSelVMs, 'selName').indexOf(selName) > -1;
    }

    function getDpNodeIds(dpIDs) {
        var dpNodeIdMap = dataGraph.getRawDataUnsafe().dataPointIdNodeIdMap;
        if(_.isEmpty(dpNodeIdMap)) throw new Error('dataPointId to node Id map doesn\'t exist');
        return _.map(dpIDs, function(dpId) {
            return dpNodeIdMap[dpId];
        });
    }

    function getSelectionSets () {
        var projSettings = projFactory.getProjectSettings();
        return _.get(projSettings, 'selectionData.selections', []);
    }

    function hoverNodesByIds(nodeIds, $event) {
        nodeSelectionService.hoverNodeIdList(nodeIds, $event);
    }

    function selectNodesByIds(nodeIds, $event) {
        nodeSelectionService.selectNodeIdList(nodeIds, $event);
    }
    // return the list of dataPointIds which have to be hidden
    function hiddenDataPointIds() {
        var hiddenDpIds = _(selectionVMs)
                            .reject(function(selVM) { return selVM.visible; })
                            .map('dpIDs')
                            .flatten()
                            .unique()
                            .thru(getDpNodeIds)
                            .compact()
                            .value();

        console.log('Hidden DP IDs: ', hiddenDpIds);
        return hiddenDpIds;
    }

    function clear() {
        selectionVMs = null;
    }

    function updateGraph() {
        var rg = dataGraph.getRenderableGraph();
        $rootScope.$broadcast(BROADCAST_MESSAGES.renderGraph.loaded, rg);
    }

}
]);