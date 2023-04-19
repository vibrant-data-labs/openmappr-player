angular.module('common')
.directive('dirExtUserOverlay',['$timeout', '$rootScope', 'dataGraph', 'graphSelectionService', 'AttrInfoService', 'FilterPanelService', 'layoutService', 'networkService', 'projFactory', 'BROADCAST_MESSAGES',
function($timeout, $rootScope, dataGraph, graphSelectionService, AttrInfoService, FilterPanelService, layoutService, networkService, projFactory, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        templateUrl: "#{player_prefix_index}/components/project/overlays/ext_user_overlay/extUserOverlay.html",
        scope: {
            loadInfo: '=',
            mapprSettings: '=',
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirExtUserOverlay: ] ';


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.loadDistr = false;

        $timeout(buildUserView);

        function buildUserView() {
            console.log('scope.loadInfo: ', scope.loadInfo);
            scope.loadDistr = true;

            //should be soemwhere else
            // var defaultUserPic = 'https://s3-us-west-1.amazonaws.com/mappr-survey-misc/img/survey-profile-img.png';

            // Cluster attr
            var highlightAttr = _.find(dataGraph.getNodeAttrs(), 'id', 'cluster_tags');
            scope.clusterAttr = highlightAttr ?_.clone(highlightAttr) : _.clone(_.find(dataGraph.getNodeAttrs(), 'id', 'Cluster'));
            console.log('scope.clusterAttr: ', scope.clusterAttr);

            scope.showFocusNode = false;

            //name
            scope.userName = scope.loadInfo.userName;

            //pic
            scope.userPicUrl = scope.loadInfo.userPicUrl;

            //see if default picture
            // if(scope.userPicUrl === defaultUserPic) {
            //  scope.linkPicBackToSurvey = true;
            // }

            //color and cluster name computed from similar (externally linked) nodes
            scope.extLinkedNodes = _.take(_.map(scope.loadInfo.nodeIdsToSelect, function(id){
                return dataGraph.getRenderableGraph().getNodeById(id);
            }), 3);

            // User cluster color and cluster vals
            var clustNColorObj = getColorNClusterVals(scope.extLinkedNodes);
            scope.loadInfo.clusterColor = scope.clusterColor = clustNColorObj.principalColor;
            scope.clusterAttr.principalVal = clustNColorObj.sortedClusterVals;
            scope.clusterSuggestionsMap = clustNColorObj.clusterSuggestions;

            //scope.customTitle = "People like you tend to have these creative habits:";
            if(scope.clusterAttr.principalVal.length > 1){
                scope.customTitle = "Your "+scope.clusterAttr.title+" bridges " + scope.clusterAttr.principalVal.length + " different groups:";
                scope.customTitleTooltip = "Not everyone is a perfect fit to one "+scope.clusterAttr.title+" cluster - your matches are multiple colors indicating that your individual "+scope.clusterAttr.title+" spans different groups.";
            } else {
                scope.customTitle = "Your "+scope.clusterAttr.title+" is similar to the " + scope.clusterAttr.principalVal[0] + " group";
                scope.customTitleTooltip = "Your matches have the same color, indicating that your "+scope.clusterAttr.title+" is well represented by this group.";
            }

            scope.customNeighborTitle = "Your "+scope.clusterAttr.title+" is most similar to";

            // Distribution attrs found in parsed URL data
            var distrDataMap = getDistrDataMap(scope.loadInfo.userDistrVals);
            scope.distrAttrs = getDistrAttrs(distrDataMap);

            //setup node for focusNode
            scope.focusNode = {
                colorStr: scope.clusterColor,
                attr: {
                    'userPic': scope.userPicUrl,
                    'Cluster': scope.clusterAttr.principalVal[0],
                    'extUserClusters': scope.clusterAttr.principalVal
                }
            };
            _.assign(scope.focusNode.attr, distrDataMap);

            // Set dummy user node selection for renderers to highlight
            FilterPanelService.updateInitialSelection([scope.focusNode]);
            var layout = layoutService.getCurrentIfExists();
            if(layout) {
                FilterPanelService.genColorString(layout.setting('nodeColorAttr'));
            }

            scope.nodeImageAttr = 'userPic';

            scope.nodeStartData = {
                x: window.innerWidth - 10,
                y: 10,
                size: 20
            };

            //end position and size
            scope.nodeEndData = {
                x: window.innerWidth/2-415,
                y: window.innerHeight/2,
                size: 150
            };


            //may not need
            if($scope.mapprSettings.nodeFocusRenderTemplate == 'node-right-panel') $scope.beginOverlayRightPanel= true;
            else $scope.beginOverlayAnim = true;
            //finally show the node
            scope.showFocusNode = true;


            $rootScope.$broadcast(BROADCAST_MESSAGES.nodeOverlay.creating);
            $rootScope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.open);
        }


        scope.$on(BROADCAST_MESSAGES.search, function() {
            scope.closeExtUserOverlay();
        });

        scope.closeExtUserOverlay = function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.close);
            $rootScope.$broadcast(BROADCAST_MESSAGES.nodeOverlay.removing, {clearSelections: false});
        };

        scope.attrRenderClicked = function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.close, {distrClick: true});
        };

        scope.goBackToSurvey = function() {
            window.parent.postMessage({
                section: 'participate'
            },"*");
        };

        //for when finished (show overlay)
        scope.finishAnimation = function() {
            scope.showOverlay = true;
            scope.showNeighborNode = false;
            scope.hideContent = false;
            scope.neighborNode = null;

            $timeout(function() {
                scope.scrollPaddingTop = $(window).height()/2 - 240;
                scope.shareMarginTop = -($(window).height()/2 - scope.scrollPaddingTop - 80);

                $('#detailbox-scroll').on('scroll', function() {
                    scope.removeNeighborLine();
                });

                $('.share-btn').on('mouseenter', function() {
                    $(this).css({
                        color: scope.clusterColor,
                        borderColor: scope.clusterColor
                    });
                });

                $('.share-btn').on('mouseleave', function() {
                    $(this).css({
                        color: '',
                        borderColor:''
                    });
                });
            });


        };


        scope.getNodeCircleStyle = function() {
            var obj = {
                borderColor: scope.clusterColor,
                backgroundColor: scope.clusterColor
            };

            if(scope.userPicUrl) {
                obj.backgroundImage = 'url('+scope.userPicUrl+')';
            }
            return obj;

        };

        //
        // BEGIN SAME METHODS AS ctrlNodeOverlay

        //neighbor switch stuff
        scope.switchToNeighbor = function(node, $event) {



            scope.neighborNodeImageAttr =  scope.mapprSettings.nodePopImageAttr || scope.mapprSettings.nodeImageAttr;

            scope.hideContent = true;
            scope.removeNeighborLine();

            //select node in graph here so can
            scope.neighborNode = dataGraph.getRenderableGraph().getNodeById(node.id);

            graphSelectionService.selectByIds(Array(scope.neighborNode.id));

            //get position of neighbor clicked
            var $nDiv = $($event.currentTarget);
            var pos = $nDiv.offset();
            var top = pos.top+$nDiv.height()/2;

            //objects to pass to dirNodeFocus
            //start position and size
            scope.neighborNodeStartData = {
                x: pos.left-475,
                y: top,
                size: 55
            };
            //end position and size
            scope.neighborNodeEndData = {
                x: window.innerWidth/2-415,
                y: window.innerHeight/2,
                size: 150
            };
            //finally show the node
            scope.showNeighborNode = true;

        };

        //for when finished (show overlay)
        scope.finishNeighborAnimation = function() {
            scope.showFocusNode = false;
            $rootScope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.close, {switchedToNeighbour: true});

        };
        //neighbor line drawing

        scope.drawNeighborLine = function(node, $event) {
            //get position of neighbor over
            var $nDiv = $($event.currentTarget);
            var pos = $nDiv.offset();
            //use width because close to circle size
            var top = pos.top+$nDiv.width()/2;
            var left = pos.left+$nDiv.width()/2-475;
            var top2 = window.innerHeight/2;
            var left2 = window.innerWidth/2-415;
            drawLink(left, top, left2, top2, node.colorStr, scope.clusterColor, 3);
            scope.showNeighborLine = true;
        };

        scope.removeNeighborLine = function() {
            //kill line
            scope.showNeighborLine = false;
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/

    //for drawing div line
    function drawLink(x1, y1, x2, y2, color1, color2, height){
        //swap colors if y1 > y2
        if(y1 > y2) {
            var c = color1;
            color1 = color2;
            color2 = c;
        }

        if(y1 < y2){
            var pom = y1;
            y1 = y2;
            y2 = pom;
            pom = x1;
            x1 = x2;
            x2 = pom;
        }

        var a = Math.abs(x1-x2);
        var b = Math.abs(y1-y2);
        var sx = (x1+x2)/2 ;
        var sy = (y1+y2)/2 ;
        var width = Math.sqrt(a*a + b*b ) ;
        var x = sx - width/2;
        var y = sy;

        a = width / 2;

        c = Math.abs(sx-x);

        b = Math.sqrt(Math.abs(x1-x)*Math.abs(x1-x)+Math.abs(y1-y)*Math.abs(y1-y) );

        var cosb = (b*b - a*a - c*c) / (2*a*c);
        var rad = Math.acos(cosb);
        var deg = (rad*180)/Math.PI;
        var $div = $('.neighbor-line');
        console.log('height: ', height);
        $div.css({
            width: width,
            height: height,
            transform: 'rotate('+deg+'deg)',
            position:'absolute',
            top:y,
            left:x,
            background: 'linear-gradient(to right, '+color1+', '+color2+')'
        });

    }

    function getColorNClusterVals(nodes) {
        var clustColor = 'rgb(153,204,0)',
            clustColorMap = {},
            clustName = 'not found yet',
            clustNameMap = {};

        _.each(nodes, function(nd) {
            //color
            clustColor = nd.colorStr;
            clustColorMap[clustColor] = (typeof clustColorMap[clustColor] === 'undefined')
                ? 1
                : clustColorMap[clustColor] + 1;

            //cluster name
            clustName = nd.attr['Cluster'];
            clustNameMap[clustName] = (typeof clustNameMap[clustName] === 'undefined')
                ? 1
                : clustNameMap[clustName] + 1;
        });

        var colorKeysSorted = Object.keys(clustColorMap).sort(function(a,b){return clustColorMap[b]-clustColorMap[a];});
        var clustKeysSorted = Object.keys(clustNameMap).sort(function(a,b){return clustNameMap[b]-clustNameMap[a];});
        var clusterSuggestions = _.map(clustKeysSorted, function(clusterVal) {
            return {
                clusterVal: clusterVal,
                suggestion: projFactory.getClusterSuggestion(networkService.getCurrentNetwork().id, 'Cluster', clusterVal)
            };
        });
        return {
            principalColor: colorKeysSorted[0],
            sortedClusterVals: clustKeysSorted,
            clusterSuggestions: clusterSuggestions
        };
    }

    function getDistrDataMap(userDistrDataArr) {
        //build distribution Objects. the loadinfo has key_vals separated by '_';

        return _.reduce(userDistrDataArr, function(acc, val) {
            var key_val = val.split('_');
            var floatVal = parseFloat(key_val[1]);
            acc[key_val[0]] = _.isNaN(floatVal) ? key_val[1] : floatVal;
            return acc;
        }, {});
    }

    function getDistrAttrs(distrDataMap) {
        var infoObj = AttrInfoService.getNodeAttrInfoForRG();
        var distrAttrs = [];

        _.each(dataGraph.getNodeAttrs(), function(attr) {
            if(AttrInfoService.isDistrAttr(attr, infoObj.getForId(attr.id))) {
                var attrClone = _.clone(attr);
                var attrVal = distrDataMap[attrClone.id];
                if(attrVal == null) {
                    console.info(logPrefix + 'Ignoring Attr ' + attrClone.id + ' as it has no value for external user');
                    return;
                }
                attrClone.showFilter = false;
                //skip cluster attr. special treatment
                if(attrClone.id !== 'Cluster'){
                    // console.log(attrClone.id,userDistrObjs[attrClone.id]);
                    attrClone.principalVal = distrDataMap[attrClone.id];
                    distrAttrs.push(attrClone);
                }
            }
        });

        return distrAttrs;
    }

    return dirDefn;
}
]);
