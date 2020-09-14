angular.module('mappr')
.service('AttrModifierService', ['$q', '$http', '$rootScope', '$timeout', 'networkService', 'dataService', 'AttrInfoService', 'AttrSanitizeService', 'BROADCAST_MESSAGES',
function($q, $http, $rootScope, $timeout, networkService, dataService, AttrInfoService, AttrSanitizeService, BROADCAST_MESSAGES) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.AttrModifier = AttrModifier;
    this.updateOrdering = updateOrdering;
    this.valueConverterForAttr = valueConverterForAttr;
    this.valueConverterForValues = valueConverterForValues;



    /*************************************
    ********* Local Data *****************
    **************************************/
    // var coreTypes = ['liststring', 'float', 'integer', 'boolean', 'string', 'color'];
    //constants. NOTE: Also change dataUtils.js
    var stringTypes = ['string', 'picture','profile','video','audio_stream','media_link','video_stream','html','url','twitter', 'instagram', 'json'];
    // var booleanValues = ["true", "y", "yes", "false", "n", "no"];

    var liststring_splitter = /\s*\|\s*/;
    var attrMetaProps = ['minLabel', 'maxLabel', 'descr', 'overlayAnchor'];




    /*************************************
    ********* CLASSES ********************
    **************************************/
    //given a entities and attrDescriptors -> allows proper modifications of attrtypes
    function AttrModifier(entities, attrDescriptor, isDataset, datasetOrNwId, isLink) {
        this.__isDataset = isDataset; // datapoints , nodes , links
        this.__isLink = isLink || false;
        this.__datasetOrNwId = datasetOrNwId;
        this.__entities = entities;
        this.attr = attrDescriptor;
        this.typeInfo = null;
        // saved attr state info
        this.new_type = this.attr.attrType;
        this.new_render_type = this.attr.renderType;
        this.visible = this.attr.visible;
        this.isStarred = this.attr.isStarred;
        this.searchable = this.attr.searchable;
        this.visibleInProfile = this.attr.visibleInProfile;
        this.title = this.attr.title;
        this.newMetaData = buildAttrMetaClone(this.attr.metadata);
    }
    AttrModifier.prototype.toggleVisibility = function() {
        this.visible = !this.visible;
        if (['integer', 'float'].indexOf(this.attr.attrType) === -1) {
            this.searchable = this.visible;
        }
    };
    AttrModifier.prototype.toggleStarred = function() {
        this.isStarred = !this.isStarred;
    };
    AttrModifier.prototype.toggleSearchable = function() {
        this.searchable = !this.searchable;
    };
    AttrModifier.prototype.toggleVisibilityInProfile = function() {
        this.visibleInProfile = !this.visibleInProfile;
    };
    AttrModifier.prototype.resetSearchable = function() {
        this.searchable = this.attr.searchable;
    };
    AttrModifier.prototype.updateTitle = function(title) {
        this.title = title && title.length > 0 ? title : this.title;
        return this.title;
    };
    AttrModifier.prototype.setNewType = function(new_type) {
        this.new_type = new_type;
    };
    AttrModifier.prototype.resetNewType = function() {
        this.new_type = this.attr.attrType;
    };
    AttrModifier.prototype.setNewRenderType = function(new_type) {
        this.new_render_type = new_type;
    };
    AttrModifier.prototype.resetNewRenderType = function() {
        this.new_render_type = this.attr.renderType;
    };
    AttrModifier.prototype.typeChangeRequested = function() {
        return this.new_type !== this.attr.attrType;
    };
    AttrModifier.prototype.markForScopeChange = function(new_scope) {
        this.new_scope = new_scope;
    };
    AttrModifier.prototype.scopeChangeRequested = function() {
        return !_.isEmpty(this.new_scope);
    };
    AttrModifier.prototype.metaInfoUpdated = function() {
        //this wasn't working because initially, metadata can be an empty object
        // return !_.isEmpty(this.attr.metadata) && !_.isEqual(this.newMetaData, this.attr.metadata);
        return !_.isEmpty(this.newMetaData) && !_.isEqual(this.newMetaData, this.attr.metadata);

    };
    AttrModifier.prototype.attrModified = function() {
        return this.typeChangeRequested()
            || this.new_render_type !== this.attr.renderType
            || this.title !== this.attr.title
            || this.visible !== this.attr.visible
            || this.isStarred !== this.attr.isStarred
            || this.searchable !== this.attr.searchable
            || this.visibleInProfile !== this.attr.visibleInProfile
            || this.scopeChangeRequested()
            || this.metaInfoUpdated();
    };
    AttrModifier.prototype.applyModifications = function() {
        $rootScope.$broadcast(BROADCAST_MESSAGES.project.load, {});
        if(this.typeChangeRequested()) {
            this.changeType();
            $rootScope.$broadcast(BROADCAST_MESSAGES.attr.typeChanged, { id: this.attr.id, attrType: this.new_type });
        }
        if(this.scopeChangeRequested()) {
            this._changeScope();
        }
        if(this.metaInfoUpdated()) {
            this._changeMetaInfo();
        }
        this.attr.visible = this.visible;
        this.attr.isStarred = this.isStarred;
        this.attr.searchable = this.searchable;
        this.attr.visibleInProfile = this.visibleInProfile;
        this.attr.title = this.title;
        this.attr.renderType = this.new_render_type;
    };
    AttrModifier.prototype._changeMetaInfo = function() {
        _.assign(this.attr.metadata, this.newMetaData);
    };
    AttrModifier.prototype.validateChange = function() {
        var attr = this.attr,
            entities = this.__entities,
            new_type = this.new_type;
        // Validate searchable toggle
        if (this.searchable !== this.attr.searchable &&
            (['integer', 'float'].indexOf(this.attr.attrType) !== -1) ||
            !this.visible) { return false; } // can't change searchable for numeric attrs or hidden attrs
        if(new_type === 'color') return false; // can't change to color just yet
        var converter = valueConverter(new_type, attr.attrType, _.bind(this.genTypeInfo, this));
        if(converter) {
            return _.every(entities, function(entity) {
                if(entity.attr[attr.id] != null) {
                    // test conversion
                    var newVal = converter(entity.attr[attr.id]);
                    return newVal != null;
                }
                return true;
            });
        } else {
            return false;
        }
    };
    AttrModifier.prototype.changeType = function() {
        var attr = this.attr,
            entities = this.__entities,
            new_type = this.new_type;

        console.group('AttrModifier.currentType');
        if(this.validateChange(new_type)) {
            var converter = valueConverter(new_type, attr.attrType, _.bind(this.genTypeInfo, this));
            console.log("Updating entities...");
            _.each(entities, function(entity) {
                if(entity.attr[attr.id] != null) {
                    var newVal = converter(entity.attr[attr.id]);
                    if(_.isArray(newVal) && newVal.length === 0) { // empty liststring case
                        delete entity.attr[attr.id];
                    } else entity.attr[attr.id] = newVal;
                }
            });

            // change all the networks of the attribute was in dataset as well
            if(attr.fromDataset || this.__isDataset) {
                console.log("Updating networks as well");
                _.each(networkService.getNetworks(), function(nw) {
                    _.each(nw.nodes, function(node) {
                        if(node.attr[attr.id] != null) {
                            var newVal = converter(node.attr[attr.id]);
                            if(_.isArray(newVal) && newVal.length === 0) {
                                delete node.attr[attr.id];
                            } else node.attr[attr.id] = newVal;
                        }
                    });
                });
            }
            console.log("Resetting attrDescriptor....");
            this.typeInfo = null; // reset type Info
            this.attr.attrType = new_type;
            AttrSanitizeService.sanitizeAttr(this.attr, entities);
            // this.attr.isNumeric = this.attr.attrType === 'integer' || this.attr.attrType === 'float' || attr.attrType === 'timestamp';
            // this.attr.isInteger = this.attr.attrType === 'integer' || attr.attrType === 'timestamp';
            // this.attr.isTag = this.attr.attrType === 'liststring';
            this._sanitizeRenderType();
            console.log("Final attrDesc:", this.attr);
        } else {
            console.warn("[AttrService.changeType] Validation failed. can't change value");
            throw new Error("Validation failed. can't change value");
        }
        console.groupEnd();
    };

    AttrModifier.prototype._sanitizeRenderType = function() {
        console.log('Attr type: ' + this.new_type);
        console.log('Attr render type: ' + this.new_render_type);
        var newRenderTypes = AttrInfoService.getRenderTypes(this.new_type);
        if(_.contains(newRenderTypes, this.new_render_type)) {
            console.log('Current render type supported for new attr type');
        }
        else {
            console.log('Current render type not supported for new attr type, setting to first render type');
            this.setNewRenderType(newRenderTypes[0]);
        }
    };

    AttrModifier.prototype._changeScope = function() {
        var self = this;
        var networks = networkService.getNetworks();
        var currentNetwork = networkService.getCurrentNetwork();
        var dataset = dataService.currDataSetUnsafe();
        if(this.new_scope == 'local' && this.__isDataset) {
            // Move from dataset to current network
            _copyAttrInDsOrNw(self.attr.id, dataset.datapoints, currentNetwork.nodes, 'id', 'dataPointId');
            // Push attr descriptors to Nw
            var attrDescr = _.find(dataset.attrDescriptors, 'id', self.attr.id);
            currentNetwork.nodeAttrDescriptors.push(attrDescr);
            // Remove attrs from DS attrDescrs
            var dsAttrIdx = _.findIndex(dataset.attrDescriptors, 'id', self.attr.id);
            if(dsAttrIdx > -1) dataset.attrDescriptors.splice(dsAttrIdx, 1);
            // Remove attrs from datapoints
            _removeAttrFromEntities(self.attr.id, dataset.datapoints);
            // Update attr info obj
            AttrInfoService.getNodeAttrInfoForRG().updateAttrDescForId(attrDescr, currentNetwork.nodes);

        }
        else if(this.new_scope == 'global' && !this.__isDataset) {
            // Move from all networks to dataset. Use current network's values.
            _copyAttrInDsOrNw(self.attr.id, currentNetwork.nodes, dataset.datapoints, 'dataPointId', 'id');
            // Push attr descriptors to DS
            attrDescr = _.find(currentNetwork.nodeAttrDescriptors, 'id', self.attr.id);
            dataset.attrDescriptors.push(attrDescr);
            // Remove attrs from NWs attrDescrs
            _.each(networks, function(network) {
                var nwAttrIdx = _.findIndex(network.nodeAttrDescriptors, 'id', self.attr.id);
                if(nwAttrIdx > -1) network.nodeAttrDescriptors.splice(nwAttrIdx, 1);
                // Remove attrs from NW nodes
                _removeAttrFromEntities(self.attr.id, network.nodes);
            });
            // Update attr info obj
            AttrInfoService.getNodeAttrInfoForRG().updateAttrDescForId(attrDescr, dataset.datapoints);
        }
    };

    AttrModifier.prototype.markForRemoval = function() {
        this.attrToBeRemoved = true;
    };

    AttrModifier.prototype.markedForRemoval = function() {
        return this.attrToBeRemoved || false;
    };

    AttrModifier.prototype.removeAttr = function() {
        var entities = this.__entities;
        var attr = this.attr;
        console.log("Updating entities...");
        _removeAttrFromEntities(attr.id, this.__entities);
        console.log("Updated entities: ", entities);
    };

    AttrModifier.prototype.genTypeInfo = function() {
        var attr = this.attr,
            entities = this.__entities;

        if(this.typeInfo) return this.typeInfo;

        this.typeInfo = __genTypeInfoForAttr(attr.id, entities);
        return this.typeInfo;
    };





    /*************************************
    ********* Core Functions *************
    **************************************/

    // in place ordering change
    function updateOrdering(attrDescriptors, orderedIds) {
        var existingAttrIds = _.pluck(attrDescriptors, 'id');

        if(attrDescriptors.length !== orderedIds.length) { // check length
            throw new Error('Node Attrs count not same');
        }
        if(_.union(existingAttrIds, orderedIds).length !== existingAttrIds.length) { // check similarity
            throw new Error("Node ids don't match");
        }
        var attrIdx = _.indexBy(attrDescriptors, 'id');
        var newlyOrdered = _.reduce(orderedIds, function(acc, attrId) {
            acc.push(attrIdx[attrId]);
            delete attrIdx[attrId];
            return acc;
        }, []);
        attrDescriptors.length = 0;
        _.each(newlyOrdered, function(attr) {
            attrDescriptors.push(attr);
        });
        return attrDescriptors;
    }

    function buildAttrMetaClone(metaData) {
        var clone = _.clone(metaData);
        attrMetaProps.forEach(function(key) {
            if(!_.has(clone, key)) {
                clone[key] = '';
            }
        });
        return clone;
    }

    function _removeAttrFromEntities(attrId, entities) {
        _.each(entities, function(entity) {
            if(_.has(entity.attr, attrId)) {
                delete entity.attr[attrId];
            }
        });
    }

    function _copyAttrInDsOrNw(attrId, entities, newEntities, id, newId) {
        _.each(entities, function(entity) {
            var newEntity = _.find(newEntities, newId, entity[id]);
            newEntity.attr[attrId] = entity.attr[attrId];
        });
    }

    // everything can be converted to string
    // typeladder aka srcType -> tgtType
    // var typeLadder = {
    //  'liststring' : [],
    //  'float' : ['int', 'string'],
    //  'int' : ['float', 'string'], // only if isIntegerLike.
    //  'boolean' : ['int', 'float', 'string'],
    //  'string' : // can go anywhere
    // };
    // return null if it can't create a converted
    // returns a convert from val -> val to convert from current -> target type
    function valueConverter (targetType, currentType, genTypeInfo) {
        var updater = null;
        if(targetType === currentType || (_isStringLike(targetType) && _isStringLike(currentType))) {
            updater = _.identity;
            return updater;
        }

        if(_isStringLike(targetType)) {
            if(currentType === 'liststring') updater = function(val) { return '' + val.join(' | '); };
            else if(currentType === 'timestamp') updater = function(val) { return window.moment.unix(val).utc().toString(); };
            else updater = function(val) { return '' + val; };
            return updater;
        }

        if(targetType === 'liststring') {
            if(currentType === 'string') updater = _toListString;
            else return null;
        }
        var typeInfo = genTypeInfo();
        if(targetType === 'float') {
            if(typeInfo.isNumericLike)         updater = function(val) { return Number(val); };
            else if(currentType === 'boolean') updater = function(val) { return val ? 1 : 0 ;};
            else return null;
        }

        if(targetType ===  'integer') {
            if(typeInfo.isIntegerLike)         updater = function(val) { return Number(val); };
            else if(typeInfo.isNumericLike)    updater = function(val) { return Number(val) - (Number(val) % 1); };
            else if(currentType === 'boolean') updater = function(val) { return val ? 1 : 0 ;};
            else return null;
        }
        if(targetType === 'timestamp') {
            if(typeInfo.isIntegerLike)         updater = function(val) { return window.moment.unix(Number(val)).unix(); };
            else if(typeInfo.isNumericLike)    updater = function(val) { return window.moment.unix(Number(val) - (Number(val) % 1)).unix(); };
            else {
                var res = _.all(typeInfo.numValues, function(val) {
                    var d = new Date(val);
                    return d.toString() !== "Invalid Date";
                });
                if(res) {
                    updater = function(val) { return window.moment(new Date(val)).unix(); };
                } else return null;
            }
        }

        if(targetType === 'boolean') {
            if( typeInfo.numValues === 2) updater = function(val) { return typeInfo.values[0] == val; };
            else return null;
        }

        if(targetType === 'year') {
            if(typeInfo.isIntegerLike)  updater = function(val) { return Number(val); };
            else return null;
        }

        return updater;
    }


    // Used for type conversion during data ingestion
    function valueConverterForAttr (targetType, currentType, attrId, entities) {
        return valueConverter(targetType, currentType, function() { return __genTypeInfoForAttr(attrId, entities); });
    }
    function valueConverterForValues (targetType, currentType, values) {
        return valueConverter(targetType, currentType, function() { return __genTypeInfo(values); });
    }

    function __genTypeInfoForAttr(attrId, entities) {
        var values = _.map(entities,'attr.' + attrId);
        return __genTypeInfo(values);
    }

    function __genTypeInfo(values) {
        var isNum = true, isInt = true;
        _.each(values, function(val) {
            if(val == null) return; //Non-existent values should not affect type change
            if(isNum && !isNaN(+val)) { // convert value to number test for NaN
                val = +val;
                if(isInt && val % 1 === 0) {// check if integer
                    // hmm...good for you attr :)
                } else {
                    isInt = false;
                }
            } else {
                isNum = false;
                isInt = false;
                return false;
            }
        });

        return {
            isNumericLike : isNum,
            isIntegerLike : isInt,
            numValues : values.length
        };
    }

    // function _getColor (val) {
    //     var col =  color(val) || color("rgb(" + val + ")") || color("rgba(" + val + ')');
    //     return col ? col : undefined;
    // }
    function _toListString(val) {
        return _.filter(val.split(liststring_splitter), function(elem) { return elem.length > 0; });
    }
    function _isStringLike(valType) {
        return _.contains(stringTypes,valType);
    }
}]);
