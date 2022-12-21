angular.module('common')
.directive('dirNeighbors', ['$timeout', 'dataGraph', 'linkService','zoomService', 'hoverService', 'selectService',
function ($timeout, dataGraph, linkService, zoomService, hoverService, selectService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
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
    function postLinkFn(scope, element, attrs) {
        var links, hasLinks, incomingEdgesIndex, outgoingEdgesIndex;
        scope.ui = {
            imageShow : scope.mapprSettings.nodeImageShow
        };
        if (scope.focusNode) {

            var node = scope.focusNode;
            var dataset = dataGraph.getRawDataUnsafe();

            // link vars
            incomingEdgesIndex = dataset.edgeInIndex[node.id];
            outgoingEdgesIndex = dataset.edgeOutIndex[node.id];
            hasLinks = scope.hasLinks = _.size(incomingEdgesIndex) + _.size(outgoingEdgesIndex) > 0;

        }

        if (hasLinks || scope.extLinkedNodes) {
            if (scope.extLinkedNodes) {
                scope.hasLinks = true;
                links = constructNeighborInfo(scope.extLinkedNodes);
            } else {
                links = linkService.constructLinkInfo(node, incomingEdgesIndex, outgoingEdgesIndex, scope.mapprSettings.labelAttr, scope.mapprSettings.nodeImageAttr);
                scope.numLinks = links.length;
            }
            const onlySourceLink = links.filter(link => link.targetId !== node.id);
            scope.links = filterLinks(onlySourceLink);
            
        } else {
            console.log('dirNeighbors', "Node has no links to other nodes");
        }

        scope.onHover = function(link) {
            hoverService.hoverNodes({ ids: [link.linkNode.id], force: true});
        };

        scope.onHoverOut = function() {
            hoverService.unhover();
        };

        scope.onNeighborClick = function(link) {
            selectService.selectSingleNode(link.linkNode.id);
            
            var dataset = dataGraph.getRawDataUnsafe();
            var links = linkService.constructLinkInfo(link.linkNode, 
                dataset.edgeInIndex[link.linkNode.id], 
                dataset.edgeOutIndex[link.linkNode.id], 
                scope.mapprSettings.labelAttr, 
                scope.mapprSettings.nodeImageAttr);
            const onlySourceLink = links.filter(link => link.targetId !== link.linkNode.id);
            scope.links = filterLinks(onlySourceLink);
        }

        function filterLinks(links){
            var newLinks = [];
            for (var i = 0; i < links.length; i++) {
                newLinks.push({
                    linkNode: links[i].linkNode,
                    attr: links[i].linkNode.attr,
                    name: getName(links[i].linkNode.attr),
                    lastName: links[i].linkNode.attr['Last Name'],
                    colorStr: links[i].linkNode.colorStr,
                    color: links[i].linkNode.color,
                    linkNodeLabel : links[i].linkNodeLabel,
                    linkNodeImage : links[i].linkNodeImage,
                });
            }
            return newLinks;
        }

        //if coming from outside source and not actually linked
        function constructNeighborInfo(linkNodes) {
            var links = [];
            _.each(linkNodes, function (linkNode) {

                var linkNodeLabel = linkNode.attr[scope.mapprSettings.labelAttr] || linkNode.label || 'missing label';
                var linkNodeImage = linkNode.attr[scope.mapprSettings.nodeImageAttr] || linkNode.attr[scope.mapprSettings.nodePopImageAttr] || linkNode.image || '';
                links.push({
                    attr: linkNode.attr,
                    name: getName(linkNode.attr),
                    lastName: linkNode.attr['Last Name'],
                    colorStr: linkNode.colorStr,
                    color: linkNode.color,
                    linkNodeLabel,
                    linkNodeImage,
                    // truncName: getName(linkNode.attr).substr(0, 15),
                });
            });

            console.log({links});

            return links;
        }

        //click (calls parent method. Maybe should move to attribute of this directive)
        scope.beginNeighborSwitch = function (linkNode, $event) {
            zoomService.restoreCamera();
            $($event.currentTarget).css({
                opacity: 0
            });
            setTimeout(function(){ 
                scope.switchToNeighbor(linkNode, $event); 
            }, 1000);
            
        };

        function getName(attrs){
            var completeName = attrs[scope.mapprSettings.labelAttr];
            
            var names = completeName.split(':');
                if (names.length == 2){
                    return {
                        name : names[0],
                        description: names[1]
                    }
                }
                return { name: completeName };
        }

    }
    return dirDefn;
}
]);
