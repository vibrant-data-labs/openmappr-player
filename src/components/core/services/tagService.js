angular.module('common')
.service('tagService', ['$q', 'renderGraphfactory',
function($q, renderGraphfactory) {
    "use strict";
    // Node ids stored are for dataGraph only, no aggregations here

    /*************************************
    *************** API ******************
    **************************************/
    this.tagSoup   = tagSoup;
    this.tagStrat  = tagStrat;
    this.strategy  = strategy;
    this.getTagIds = getTagIds;
    this.aggStrat  = aggStrat;

    this.toggleAggrStrat = toggleAggrStrat;
    this.tagNodes        = tagNodes;
    this.isTagged        = isTagged;
    this.getNodeIdsTagged= getNodeIdsTagged;
    this.setTagStrat     = setTagStrat;
    this.runTagStrat     = runTagStrat;
    this.runStrat        = runStrat;



    /*************************************
    ********* Local Data *****************
    **************************************/
    // Tag Id -> Tag Info map
    var tagSoup = {};

    // Tag strategy map. Id -> Strat
    var tagStrat = {};

    // There are 3 strats:
    // 1) None
    // 2) Exclude selected
    // 3) exclude others
    var strategy = {
        NONE: 'none',
        SELECT_ONLY: 'select_only',
        EXCLUDE: 'exclude'
    };

    var aggStrat = 'any'; // || or all.


    /*************************************
    ********* Core Functions *************
    **************************************/

    var idGen = _.partial(_.uniqueId,'tag_');

    function TagInfo (tagId, name, nodeIds) {
        this.tagId = tagId;
        this.name = name;
        this.nodeIds = nodeIds;
        this.visible = true; // shouldn't be here!
        this.include = true;
        this.numNodes = nodeIds.length;
    }

    function getId () {
        var _uniqueId = idGen();
        return _uniqueId;
    }

    function tagNodes (name, nodeIds) {
        var tag = new TagInfo(getId(), name, nodeIds);
        tagSoup[tag.tagId] = tag;
        return tag;
    }

    function isTagged (tagId, nodeId) {
        var tagInfo = tagSoup[tagId];
        return _.some(tagInfo.nodeIds, function(x) { return x === nodeId;});
    }
    function getNodeIdsTagged (tagId) {
        if(tagSoup[tagId])  {
            return tagSoup[tagId].nodeIds;
        } else {
            throw 'Tag Id is invalid!';
        }
    }

    function setTagStrat (tagId, strat) {
        console.assert(strategy[strat], 'Tag Strategy key should be valid');
        tagStrat[tagId] = strategy[strat];
    }

    function runTagStrat (tagId) {
        console.log('[tagging] Applying strategy for tag: %s', tagId);
        var strat = tagStrat[tagId];

        var sig = renderGraphfactory.sig();
        var rgraph = sig.graph;

        var hideCount = 0, showCount = 0;

        var matchStrat = _.noop;
        var nonMatchStrat = _.noop;
        if(strat === strategy.NONE) {
            matchStrat = function(node) {
                showCount += 1;
                node.hidden = false;
            };
            nonMatchStrat = matchStrat;
        } else if(strat === strategy.SELECT_ONLY) {
            matchStrat = function(node) {
                showCount += 1;
                node.hidden = false;
            };
            nonMatchStrat = function(node) {
                hideCount += 1;
                node.hidden = true;
            };

        } else if(strat === strategy.EXCLUDE) {
            matchStrat = function(node) {
                hideCount += 1;
                node.hidden = true;
            };
            nonMatchStrat = function(node) {
                showCount += 1;
                node.hidden = false;
            };
        }

        _.each(rgraph.nodes(), function rts (node) {
            if(node.isAggregation) {
                var aggIds = _.pluck(node.aggregatedNodes, 'id');
                var method = aggStrat === 'any' ? _.some : _.every;

                if(method(aggIds, _.partial(isTagged, tagId))) {
                    matchStrat(node);
                } else {
                    nonMatchStrat(node);
                }
            } else {
                if(isTagged(tagId, node.id)) {
                    matchStrat(node);
                } else {
                    nonMatchStrat(node);
                }
            }
        });

        console.log('[tagging] Hidden %i nodes', hideCount);
        console.log('[tagging] showing %i nodes', showCount);
    }

    function runStrat () {
        _.each(tagStrat, function rss (strat, tagId) {
            runTagStrat(tagId);
        });
    }
    function getTagIds () {
        return _.keys(tagSoup);
    }

    function toggleAggrStrat () {
        aggStrat = aggStrat === 'any' ? 'all' : 'any';
        return aggStrat;
    }

}
]);