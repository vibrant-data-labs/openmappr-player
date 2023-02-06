/**
* Partitions data based on an attribute
*/
angular.module('common')
.service('partitionService', ['$q', 'AttrInfoService',
function($q, AttrInfoService) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.Partition = Partition;
    this.genPartitionedNodeAttrInfos_light = genPartitionedNodeAttrInfos_light;




    /*************************************
    ********* CLASSES ********************
    **************************************/
    /**
     * The partition class
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    function Partition() {
        this.id = _.uniqueId('partition_');
        this.parts = {};
    }

    /**
     *
     * Generates partitions based on a an attribute
     *
     * @param  {array} nodes A list of nodes
     * @param  {string} attrib The partitioning attribute
     * @param  {string} sortedAttrib The partitions are sorted using this attribute value
     *
     */
    Partition.prototype.generateByAttr = function generateByAttr(nodes, attrib, sortAttrib) {
        var self = this;

        //refresh parts
        self.parts = {};

        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attrib);

        _.each(nodes, function(n) {
            var at = n.attr[attrib];
            if(self.parts[at]){
                //if sorting attrib exists push node into sorted partition
                if(sortAttrib){
                    var idx = _.sortedIndex(self.parts[at].nodes, n, function(node){return node.attr[sortAttrib];});
                    self.parts[at].nodes.splice(idx, 0, n );
                } else {
                    self.parts[at].nodes.push(n);
                }

            } else {
                self.parts[at] = {nodes:[], stats:{}};
            }
        });

        _.each(self.parts, function(part){
            part.stats.count = part.nodes.length;
            part.stats.weight = part.stats.count/nodes.length;
            if(attrInfo.isNumeric) {
                part.stats.max = _.max(part.nodes, function(node){return node.attr[sortAttrib]; });
                part.stats.min = _.min(part.nodes, function(node){return node.attr[sortAttrib]; });
            }
        });
    };

    /**
     *
     * Sorts exisiting partitions based on a an attribute
     *
     * @param  {string} attrib The partitioning attribute
     *
     */
    Partition.prototype.sortByAttrib = function sort(sortAttrib) {
        var self = this;

        _.each(self.parts, function(part) {
            part = _.sortBy(part, function(node){
                return node.attr[sortAttrib];
            });
        });
    };



    /*************************************
    ********* Local Data *****************
    **************************************/
    var logPrefix = "[PartitionService] ";





    /*************************************
    ********* Core Functions *************
    **************************************/

    /**
     * Generates attrInfo for partitioned entities.
     * _light means it generates light info, not suitable for distributions.
     *  basically .bounds for Numeric attrs, .values for Ordinals
     * @param  {Attray} entities             The entities to analyse
     * @param  {AttributeId} attrId          The attribute of which the info has to be generated
     * @param  {AttributeId} partitionAttrId the attribute on which the partition happens
     * @return {{AttrInfo}}                  a mapping from ParitionValue -> AttrInfo Objects of attrId for each partitions
     */
    function genPartitionedNodeAttrInfos_light(entities, attrId, partitionAttrId) {
        console.time(logPrefix + '[genPartitionedNodeAttrInfos_light] call');
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attrId);
        var infoGenFn = attrInfo.isNumeric ? _genNumericAttrInfo_Light : _genOrdinalAttrInfo_Light;
        infoGenFn = _.partial(infoGenFn, attrId);
        var res =  _(entities)
            .groupBy('attr.' + partitionAttrId)
            .mapValues(infoGenFn)
            .mapValues(function(info) {
                return _.assign(info, {
                    isNumeric   : attrInfo.isNumeric,
                    isInteger   : attrInfo.isInteger,
                    existsOnAll : attrInfo.existsOnAll,
                    isTag       : attrInfo.isTag
                });
            }).value();
        console.timeEnd(logPrefix + '[genPartitionedNodeAttrInfos_light] call');
        return res;
    }

    function getNumericBounds (values) {
        return {
            max: Math.round(d3.max(values)*100)/100,
            //quantile_90: Math.round(d3.quantile(values,0.90)*100)/100,
            quantile_75: Math.round(d3.quantile(values,0.75)*100)/100,
            median: Math.round(d3.median(values)*100)/100,
            quantile_25: Math.round(d3.quantile(values,0.25)*100)/100,
            //quantile_10: Math.round(d3.quantile(values,0.10)*100)/100,
            min: Math.round(d3.min(values)*100)/100,
            mean: Math.round(d3.mean(values)*100)/100
        };
    }


    /*************************************
    ********* Local Functions ************
    **************************************/
    function _genNumericAttrInfo_Light (attrId, entities) {
        return {
            bounds : getNumericBounds(_.map(entities, 'attr.' + attrId)),
            values : _.map(entities, 'attr.' + attrId)
        };
    }
    function _genOrdinalAttrInfo_Light (attrId, entities) {
        var values = _.map(entities, 'attr.' + attrId);
        return {
            values : values,
            valuesCount : _.countBy(values)
        };
    }
}
]);
