angular.module('common')
.controller('layoutCtrl',['$scope', '$q', '$timeout', 'eventBridgeFactory', 'leafletData', 'layoutService', 'snapshotService', 'dataGraph', 'AttrInfoService' , 'zoomService', 'graphSelectionService', 'projFactory', 'playerFactory', 'BROADCAST_MESSAGES',
function ($scope, $q, $timeout, eventBridgeFactory, leafletData, layoutService, snapshotService, dataGraph, AttrInfoService, zoomService, graphSelectionService, projFactory, playerFactory, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var __debouncedRefresh = _.debounce(refreshLayout, 200);

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.mapprSettings = {};

    $scope.layoutHelpers = {
        switchGraph: switchGraph,
        refreshLayout:refreshLayout
    };

    //for temporarily disabling node overlay when doing node pop neighbor animation
    $scope.nodeOverlayProps = {
        enabled: true
    };

    /**
    * Scope methods
    */
    $scope.toggleNodeDetail = toggleNodeDetail;

    $scope.updateProjectSettings = function(key) {
        // dirSettingsInput uses $timeout to update ng-model
        $timeout(function() {
            switch(key) {
            case 'theme':
                changeProjectTheme($scope.projSettings.theme);
                break;
            default:
            }
        }, 250);
    };




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on('updateMapprSettings', updateMapprSettings); // hack to get mappr settings changing
    $scope.$watch('mapprSettings', mapprSettingsWatchFn, true); //Watch mapprSettings and update the snapshot layout object with the same.
    $scope.$on(BROADCAST_MESSAGES.sigma.resize, onSigmaResize);
    // $scope.$on(BROADCAST_MESSAGES.player.load, onPlayerLoad); // Custom create settings for player

    // Build a layout on snapshot change
    $scope.$on(BROADCAST_MESSAGES.snapshot.loaded, function(event, data) {
        createLayout(data.snapshot, $scope.plotType).then(function(layout) {
            $scope.$broadcast(BROADCAST_MESSAGES.layout.loaded, layout);
        });
    });
    $scope.$on(BROADCAST_MESSAGES.snapshot.changed, function(event, data) {
        createLayout(data.snapshot, $scope.plotType).then(function(layout) {
            $scope.$broadcast(BROADCAST_MESSAGES.layout.changed, layout);
        });
    });

    // Layout has been loaded, time to whir up the machinery
    $scope.$on(BROADCAST_MESSAGES.layout.loaded, function(event, layout) {
        onLayoutLoaded(event, layout, true);
    });

    $scope.$on(BROADCAST_MESSAGES.layout.changed, function(event, layout) {
        onLayoutLoaded(event, layout, false);
    });

    $scope.$on(BROADCAST_MESSAGES.project.load, function() {
        $scope.projSettings = projFactory.getProjectSettings();
    });

    $scope.$on(BROADCAST_MESSAGES.player.load, function() {
        $scope.projSettings = projFactory.getProjectSettings();
        onPlayerLoad();
    });

    $scope.$on(BROADCAST_MESSAGES.project.changeTheme, function(e, data) {
        if(data.theme !== undefined) changeProjectTheme(data.theme);
    });

    // Switch to light theme on exiting project
    $scope.$on('$destroy', function() {
        $scope.appUi.theme = 'light';
    });




    /*************************************
    ********* Initialise *****************
    **************************************/
    // Set default color theme on project load
    projFactory.currProject()
    .then(function() {
        var projSettings = projFactory.getProjectSettings();
        $scope.appUi.theme = _.get(projSettings, 'theme', 'light');
        if($scope.appUi.theme == 'light') {
            resetColors({
                theme: 'light',
                //STAGE
                backgroundColor: '#ffffff',//'rgb(255,255,255)',
                labelColor: '#000000',//colorStr([0, 0, 0]),
                labelOutlineColor : '#ffffff'
            });
        }
    });




    /*************************************
    ********* Core Functions *************
    **************************************/

    function updateMapprSettings(event, data) {
        console.log("UPDATING MAPPR SETTINGS!", data);
        _.each(data, function(value, key) {
            $scope.layout.setting(key, value);
        });
        _.extend($scope.mapprSettings, data);
    }

    function onSigmaResize() {
        var l = layoutService.getCurrentIfExists();
        if( l && l.plotType !== 'geo') {
            __debouncedRefresh.cancel();
            __debouncedRefresh(l);
        }
    }

    function mapprSettingsWatchFn(newVal, oldVal){
        if(oldVal === newVal) { return; }

        console.group('[layoutCtrl.$watch on mapprSettings]');
        console.log('[layoutCtrl] updating mapprSettings: oldVal: %O, newVal: %O', oldVal, newVal);
        if(oldVal.showNodeDetailOnLoad != null && oldVal.showNodeDetailOnLoad != newVal.showNodeDetailOnLoad) {
            if(newVal.layoutId === oldVal.layoutId) {
                // Ignore any updation
                console.warn('[layoutCtrl.$watch on mapprSettings : only updating layout settings for showNodeDetailOnLoad property, ignoring rest of the function');
                updateLayout($scope.mapprSettings);
            }
            console.groupEnd();
            return;
        }
        // update theme
        $scope.appUi.theme = _.get($scope.projSettings, 'theme', 'light');
        //update colors
        resetColors(newVal);
        //update background image
        setBackground(newVal);
        // update Zoom
        panZoomSettings(newVal);
        // Find out whether any layout effecting setting has changed or not. These trigger a regen of renderGraph
        var regenGraph = _.any(layoutService.dataGraphSettings, function(dgSetting) {
            var hasChanged = false;
            if(_.isArray(newVal[dgSetting])) {
                hasChanged = _.isArray(oldVal[dgSetting]) && oldVal[dgSetting].length === newVal[dgSetting].length;
                // check array elements as well
                hasChanged =  hasChanged && _.any(_.zip(newVal[dgSetting],oldVal[dgSetting]), function(elem) {
                    if(dgSetting === 'nodeColorPaletteOrdinal' ||
                        dgSetting === 'nodeColorPaletteNumeric' ||
                        dgSetting === 'edgeColorPaletteOrdinal' ||
                        dgSetting === 'edgeColorPaletteNumeric')
                        return elem[0].col !== elem[1].col;
                    else
                        return elem[0] !== elem[1];
                });
            } else if(_.isObject(newVal[dgSetting])) {
                hasChanged = !_.isEqual(newVal[dgSetting],oldVal[dgSetting]);
            } else {
                hasChanged = newVal[dgSetting] != oldVal[dgSetting];
            }
            return hasChanged;
        });

        // OldVal has to be defined, otherwise bug on 1st load.
        // If selection degree has changed, clean the selections
        // however, do this only if the layout is same
        if(_.isNumber(oldVal.nodeSelectionDegree) &&
            oldVal.nodeSelectionDegree !== newVal.nodeSelectionDegree &&
            newVal.layoutId === oldVal.layoutId) {
            graphSelectionService.clearSelections(false);
        }

        // if oldVal is empty, that means this is an initial load and sigma is already rendering with
        // these settings
        // If layout ids differ, that means a new layout has been switched to, so don't reload
        if(!_.isEmpty(oldVal) && (newVal.layoutId === oldVal.layoutId)) {
            updateLayout($scope.mapprSettings);
            console.log('mapprSettings changes graph render. %s, %s',!_.isEmpty(oldVal), newVal.layoutId === oldVal.layoutId);
            // if the mapprSettings changed require a rebuild of the graph.
            if(regenGraph) {
                console.log('regenerating Graph');
                $q.all([dataGraph.getRawData(), layoutService.getCurrent()]).then(function(args) {
                    args[1].setup();
                    var rg = dataGraph.getRenderableGraph();
                    rg.refreshForZoomLevel(0);
                    $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.changed, rg);
                    //var onGraphP = buildRenderGraph(args[0], args[1]);
                    // onGraphP.then(function(graph) {
                    //     $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.changed, graph);
                    // });
                });
            } else {
                console.log('Simple mappr reload. regen:' + regenGraph);
                // Ensure current renderGraph is updated with zoom levels
                //var rg = dataGraph.getRenderableGraph();
                //var layout = layoutService.getCurrentIfExists();
                //rg.setOptions(layout.mapprSettings);
            }
            $scope.$broadcast(BROADCAST_MESSAGES.layout.mapprSettingsUpdated, {
                regenGraph: regenGraph,
                mapprSettings : $scope.mapprSettings
            });
        } else {
            console.warn('Mappr ignoring mapprSettingChange event.');
        }
        console.groupEnd();
    }

    function onPlayerLoad() {
        if($scope.player.settings.colorTheme == 'dark') {
            $scope.projSettings.backgroundColor = '#000000';
            $scope.projSettings.labelColor = '#ffffff';
            $scope.projSettings.labelOutlineColor = '#000000';
            $scope.projSettings.nodeUnselectedOpacity = 0.3;
            $scope.projSettings.edgeUnselectedOpacity = 0.25;
            $scope.appUi.theme = 'dark';
        }
        else {
            $scope.projSettings.backgroundColor = '#ffffff';
            $scope.projSettings.labelColor = '#000000';
            $scope.projSettings.labelOutlineColor = '#ffffff';
            $scope.projSettings.nodeUnselectedOpacity = 0.25;
            $scope.projSettings.edgeUnselectedOpacity = 0.2;
            $scope.appUi.theme = 'light';
        }
    }

    function toggleNodeDetail() {
        var settings = $scope.mapprSettings;
        if(settings.nodePopShow && settings.nodeFocusShow) {
            settings.nodePopShow = false;
            settings.nodeFocusShow = false;
            $scope.nodeDetailActive = false;
        }
        else if(!(settings.nodePopShow && settings.nodeFocusShow)) {
            settings.nodePopShow = true;
            settings.nodeFocusShow = true;
            $scope.nodeDetailActive = true;
        }
    }

    function changeProjectTheme(theme) {
        projFactory.changeProjectTheme(theme)
        .then(function(newSettings) {
            // Settings updated
            _.assign($scope.projSettings, newSettings);

            // Update mapprSettings too
            _.assign($scope.mapprSettings, _.pick($scope.projSettings, [
                'theme', 'backgroundColor', 'labelColor', 'labelOutlineColor', 'nodeUnselectedOpacity', 'nodeUnselectedOpacity'
            ]));

            resetColors($scope.projSettings);
            // update theme
            $scope.appUi.theme = $scope.projSettings.theme || 'light';
            return playerFactory.currPlayer();
        }, function() {
            // Error while updating settings. Revert settings
            _.assign($scope.projSettings, projFactory.getProjectSettings());
        }).then(function(currPlayer) {
            // Lazily Update player theme.
            var proj = projFactory.currProjectUnsafe();
            currPlayer.settings.colorTheme = theme;
            playerFactory.updatePlayer(proj.org.ref, proj._id, currPlayer);
        });
    }

    // Generates a layout which can be applied to a dataset
    // Returns a promise of finalized layout
    function createLayout (snap, plotType, layoutOpts) {
        var layout = null;

        if(!snap) {
            //if moving from list to non-list (change compare list to selection)
            if($scope.layout && ($scope.layout.plotType == 'list' || $scope.layout.plotType == 'grid') && plotType !== 'list' && plotType !== 'grid') {
                var compareIds = _.clone($scope.layout.listCompareIds);
                graphSelectionService.selectByIds(compareIds, 0);
            }
            // gen a default layout for plotType
            var prevLayoutSettings = $scope.layout ? $scope.layout.mapprSettings : {};
            var camera = layoutOpts && layoutOpts.camera && layoutOpts.camera.x ? layoutOpts.camera : null;
            layout = layoutService.createDefault(plotType, prevLayoutSettings, camera);

            //if moving from non list to list, change selection to compare list
            if($scope.layout && $scope.layout.plotType != 'list' && $scope.layout.plotType != 'grid' && (plotType == 'list' || plotType == 'grid')) {
                var selectedIds = graphSelectionService.selectedNodeIds();
                layout.listCompareIds = selectedIds;
            } else if($scope.layout && ($scope.layout.plotType == 'list' || $scope.layout.plotType == 'grid') && (plotType == 'list' || plotType == 'grid')) {
                layout.listCompareIds = $scope.layout.listCompareIds;
            }

            // layout.setting("disableAggregation", graphData.nodes.length < 10000);

            if(['scatterplot', 'clustered-scatterplot'].includes(plotType) || plotType === 'geo') {
                layout.setting('drawGroupLabels', false);
                layout.setting("drawEdges", false);
            }
            else {
                layout.setting('drawGroupLabels', $scope.mapprSettings.drawGroupLabels != null ? $scope.mapprSettings.drawGroupLabels : true);
                layout.setting("drawEdges", $scope.mapprSettings.drawEdges != null ? $scope.mapprSettings.drawEdges : true);
            }
            if((['scatterplot', 'clustered-scatterplot'].includes(plotType) || plotType.indexOf('athena') === 0) && layoutOpts) {
                layout.setAttrX(layoutOpts.xAttr);
                layout.setAttrY(layoutOpts.yAttr);
            }
            if(['scatterplot', 'clustered-scatterplot'].includes(plotType) && layoutOpts) {
                layout.setScalerInfoX(layoutOpts.xScaleType, layoutOpts.xScaleBase , layoutOpts.xScaleExponent);
                layout.setScalerInfoY(layoutOpts.yScaleType, layoutOpts.yScaleBase , layoutOpts.yScaleExponent);
            }
            if(plotType === 'grid' && layoutOpts) {
                layout.gridAttr = layoutOpts.gridAttr;
                layout.gridSortAttr = layoutOpts.gridSortAttr;
            }
            if(plotType == 'geo' && layoutOpts) {
                layout.setAttrX(layoutOpts.xAttr);
                layout.setAttrY(layoutOpts.yAttr);
            }
            return finalizeLayout(layout);
        } else {
            // build layout for snapshot
            layout = layoutService.buildLayoutForSnapshot(snap);
            layout.shouldNormalizeCamera = !!snap.camera.normalizeCoords; // camera needs to be multiplied by rendergraph.baseRatio
            return finalizeLayout(layout);
        }
    }
    // finalize
    function finalizeLayout (layout) {
        if(layout.isGeo) {
            layout.mapprSettings.isGeo = true;
            return leafletData.getMap().then(function(map) {
                if(!layout.snapshotId) {
                     // Fit the map to the layout bounds
                    var graphData = dataGraph.getRawDataUnsafe();
                    var zoomLevel = map.getBoundsZoom(graphData.bounds);
                    console.log('[ctrlLayout:finalizeLayout] Map fitBounds on level:' + zoomLevel);
                    layout.mapprSettings.savedZoomLevel = zoomLevel;
                    layout.mapprSettings.disableAggregationLevel = zoomLevel + 2;
                }
                layout.setMap(map);
                setupLayout(layout);
                return layout;
            });

        } else {
            layout.mapprSettings.isGeo = false;
            setupLayout(layout);
            return $q.when(layout);
        }
    }
    /**
     * Switches between different layouts types (geo / scatter / original)
     * Always creates a new layout.
     * Mostly used in LayoutPanelCtrl
     * @param  {[type]} layoutType [description]
     * @return {[type]}            [description]
     */
    function switchGraph(layoutType, opts) {
        console.log('layoutCtrl:switchGraph] called with layoutType: ', layoutType);
        $scope.updatePlotType(layoutType);


        layoutService.invalidateCurrent();
        var layoutP = null;
        if(layoutType === 'geo') {
            layoutP = dataGraph.getRawData().then(function(graphData) {
                graphData.updateBounds(opts.xAttr, opts.yAttr);
                var center = graphData.bounds.getCenter();
                opts.camera = {};
                opts.camera.x = center.lat;
                opts.camera.y = center.lng;
                return createLayout(null, layoutType, opts);
            });
        } else {
            layoutP = createLayout(null, layoutType, opts);
        }
        layoutP.then(function(layout) {
            $scope.$broadcast(BROADCAST_MESSAGES.layout.changed, layout);
        });
    }


    function onGeoLayoutLoaded(graphData, layout) {
        var removeListener = $scope.$on('leafletDirectiveMap.viewreset', function () {
            removeListener();
            buildRenderGraph(graphData, layout).then(function (graph) {
                $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.loaded, graph);
            });
        });
    }

    function onCommonLayoutLoaded(graphData, layout) {
        buildRenderGraph(graphData, layout).then(function (graph) {
            $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.loaded, graph);
            zoomService.zoomReset();
        });        
    }

    function onLayoutLoaded(event, layout, isNew) {
        console.group('[layoutCtrl.$on event %s]', event.name);
        if (isNew) {
            dataGraph.clearRenderGraph();
        }
        var graphData = dataGraph.getRawDataUnsafe();

        if (layout.isGeo) {
            onGeoLayoutLoaded(graphData, layout);
        } else {
            onCommonLayoutLoaded(graphData, layout);
        }

        console.groupEnd();
    }

    /**
     * Builds the renderable Graph from layout and graphData. Ensure that the layout
     * has been finalized before calling this.
     * @return {Promise} promise containing the rendergraph built
     */
    function buildRenderGraph (graphData, layout) {
        return $q(function(resolve, reject){
            console.log('buildRenderGraph called');
            var currRG =  dataGraph.getRenderableGraph();
            var zoomLevel = currRG != null ? currRG.zoomLevel : layout.setting('savedZoomLevel');
            if(graphData && !graphData.isEmpty()) {
                var g = dataGraph.buildRenderableGraph(graphData, layout, zoomLevel);
                AttrInfoService.loadInfosForRG(g, layout);
                resolve(g);
            } else {
                console.warn('buildRenderGraph called with crappy graphData. Investigate this');
                reject(new Error('buildRenderGraph called with crappy graphData. Investigate this'));
            }
        });
    }
    /**
     * Initializes, sets the layout as current and adds to the scope.
     * Also copies the layouts mapprSettings to the scope.
     * @param  {[type]} layout [description]
     * @return {[type]}        [description]
     */
    function setupLayout (layout) {
        layout.setup();
        layoutService.setCurrent(layout);
        $scope.layout = layout;
        _.extend($scope.mapprSettings, layout.mapprSettings);
    }
    /**
     * Updates the current layout's mapprSettings with the argument
     * @param  {[type]} mapprSettings [description]
     * @return {[type]}               [description]
     */
    function updateLayout(mapprSettings) {
        var layout = layoutService.getCurrentIfExists();
        _.each(mapprSettings, function(value, key) {
            layout.setting(key, value);
        });
    }

    function refreshLayout (layout) {
        console.log("layoutCtrl: refreshLayout CALLED");
        layout.resetCamera();
        setupLayout(layout);
        buildRenderGraph(dataGraph.getRawDataUnsafe(), layout)
        .then(function(graph) {
            zoomService.zoomReset();
            $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.loaded, graph);
        });
    }

    function panZoomSettings (mapprSettings) {
        if($scope.layout.isGeo) {
            leafletData.getMap().then(function(map) {
                // pan
                if(!mapprSettings.panLock)  {
                    console.log('enable Pan');
                    map.dragging.enable();
                } else {
                    console.log('disable Pan');
                    map.dragging.disable();
                }
                //zoom
                if(!mapprSettings.zoomLock) {
                    console.log('enable Zoom');
                    map.touchZoom.enable();
                    map.doubleClickZoom.enable();
                    map.scrollWheelZoom.enable();
                    map.boxZoom.enable();
                    zoomService.enableZoom();
                } else {
                    console.log('disable Zoom');
                    map.touchZoom.disable();
                    map.doubleClickZoom.disable();
                    map.scrollWheelZoom.disable();
                    map.boxZoom.disable();
                    zoomService.disableZoom();
                }
            });
        }
        // sigma
        if(!mapprSettings.zoomLock) {
            zoomService.enableZoom();
        } else {
            console.log('disable Zoom');
            zoomService.disableZoom();
        }
    }

    function setBackground(settings) {
        console.debug('setBackground: ', settings);
        //add background image and color to player
        if(settings.backgroundImage != '') {
            var cssGraphContainer = getCSSRule('#content');
            cssGraphContainer.style.backgroundImage = 'url('+settings.backgroundImage+')';
            cssGraphContainer.style.backgroundSize = settings.backgroundSize;
            cssGraphContainer.style.backgroundPosition = settings.backgroundPosition;
        }
    }

    function resetColors(settings){
        // color updates
        var cssNodeLabel = getCSSRule('.page-stage .node-label');
        if(cssNodeLabel) {
            cssNodeLabel.style.color = settings.labelColor;
            cssNodeLabel.style.textShadow = settings.labelOutlineColor + " -1px -1px 0px, " + settings.labelOutlineColor + " 1px -1px 0px, " + settings.labelOutlineColor + " -1px 1px 0px, " + settings.labelOutlineColor + " 1px 1px 0px";
        }

        var cssNodeLabelHover = getCSSRule('.page-stage .node-label-hover');
        if(cssNodeLabelHover) {
            cssNodeLabelHover.style.color = settings.labelColor;
            cssNodeLabelHover.style.textShadow = settings.labelOutlineColor + " -1px -1px 0px, " + settings.labelOutlineColor + " 1px -1px 0px, " + settings.labelOutlineColor + " -1px 1px 0px, " + settings.labelOutlineColor + " 1px 1px 0px";
        }

        var cssNodeLabelHoverHide = getCSSRule('.page-stage .node-label-hover-hide');
        if(cssNodeLabelHoverHide) {
            cssNodeLabelHoverHide.style.color = settings.labelColor;
            cssNodeLabelHoverHide.style.textShadow = settings.labelOutlineColor + " -1px -1px 0px, " + settings.labelOutlineColor + " 1px -1px 0px, " + settings.labelOutlineColor + " -1px 1px 0px, " + settings.labelOutlineColor + " 1px 1px 0px";
            cssNodeLabelHoverHide.style.opacity = settings.labelUnselectedOpacity;
        }

        // var cssNodeLabelSel = getCSSRule('.page-stage .node-label-sel');
        // cssNodeLabelSel.style.color = settings.labelColor;
        // cssNodeLabelSel.style.textShadow = settings.labelOutlineColor + " -1px -1px 0px, " + settings.labelOutlineColor + " 1px -1px 0px, " + settings.labelOutlineColor + " -1px 1px 0px, " + settings.labelOutlineColor + " 1px 1px 0px";

        // var cssNodeLabelSelNeigh = getCSSRule('.page-stage .node-label-sel-neigh');
        // cssNodeLabelSelNeigh.style.color = settings.labelColor;
        // cssNodeLabelSelNeigh.style.textShadow = settings.labelOutlineColor + " -1px -1px 0px, " + settings.labelOutlineColor + " 1px -1px 0px, " + settings.labelOutlineColor + " -1px 1px 0px, " + settings.labelOutlineColor + " 1px 1px 0px";

        var cssGraphContainer = getCSSRule('.page-stage #project-layout');
        console.log('css graph container: ', cssGraphContainer);
        if(cssGraphContainer && cssGraphContainer.style) {
            cssGraphContainer.style.backgroundColor = _.get($scope.projSettings, 'backgroundColor', '#ffffff');
        }


    }

    function getCSSRule(rulename){
        var ruleSelected = null;

        if (document.styleSheets) {
            _.each(document.styleSheets, function(stylesheet) {
                try {
                    // on IE , chrome cross - origin CSS scripts don't have .cssRules properties
                    if (!stylesheet.cssRules)
                        return;
                } catch(e) {
                    // On firefox, .cssRules on CORS would throw a security error
                    if(e.name !== 'SecurityError')
                        throw e;
                    return;
                }
                // finally have a valid stylesheet
                if (stylesheet.cssRules) {
                    _.each(stylesheet.cssRules, function(rule) {
                        if (rule && rule.selectorText && rule.selectorText == rulename) {
                            console.log('[ctrlLayout] selecting css rule : ' + rule.selectorText);
                            //console.log(rule);
                            ruleSelected = rule;
                        }
                    });
                } else {
                    _.each(stylesheet.rules, function(rule) {
                        if (rule && rule.selectorText && rule.selectorText == rulename) {
                            console.log('[ctrLayout] selecting css rule : ' + rule.selectorText);
                            //console.log(rule);
                            ruleSelected = rule;
                        }
                    });
                }
            });
        }

        return ruleSelected;
    }

}
]);
