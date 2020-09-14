angular.module('common')
.service('inputMgmtService', [function () {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.inputMapping = function() {return inputMapping;};

    sigma.utils.pkg('sigma.mgmt');

    ///
    /// There are 2 inputs hover , click and there shift variants. Which can be applied to 3 entities, stage, node and edges.
    /// This service manages the mapping and controls how to system responds to these settings.
    ///
    /// Node states:
    /// - off
    /// - greyed out
    /// - Default
    /// - highlighted
    /// - selected
    /// - pop
    /// - menu
    /// - focus
    ///
    /// Edge states
    /// - off
    /// - greyed
    /// - on
    ///
    /// What happens in a particular node state can also be configured as well. (in nodeStateMgmtService maybe)



    /*************************************
    ********* Local Data *****************
    **************************************/
    var inputMapping = {
        'clickStage': {
            node: 'default',
            nodeNeighbour: 'default',
            nodeRest: 'default',
            edge: 'default',
            edgeNeighbour: 'default',
            edgeRest: 'default'
        },
        'hoverStage': {
            node: 'default',
            nodeNeighbour: 'default',
            nodeRest: 'default',
            edge: 'default',
            edgeNeighbour: 'default',
            edgeRest: 'default'
        },
        'clickNode': {
            node: 'pop',
            nodeNeighbour: 'default',
            nodeRest: 'greyed',
            edge: 'default',
            edgeNeighbour: 'default',
            edgeRest: 'off'
        },
        'hoverNode': {
            node: 'highlighted',
            nodeNeighbour: 'default',
            nodeRest: 'default',
            edge: 'highlighted',
            edgeNeighbour: 'default',
            edgeRest: 'off'
        }
    };


}]);