/**
* Attr modifier utility -
* Requires parent dirAttrModifiers directive
* Applied per attribute
* Used at 2 places - Data Modal & Filter Panel
*/
angular.module('mappr')
.directive('dirAttrMod', ['$q', '$rootScope', '$timeout', 'AttrModifierService', 'AttrInfoService', 'dataService', 'networkService', 'dataGraph', 'uiService', 'BROADCAST_MESSAGES',
function($q, $rootScope, $timeout, AttrModifierService, AttrInfoService, dataService, networkService, dataGraph, uiService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        scope: {
            attr: '='
        },
        require: '^^dirAttrModifiers',
        templateUrl: function(tElem, tAttrs) {
            var url = '';
            switch(tAttrs.placement) {
            case 'selection':
                url = '#{server_prefix}#{view_path}/components/project/attr_modifiers/attrModSelection.html';
                break;
            default:
                url = '#{server_prefix}#{view_path}/components/project/attr_modifiers/attrModModal.html';
            }
            return url;
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ******** Controller Function *********
    **************************************/

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs, attrModCtrl) {
        scope.attrTypes = dataGraph.getNodeAttrTypes();
        scope.attrClass = '';

        scope.$watch('attr', function(attr) {
            buildAttrMod(attr);
            scope.attrClass = getAttrClass(scope.attr_mod);
            initRenderTypes(attr.attrType);
        });

        scope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function() {
            scope.attrClass = getAttrClass(scope.attr_mod);
        });

        scope.$on(BROADCAST_MESSAGES.dataGraph.linkAttrsUpdated, function() {
            scope.attrClass = getAttrClass(scope.attr_mod);
        });

        function buildAttrMod(attrData) {
            var attrType = attrs.attrType || getAttrType(attrData);
            scope.attr_mod = attrModCtrl.makeAttrMod(attrData, attrType);
            scope.attr_mod._isChecked = false;
            scope.attr_mod._isTitleEditable = false;
            scope.attr_mod._isMetaEditing = false;

            attrModCtrl.attr_mods.push(scope.attr_mod);
        }

        scope.setAttrDirty = function(attr_mod) {
            attrModCtrl.setAttrsDirty();
            if(attr_mod.scopeChangeRequested()) {
                attrModCtrl.triggerScopeChange(attr_mod.new_scope, true, attr_mod);
            }
            else {
                if(attr_mod.__isDataset === true) {
                    attrModCtrl.triggerDSAttrsUpdate(true, attr_mod);
                }
                else {
                    attrModCtrl.triggerNetworkAttrsUpdate(true, attr_mod);
                }
            }
        };

        scope.cancelMetaUpdate = function() {
            attrModCtrl.cancelMetaUpdate();
        };

        scope.makeAttrDirty = function() {
            attrModCtrl.setAttrsDirty();
        };

        scope.updateAttrMetaInfo = function(attr_mod) {
            attrModCtrl.setAttrsDirty();
            attrModCtrl.triggerMetaUpdate(true, attr_mod);
        };

        scope.attrSelected = function() {
            $timeout(attrModCtrl.attrSelected);
        };

        scope.changeType = function(attr_mod) {
            if(changeAttrType(attr_mod)) {
                scope.setAttrDirty(attr_mod);
                initRenderTypes(attr_mod.new_type);
            }
        };
        scope.changeRenderType = function(attr_mod) {
            scope.setAttrDirty(attr_mod);
            $rootScope.$broadcast(BROADCAST_MESSAGES.attr.renderTypeChanged, {id: attr_mod.attr.id});
        };
        scope.updateTitle = function(attr_mod) {
            attr_mod.title = attr_mod.title.length > 0 ? attr_mod.title : attr_mod.attr.title;
            attr_mod._isTitleEditable = false;
        };
        scope.changeSearchable = function(attr_mod) {
            attr_mod.toggleSearchable();
            if (attr_mod.validateChange()) {
                scope.setAttrDirty(attr_mod);
            }
            else {
                if (!attr_mod.visible) { uiService.logError("Can't change searchable for hidden attrs "); }
                else { uiService.logError("Can't change searchable for numeric attrs "); }
                attr_mod.resetSearchable();
            }
        };

        scope.changeVisibleInProfile = function(attr_mod) {
            if (attr_mod.visible) {
                attr_mod.toggleVisibilityInProfile();
                scope.setAttrDirty(attr_mod);
            }
        }

        scope.attrsSelected = function() {
            return attrModCtrl.attrsSelected;
        };

        scope.editMetaInfo = function(attr_mod) {
            attrModCtrl.cancelMetaUpdate();
            scope.$emit('OPENATTRMETATAB', {attrMod: attr_mod});
        };

        if(attrs.placement == 'selection') {
            scope.useAttrAsNodeLabel = function(attr) {
                $rootScope.$broadcast('updateMapprSettings', {
                    labelAttr: attr.id,
                    labelHoverAttr: attr.id,
                    labelClickAttr: attr.id
                });
            };
        }

        function initRenderTypes(attrType) {
            scope.attrRenderTypes = AttrInfoService.getRenderTypes(attrType);
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/
    function changeAttrType(attr_mod) {
        if(attr_mod.validateChange()) {
            console.log("Change validated. will persist on save");
            // attr_mod.changeType(); to be done on save
            return true;
        } else {
            uiService.logError("Can't change type from " + attr_mod.attr.attrType + " to " + attr_mod.new_type);
            attr_mod.resetNewType();
            return false;
        }
    }

    function getAttrType(attr) {
        var rawDataAttr = getDGAttr(attr);
        var attrType = rawDataAttr.fromDataset === true ? 'dsattr' : 'nwnode';
        return attrType;
    }

    function getDGAttr(attr) {
        var rawDataAttrs = dataGraph.getRawDataUnsafe().nodeAttrs;
        var rawDataAttr = _.find(rawDataAttrs, 'title', attr.title);
        return rawDataAttr;
    }

    function getAttrClass(attr_mod) {
        if (!attr_mod.visible) { return 'text-muted-light'; }
        if (!attr_mod.searchable) { return 'not-searchable'; }
        return '';
    }



    return dirDefn;
}
]);