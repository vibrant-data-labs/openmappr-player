/**
* Attr modifier utility
* Used as a parent directive for individual dir-attr-mod directive
* Provides methods to update indivual attr or multiple attrs at once
* Child directive - dirAttrMod.js(dir-attr-mod)
*/
angular.module('mappr')
.directive('dirAttrModifiers', ['$rootScope', '$q', 'AttrModifierService', 'dataService', 'networkService', 'projFactory', 'dataGraph', 'uiService',
function($rootScope, $q, AttrModifierService, dataService, networkService, projFactory, dataGraph, uiService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        scope: true,
        controller: ['$scope', ControllerFn]
    };


    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirAttrModifiers: ] ';
    var dsOrNwAttrsData = {
        reqFired: false
    };



    /*************************************
    ******** Controller Function *********
    **************************************/
    function ControllerFn($scope) {
        var self = this;
        this.attrsPristine = true;
        this.attr_mods = $scope.attr_mods = [];
        this.currentNetwork = networkService.getCurrentNetwork();
        this.dataset = dataService.currDataSetUnsafe();
        this.attrsType = '';
        this.attrsSelected = false;

        $scope.$on('$destroy', unSelectAttrs);

        $scope.$on('CANCELATTRUPDATE', function(e, data) {
            if(data.op == 'meta') {
                self.cancelMetaUpdate();
            }
        });

        $scope.$on('UPDATEATTRS', function(e, data) {
            if(data.attrType == self.attrsType) {
                self.setAttrsDirty();
            }
            if(self.attrsPristine) {
                console.log(logPrefix + 'ignoring update request for ' + self.attrsType);
                return;
            }
            if(data.op == 'meta') {
                self.triggerMetaUpdate(true, data.attrMod);
                return;
            }

            var selectedAttrMods = _.filter($scope.attr_mods, '_isChecked', true);
            switch(data.op) {
            case 'visibility':
                _.each(selectedAttrMods, function(attr_mod) {
                    attr_mod.toggleVisibility();
                });
                break;
            case 'remove':
                _.each(selectedAttrMods, function(attr_mod) {
                    attr_mod.markForRemoval();
                });
                break;
            case 'local':
            case 'global':
                _.each(selectedAttrMods, function(attr_mod) {
                    attr_mod.markForScopeChange(data.op);
                });
                break;
            default:
                // Nothing
            }

            if(data.op == 'local' || data.op == 'global') {
                self.triggerScopeChange(data.op);
            }
            else {
                if(self.attrsType == 'dsattr') {
                    self.triggerDSAttrsUpdate();
                }
                else if(self.attrsType == 'nwnode' || self.attrsType == 'nwlink') {
                    self.triggerNetworkAttrsUpdate();
                }
            }

        });


        this.attrSelected = function() {
            $scope.dmUi.showNoDeleteInfo = false;
            if(_.any($scope.attr_mods, '_isChecked', true)) {
                if(!$scope.dmUi.dsOrNwAttrDirty) {
                    $scope.$emit('ATTRSSELECTED');
                }
                $scope.dmUi.dsOrNwAttrDirty = true;
                self.attrsSelected = true;
                self.setAttrsDirty();
            }
            else {
                $scope.dmUi.dsOrNwAttrDirty = false;
                self.attrsSelected = false;
                self.setAttrsDirty();
                $scope.$emit('ATTRSUNSELECTED');
            }
        };

        this.setAttrsDirty = function() {
            this.attrsPristine = false;
        };

        this.setAttrsPristine = function() {
            this.attrsPristine = true;
        };

        this.cancelMetaUpdate = function() {
            _.forEach(this.attr_mods, function(attr) {
                attr._isMetaEditing = false;
            });
        };

        this.makeAttrMod = function(attr, attrType) {
            var collectionObj;
            if(!self.attrsType) self.attrsType = attrType;
            switch(attrType) {
            case 'dsattr':
                collectionObj = this.dataset;
                return new AttrModifierService.AttrModifier(collectionObj.datapoints, attr, true, collectionObj.id);
            case 'nwnode':
                collectionObj = this.currentNetwork;
                return new AttrModifierService.AttrModifier(collectionObj.nodes, attr, false, collectionObj.id);
            case 'nwlink':
                collectionObj = this.currentNetwork;
                return new AttrModifierService.AttrModifier(collectionObj.links, attr, false, collectionObj.id, true);
            default:
                    // No dnouts
            }
        };

        this.triggerMetaUpdate = function(singleUpdate, attr_mod) {
            if(!singleUpdate) throw new Error('No support for multi attr yet');
            attr_mod._isMetaEditing = false;
            if(attr_mod.__isDataset) {
                this.triggerDSAttrsUpdate(true, attr_mod);
            }
            else {
                this.triggerNetworkAttrsUpdate(true, attr_mod);
            }
        };

        this.triggerDSAttrsUpdate = function (singleUpdate, attr_mod) {
            var postObj = {
                attrSequenceChanged: false,
                orderedAttrIds : [],
                changedAttrDescriptors: [],
                removedAttrIds: []
            };
            if(singleUpdate) {
                postObj.changedAttrDescriptors = [attr_mod.attr];
                if(attr_mod.attrModified()) {
                    attr_mod.applyModifications();
                }
                if(attr_mod.markedForRemoval()) {
                    postObj.removedAttrIds = [attr_mod.attr.id];
                    attr_mod.removeAttr();
                }
            }
            else {
                var orderedModIds = _.pluck($scope.attr_mods, 'attr.id');
                var orderedDSIds = _.pluck(self.dataset.attrDescriptors, 'id');
                postObj.changedAttrDescriptors = _.pluck(_.filter($scope.attr_mods, _.method('attrModified')), 'attr');
                postObj.orderedAttrIds = orderedDSIds;
                postObj.attrSequenceChanged = _.any(orderedDSIds, function(val, idx) {
                    return val != orderedModIds[idx];
                });
                postObj.removedAttrIds = _.pluck(_.filter($scope.attr_mods, _.method('markedForRemoval')), 'attr.id');
                // update browser copy
                _.each($scope.attr_mods, function(attr_mod) {
                    if(attr_mod.attrModified()) {
                        attr_mod.applyModifications();
                    }
                    if(attr_mod.markedForRemoval()) {
                        attr_mod.removeAttr();
                    }
                });
            }

            _.each(postObj.removedAttrIds, function(attrId) {
                var attrModIdx = _.findIndex($scope.attr_mods, 'attr.id', attrId);
                if(attrModIdx > -1) $scope.attr_mods.splice(attrModIdx, 1);
            });
            updateDSAttrs(postObj);
        };

        this.triggerNetworkAttrsUpdate = function(singleUpdate, attr_mod) {
            var postObj = {
                changedNodeAttrDescriptors: [],
                nodeAttrSequenceChanged: false,
                orderedNodeAttrIds: [],
                removedNodeAttrIds: [],
                changedLinkAttrDescriptors: [],
                linkAttrSequenceChanged: false,
                orderedLinkAttrIds: [],
                removedLinkAttrIds: []
            };

            var orderedModIds, orderedNWIds;

            if(singleUpdate) {
                if(!attr_mod.__isLink) {
                    postObj.changedNodeAttrDescriptors.push(attr_mod.attr);
                    if(attr_mod.markedForRemoval()) postObj.removedNodeAttrIds = [attr_mod.attr.id];
                }
                else {
                    postObj.changedLinkAttrDescriptors.push(attr_mod.attr);
                    if(attr_mod.markedForRemoval()) postObj.removedLinkAttrIds = [attr_mod.attr.id];
                }

                if(attr_mod.attrModified()) {
                    attr_mod.applyModifications();
                }
            }
            else {
                if(self.attrsType == 'nwnode') {
                    orderedModIds = _.pluck($scope.attr_mods, 'attr.id');
                    orderedNWIds = _.pluck(self.currentNetwork.nodeAttrDescriptors, 'id');
                    postObj.changedNodeAttrDescriptors = _.pluck(_.filter($scope.attr_mods, _.method('attrModified')), 'attr');
                    postObj.nodeAttrSequenceChanged = _.any(orderedNWIds, function(val, idx) {
                        return val != orderedModIds[idx];
                    });
                    postObj.orderedNodeAttrIds = orderedNWIds;
                    postObj.removedNodeAttrIds = _.pluck(_.filter($scope.attr_mods, _.method('markedForRemoval')), 'attr.id');
                }
                else if(self.attrsType == 'nwlink') {
                    orderedModIds = _.pluck($scope.attr_mods, 'attr.id');
                    orderedNWIds = _.pluck(self.currentNetwork.linkAttrDescriptors, 'id');
                    postObj.changedLinkAttrDescriptors = _.pluck(_.filter($scope.attr_mods, _.method('attrModified')), 'attr');
                    postObj.linkAttrSequenceChanged = _.any(orderedNWIds, function(val, idx) {
                        return val != orderedModIds[idx];
                    });
                    postObj.orderedLinkAttrIds = _.pluck($scope.attr_mods, 'attr.id');
                    postObj.removedLinkAttrIds = _.pluck(_.filter($scope.attr_mods, _.method('markedForRemoval')), 'attr.id');
                }

                _.each($scope.attr_mods, function(attr_mod) {
                    if(attr_mod.attrModified()) {
                        attr_mod.applyModifications();
                    }
                    if(attr_mod.markedForRemoval()) {
                        attr_mod.removeAttr();
                    }
                });
            }

            _.each(postObj.removedNodeAttrIds, function(attrId) {
                var attrModIdx = _.findIndex($scope.attr_mods, 'attr.id', attrId);
                if(attrModIdx > -1) $scope.attr_mods.splice(attrModIdx, 1);
            });
            _.each(postObj.removedLinkAttrIds, function(attrId) {
                var attrModIdx = _.findIndex($scope.attr_mods, 'attr.id', attrId);
                if(attrModIdx > -1) $scope.attr_mods.splice(attrModIdx, 1);
            });

            updateNetworkAttrs(postObj);
        };

        this.triggerScopeChange = function(scope, singleUpdate, attr_mod) {
            if(singleUpdate) {
                if(attr_mod.__isDataset) dsOrNwAttrsData.selectedDsAttrMods = [attr_mod];
                else dsOrNwAttrsData.selectedNwAttrMods = [attr_mod];
            }
            else {
                var selectedAttrMods = _.filter($scope.attr_mods, '_isChecked', true);
                if(self.attrsType == 'dsattr')
                    dsOrNwAttrsData.selectedDsAttrMods = _.clone(selectedAttrMods);
                else if(self.attrsType == 'nwnode')
                    dsOrNwAttrsData.selectedNwAttrMods = _.clone(selectedAttrMods);
            }
            $scope.$evalAsync(function() { updateAttrsScope(scope); });
        };

        $scope.$watch('attr_mods.length', function(val) {
            if(val != null && $scope.dmUi) {
                if(self.attrsType == 'dsattr') {
                    $scope.dmUi.dsAttrMods = _.clone($scope.attr_mods);
                }
                if(self.attrsType == 'nwnode') {
                    $scope.dmUi.nwNodeAttrMods = _.clone($scope.attr_mods);
                }
            }
        });

        function updateDSAttrs(postObj){
            projFactory.currProject()
            .then(function(proj) {
                return dataService.updateAttrDescrs(proj.org.ref, proj._id, postObj);
            }).then(function(data) {
                if(data && data.attrDescriptorsUpdated === true) {
                    console.log(logPrefix + 'attr descriptors updated');
                    uiService.log('Attributes updated successfully!');
                    // reorder attrs
                    if(postObj.attrSequenceChanged) {
                        // AttrModifierService.updateOrdering(attrDescriptors, _.pluck($scope.attr_mods, 'attr.id'));
                        dataGraph.updateNodeAttrsOrder();
                    }

                    // update datagraph attrs, which updates infos as well
                    if(postObj.changedAttrDescriptors.length > 0) {
                        dataGraph.updateNodeAttrsBase(postObj.changedAttrDescriptors);
                    }

                    // remove attrs from dataset
                    if(postObj.removedAttrIds.length > 0) {
                        _.each(postObj.removedAttrIds, function(attrId) {
                            var attrIdx = _.findIndex(self.dataset.attrDescriptors, 'id', attrId);
                            if(attrIdx > -1) self.dataset.attrDescriptors.splice(attrIdx, 1);
                        });
                        dataGraph.removeNodeAttrs(postObj.removedAttrIds);

                    }
                    self.attrSequenceChanged = false;
                }
                else {
                    console.log(logPrefix + 'Dataset attributes could not be updated');
                    uiService.log('Attributes could not be updated!');
                }
            })
            .finally(function() {
                unSelectAttrs();
                $scope.$emit('ATTRSUPDATED');
            })
            .catch(function(err) {
                console.error(logPrefix + 'Dataset attributes could not be updated', err);
                uiService.logError('Dataset attributes could not be updated!');
            });

        }

        function updateNetworkAttrs(postObj) {
            var networkToUpdate = self.currentNetwork;

            networkService.updateNetworkAttrs(networkToUpdate.id, postObj)
            .then(function(data) {
                if(data && data.networkAttrsUpdated === true) {
                    console.log(logPrefix + 'network attributes updated successfully');
                    uiService.log('Attributes updated successfully!');

                    // Update datagraph
                    if(postObj.nodeAttrSequenceChanged) {
                        // AttrModifierService.updateOrdering(networkToUpdate.nodeAttrDescriptors,
                        //      _.pluck($scope.attr_mods, 'attr.id'));
                        dataGraph.updateNodeAttrsOrder();
                    }
                    if(postObj.linkAttrSequenceChanged) {
                        // AttrModifierService.updateOrdering(networkToUpdate.linkAttrDescriptors,
                        //      _.pluck($scope.attr_mods, 'attr.id'));
                        dataGraph.updateEdgeAttrsOrder();
                    }
                    // update datagraph attrs
                    if(postObj.changedNodeAttrDescriptors.length > 0) {
                        dataGraph.updateNodeAttrsBase(postObj.changedNodeAttrDescriptors);
                    }
                    if(postObj.changedLinkAttrDescriptors.length > 0) {
                        dataGraph.updateEdgeAttrsBase(postObj.changedLinkAttrDescriptors);
                    }

                    // remove attrs from dataset
                    if(postObj.removedNodeAttrIds.length > 0) {
                        _.each(postObj.removedNodeAttrIds, function(attrId) {
                            var attrIdx = _.findIndex(self.currentNetwork.nodeAttrDescriptors, 'id', attrId);
                            if(attrIdx > -1) self.currentNetwork.nodeAttrDescriptors.splice(attrIdx, 1);
                        });
                        dataGraph.removeNodeAttrs(postObj.removedNodeAttrIds);
                    }
                    if(postObj.removedLinkAttrIds.length > 0) {
                        _.each(postObj.removedLinkAttrIds, function(attrId) {
                            var attrIdx = _.findIndex(self.currentNetwork.linkAttrDescriptors, 'id', attrId);
                            if(attrIdx > -1) self.currentNetwork.linkAttrDescriptors.splice(attrIdx, 1);
                        });
                        dataGraph.removeEdgeAttrs(postObj.removedLinkAttrIds);
                    }
                }
                else {
                    console.log(logPrefix + 'network attributes could not be updated');
                    uiService.logError('Attributes could not be updated!');
                }
            }, function(err) {
                console.log(logPrefix + 'network attributes could not be updated', err);
                uiService.logError('Attributes could not be updated!');
            })
            .finally(function() {
                unSelectAttrs();
                $scope.$emit('ATTRSUPDATED');
            });
        }

        function updateAttrsScope(newScope) {
            if(dsOrNwAttrsData.reqFired) {
                console.warn('ignoring duplicate request');
                return;
            }
            dsOrNwAttrsData.reqFired = true;

            // update browser copy
            var dsAttrMods = dsOrNwAttrsData.selectedDsAttrMods || [];
            var nwAttrMods = dsOrNwAttrsData.selectedNwAttrMods || [];
            var combinedAttrMods = dsAttrMods.concat(nwAttrMods);
            _.each(combinedAttrMods, function(attr_mod) {
                if(attr_mod.attrModified()) {
                    attr_mod.applyModifications();
                }
            });

            var postObj = {
                newScope: newScope,
                dsAttrIds: _.pluck(dsAttrMods, 'attr.id'),
                nwAttrIds: _.pluck(nwAttrMods, 'attr.id'),
                currentNetworkId: self.currentNetwork.id
            };
            console.log(logPrefix + 'changing attrs scope');
            console.log(logPrefix, postObj);

            projFactory.currProject()
            .then(function(projDoc) {
                return dataService.updateAttrsScope(projDoc.org.ref, projDoc._id, postObj);
            }).then(function(data) {
                // Refresh dataGraph attrs
                dataGraph.updateNodeAttrsOrder();
                console.log(logPrefix + 'scope changed');
                console.log(data);
                uiService.log('Attributes made ' + newScope + '!');
            }).catch(function(err) {
                console.log(err);
                uiService.logError('Attributes scope could not be changed!');
            })
            .finally(function() {
                dsOrNwAttrsData = {reqFired: false};
                unSelectAttrs();
                $scope.$emit('ATTRSUPDATED');
            });
        }

        function unSelectAttrs() {
            if($scope.dmUi) {
                $scope.dmUi.dsOrNwAttrDirty = false;
            }

            _.each($scope.attr_mods, function(attr_mod) {
                attr_mod._isChecked = false;
            });
            dsOrNwAttrsData = {
                reqFired: false
            };
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);