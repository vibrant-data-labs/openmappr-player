angular.module('common')
.directive('dirVirtualScroll', ['$timeout', '$rootScope', '$window', 'projFactory', 'FilterPanelService', 'BROADCAST_MESSAGES',
function($timeout, $rootScope, $window, projFactory, FilterPanelService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict : 'A',
        scope: true,
        controller: ['$scope', ControllerFn],
        compile: compileFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[virtualScroll]: ';
    var log = false; // Set to true to check logs
    var collectionsCount = 0,
        def_viewport_count = 20;


    /*************************************
    ******** Controller Function *********
    **************************************/
    function ControllerFn($scope) {
        this.safeApply = function(func) {
            if($scope.$$phase || $rootScope.$$phase) {
                func();
            }
            else {
                $scope.$apply(func);
            }
        };
    }



    /*************************************
    ******** Compile Function ************
    **************************************/
    function compileFn($tElem, $tAttrs) {
        var repeatElemValues, match, collectionExpr, trackByExpr, lhs, aliasAs, repeatContainer;
        var PREFIX_REGEXP = /^(x[\:\-_]|data[\:\-_])/i;
        var modifiedRepeatExpr = '';

        // Vars common to prelink and postlink
        var scrollHandlerBusy = false,
            disableUpScroll = false,
            disableDownScroll = false,
            upContHeight = 0,
            downContHeight = 0,
            itemOuterHeight, firstRowElem, lastRowElem, containerHeight,
            topVisibleItemIdx, lastVisibleItemIdx, newStartIdx, newEndIdx, rawElem;

        // Find ng-repeat element
        repeatElemValues = findRepeatElement($tElem[0]);
        if(!repeatElemValues) {
            throw new Error('ng-repeat element not found on this element!');
        }

        // Build collection data
        var variableHeight = typeof $tAttrs.variableHeight !== 'undefined' ? true : false;
        var collection = new CollectionData(
            repeatElemValues[0],
            repeatElemValues[1],
            variableHeight,
            variableHeight ? +$tAttrs.containerItemCount || def_viewport_count : 20,
            $tAttrs.singleNode == 'true' ? true : false
        );

        // Extract expressions from ng-repeat expr
        //Regex taken from ngRepeat
        match = collection.repeatAttr.value.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
        lhs = match[1];
        collectionExpr = match[2];
        aliasAs = match[3];
        trackByExpr = match[4];
        collection.collectionName = collectionExpr.match(/^\s*([\s\S]+?)(?:\s+\|\s+([\s\S]+?))?$/)[1];
        log && console.log(logPrefix, collection.collectionName, collectionExpr);

        // Modify ng-repeat expr
        modifiedRepeatExpr = lhs + ' in ' + collectionExpr + ' | limitTo : virtualCollection.listLength : virtualCollection.start';
        if(aliasAs) {
            modifiedRepeatExpr += ' as ' + aliasAs;
        }
        if(trackByExpr) {
            modifiedRepeatExpr += ' track by ' + trackByExpr;
        }

        $timeout(function() {
            collection.repeatElem.setAttribute(collection.repeatAttr.name, modifiedRepeatExpr);
        });

        // returns ng-repeat element and its expr
        function findRepeatElement(node) {
            var descendents = node.getElementsByTagName('*'),
                nAttr;

            for(var i = 0, n = descendents.length; i < n; i++) {
                for(var ii = 0, elem = descendents[i], attributes = elem.attributes, nn = attributes.length; ii < nn; ii++) {
                    nAttr = attributes[ii].name.replace(PREFIX_REGEXP, '').toLowerCase();
                    if(/^(ng\Srepeat)$/.test(nAttr) || /^(ng\Srepeat\Sstart)$/.test(nAttr)) {
                        return [elem, attributes[ii]];
                    }
                }
            }
            return null;
        }

        function render(viewportCollection) {
            var nonDomElemsColl = collection.originalCollection.slice(0, collection.start)
                                    .concat(collection.originalCollection.slice(collection.end, collection.originalCollection.length));

            nonDomElemsColl.forEach(function(el) {
                el.inViewport = false;
            });

            viewportCollection.forEach(function(el) {
                el.inViewport = true;
                // el.spHeight = 'auto';
            });
        }

        return {
            pre : function paperDomPreLink($scope, $element, $attrs, $ctrl) {
                $scope.virtualCollection = collection;

                $scope.$watchCollection(collectionExpr, watchCollectionAction);

                function watchCollectionAction(watchColl, oldColl) {
                    if(_.isEmpty(watchColl)) {
                        console.warn(logPrefix + 'collection is empty.');
                        return;
                    }
                    log && console.log(logPrefix + 'collection changed');

                    if(!collection.localCollectionChange) {
                        collection.originalCollection = watchColl;

                        collection.upDummyContainer.style.height = '0px';
                        collection.downDummyContainer.style.height = '0px';

                        // reset end index when collection changes
                        if(watchColl.length > oldColl.length) {
                            collection.end = Math.min(Math.ceil(collection.initRenderFactor * collection.viewPortItemCount), watchColl.length - oldColl.length);
                        }

                        $ctrl.safeApply(function() {
                            collection.refresh(collection.start, collection.end);
                        });

                        $timeout(function() {
                            var initStartIdx = 0,
                                initEndIdx;
                            if(collection.viewportTopIdx !== null) {
                                initStartIdx = collection.viewportTopIdx;
                            }
                            initEndIdx = getLastVisibleElemIdx(collection.originalCollection, initStartIdx, $element[0].offsetHeight) + 1;
                            log && console.log(logPrefix + 'init viewport render range: ', initStartIdx, initEndIdx);
                            var viewportCollection = collection.originalCollection.slice(initStartIdx, initEndIdx+1);

                            render(viewportCollection);
                        });
                    }


                }

            },
            post : function paperDomPostLink($scope, $element, $attrs, $ctrl) {
                var firstElemTopOffset = 0;

                rawElem = $element[0];

                var debouncedViewportRenderer = _.debounce(renderInViewport, 100);
                var debUpdateFPScrollStatus = _.debounce(updateFPScrollStatus, 1000);
                var throttUpdateFPScrollStatus = _.throttle(updateFPScrollStatus, 50);

                $scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, renderInViewport);

                $scope.$on(BROADCAST_MESSAGES.fp.resized, function() {
                    $timeout(function() {
                        containerHeight = rawElem.offsetHeight;
                        if(!collection.variableItemsHeight) {
                            log && console.log(logPrefix + 'calculating viewport item count for fixed height collection');
                            collection.viewPortItemCount = Math.ceil(containerHeight/itemOuterHeight);
                        }
                        firstElemTopOffset = firstRowElem
                            ? firstRowElem.getBoundingClientRect().top
                            : 0;
                        log && console.log(logPrefix + 'recomputing things after container resize');
                        log && console.log(logPrefix + 'Item Height: ' + itemOuterHeight);
                        log && console.log(logPrefix + 'Container Height: ' + containerHeight);
                        log && console.log(logPrefix +'Viewport Count -- ', collection.viewPortItemCount);
                        log && console.log(logPrefix + 'Top Elem offset: ', firstElemTopOffset);
                    }, 300);
                });

                $scope.$on(BROADCAST_MESSAGES.fp.filter.visibilityToggled, function() {
                    renderInViewport();
                });

                $element.on( 'scroll', function(e) {
                    if (typeof $scope.onScroll === 'function') {
                        $scope.onScroll();
                    }
                    
                    throttUpdateFPScrollStatus(true);
                    scrollHandler(e);
                    debouncedViewportRenderer(e);
                    debUpdateFPScrollStatus(false);
                });

                function updateFPScrollStatus(status) {
                    FilterPanelService.updateFPScrollStatus(status);
                }

                // Check if more elements can be rendered after initial render
                $timeout(checkForViewportChanges, 300);

                $timeout(function() {
                    repeatContainer = document.getElementById('paperDomViewport' + collection.id);
                    repeatContainer.style.overflowY = "auto";
                    repeatContainer.style.display = 'block';
                    collection.upDummyContainer = document.getElementById('paperDomUpDummy' + collection.id);
                    collection.downDummyContainer = document.getElementById('paperDomDownDummy' + collection.id);
                    collection.repeatContainer = document.getElementById('paperDomViewport' + collection.id);

                    lastRowElem = collection.downDummyContainer.previousElementSibling;
                    firstRowElem =  collection.upDummyContainer.nextElementSibling;
                    containerHeight = rawElem.offsetHeight;
                    itemOuterHeight = Math.floor(rawElem.scrollHeight/(collection.initRenderFactor * collection.viewPortItemCount));
                    firstElemTopOffset = firstRowElem
                        ? firstRowElem.getBoundingClientRect().top
                        : 0;
                    if(!collection.variableItemsHeight) {
                        log && console.log(logPrefix + 'calculating viewport item count for fixed height collection');
                        collection.viewPortItemCount = Math.ceil(containerHeight/itemOuterHeight);
                    }

                    log && console.log(logPrefix + 'Item Height: ' + itemOuterHeight);
                    log && console.log(logPrefix + 'Container Height: ' + containerHeight);
                    log && console.log(logPrefix +'Viewport Count -- ', collection.viewPortItemCount);
                    log && console.log(logPrefix + 'Top Elem offset: ', firstElemTopOffset);
                });

                function renderInViewport() {
                    updateVisibleIdxs();
                    _renderInViewport(true);
                }

                function scrollHandler() {
                    if(scrollHandlerBusy) {
                        return;
                    }

                    scrollHandlerBusy = true;

                    lastRowElem = collection.downDummyContainer.previousElementSibling;
                    firstRowElem =  collection.upDummyContainer.nextElementSibling;

                    if(rawElem.scrollTop > collection.scrollPosition) {
                        log && console.log(logPrefix + 'scrolling down');
                        if(!disableDownScroll && (lastRowElem.getBoundingClientRect().bottom - firstElemTopOffset <= containerHeight*(0.5+collection.overflowFactor))) {
                            fetchDown();
                        }
                    }
                    else if(rawElem.scrollTop < collection.scrollPosition){
                        log && console.log(logPrefix + 'scrolling up');
                        if(!disableUpScroll && firstRowElem.getBoundingClientRect().top + containerHeight*(0.5*collection.overflowFactor) > itemOuterHeight) {
                            fetchUp();
                        }

                    }

                    collection.scrollPosition = rawElem.scrollTop;
                    scrollHandlerBusy = false;
                }

                function fetchDown() {
                    log && console.log(logPrefix + 'fetch down');
                    disableUpScroll = false;
                    setNewCollIndexes();

                    if(newEndIdx >= collection.originalCollection.length-1) {
                        disableDownScroll = true;
                    }

                    if(collection.variableItemsHeight) {
                        if(newStartIdx > 0) {
                            upContHeight = collection.upDummyContainer.offsetHeight + getDummyContainerHeight(firstRowElem, false, newStartIdx - collection.start);
                        }
                        if(newEndIdx === collection.originalCollection.length - 1) {
                            downContHeight = 0;
                        }
                        else {
                            downContHeight = collection.downDummyContainer.offsetHeight - getDummyContainerHeight(lastRowElem, true, newEndIdx - collection.end);
                            if(downContHeight < 0) {
                                downContHeight = 0;
                            }
                        }
                    }
                    else {
                        if(newStartIdx > 0) {
                            upContHeight = collection.upDummyContainer.offsetHeight + (newStartIdx - collection.start)*itemOuterHeight;
                        }
                        if(newEndIdx === collection.originalCollection.length - 1) {
                            downContHeight = 0;
                        }
                        else {
                            downContHeight = collection.downDummyContainer.offsetHeight - (newEndIdx - collection.end)*itemOuterHeight;
                            if(downContHeight < 0) {
                                downContHeight = 0;
                            }
                        }
                    }

                    $ctrl.safeApply(function() {
                        collection.refresh(newStartIdx, newEndIdx);
                    });

                    updateDomAsync(function() {
                        collection.upDummyContainer.style.height = upContHeight + 'px';
                        collection.downDummyContainer.style.height = downContHeight + 'px';
                        log && console.log(logPrefix + 'new up dummy container height: ' + upContHeight);
                        log && console.log(logPrefix + 'new down dummy container height: ' + downContHeight);
                    });
                }

                function fetchUp() {
                    log && console.log(logPrefix + 'fetch up');
                    disableDownScroll = false;
                    if(collection.end < 0) {
                        console.warn(logPrefix + 'no more items to render at top');
                        return;
                    }

                    setNewCollIndexes();

                    if(newStartIdx < 0) {
                        disableUpScroll = true;
                    }

                    if(collection.variableItemsHeight) {
                        if(newEndIdx < collection.originalCollection.length) {
                            downContHeight = collection.downDummyContainer.offsetHeight + getDummyContainerHeight(lastRowElem, true, collection.end - newEndIdx);
                        }
                        if(newStartIdx <= 0) {
                            upContHeight = 0;
                        }
                        else {
                            upContHeight = collection.upDummyContainer.offsetHeight - getDummyContainerHeight(firstRowElem, false, collection.start - newStartIdx);
                            if(upContHeight < 0) {
                                upContHeight = 0;
                            }
                        }
                    }
                    else {
                        if(newStartIdx > 0) {
                            upContHeight = collection.upDummyContainer.offsetHeight - (collection.start - newStartIdx)*itemOuterHeight;
                            if(upContHeight < 0) {
                                upContHeight = 0;
                            }
                        }
                        if(newStartIdx <= 0) {
                            upContHeight = 0;
                        }
                        else {
                            downContHeight = collection.downDummyContainer.offsetHeight + (collection.end - newEndIdx)*itemOuterHeight;
                        }
                    }

                    $ctrl.safeApply(function() {
                        collection.refresh(newStartIdx, newEndIdx);
                    });

                    updateDomAsync(function() {
                        collection.upDummyContainer.style.height = upContHeight + 'px';
                        collection.downDummyContainer.style.height = downContHeight + 'px';
                        log && console.log(logPrefix + 'new up dummy container height: ' + upContHeight);
                        log && console.log(logPrefix + 'new down dummy container height: ' + downContHeight);
                    });

                }

                function setNewCollIndexes() {
                    updateVisibleIdxs();
                    log && console.log(logPrefix + 'Top visible elem index: ' + topVisibleItemIdx);
                    log && console.log(logPrefix + 'Bottom visible elem index: ' + lastVisibleItemIdx);
                    newStartIdx = Math.ceil(topVisibleItemIdx - collection.overflowFactor * collection.viewPortItemCount);
                    newEndIdx = Math.ceil(lastVisibleItemIdx + collection.overflowFactor * collection.viewPortItemCount);

                    if(newStartIdx < 0) {
                        newStartIdx = 0;
                    }
                    if(newEndIdx > collection.originalCollection.length - 1) {
                        newEndIdx = collection.originalCollection.length - 1;
                    }
                }

                function checkForViewportChanges() {
                    console.log(logPrefix + 'Checking for changes if any height changed, then need to re-render');
                    updateVisibleIdxs();
                    if(topVisibleItemIdx != collection.viewportTopIdx
                        || lastVisibleItemIdx != collection.viewportBottomIdx) {
                        _renderInViewport(false);
                    }

                }

                function updateVisibleIdxs() {
                    lastRowElem = collection.downDummyContainer.previousElementSibling;
                    firstRowElem =  collection.upDummyContainer.nextElementSibling;
                    topVisibleItemIdx = getTopVisibleElemIdx(firstRowElem, collection.start, collection.repeatContainer, collection.originalCollection);
                    if(topVisibleItemIdx < 0) {
                        topVisibleItemIdx = 0;
                    }
                    lastVisibleItemIdx = getLastVisibleElemIdx(collection.originalCollection, topVisibleItemIdx + 1, $element[0].offsetHeight) + 1;
                    if(lastVisibleItemIdx > collection.originalCollection.length - 1) {
                        lastVisibleItemIdx = collection.originalCollection.length - 1;
                    }
                }

                function _renderInViewport(checkForFurtherChanges) {
                    var viewportCollection = collection.originalCollection.slice(topVisibleItemIdx, lastVisibleItemIdx + 1);
                    collection.viewportTopIdx = topVisibleItemIdx;
                    collection.viewportBottomIdx = lastVisibleItemIdx;

                    $ctrl.safeApply(function() {
                        render(viewportCollection);
                        if(checkForFurtherChanges !== false) $timeout(checkForViewportChanges, 300);
                    });

                    log && console.log(logPrefix + 'viewport top item index: ' + topVisibleItemIdx);
                    log && console.log(logPrefix + 'viewport bottom item index: ' + lastVisibleItemIdx);
                }

            }
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/
    function CollectionData(repeatElem, repeatAttr, variableHeight, viewPortItemCount) {
        this.localCollectionChange = false;
        this.upDummyContainer = document.createElement('div');
        this.downDummyContainer = document.createElement('div');
        this.listLength = 0; // Item count to render
        this.scrollPosition = 0;
        this.originalCollection = [];
        this.collectionName = '';
        this.repeatElem = repeatElem;
        this.repeatAttr = repeatAttr;
        this.repeatContainer = repeatElem.parentNode;
        this.repeatContainer.insertBefore(this.upDummyContainer, this.repeatElem);
        this.repeatContainer.insertBefore(this.downDummyContainer, this.repeatElem.nextElementSibling);
        this.extraElements = this.repeatContainer.children.length - 1; //Reduce by 1 for the repeat element
        this.variableItemsHeight = variableHeight != null ? variableHeight : false; // Are items of same height or not?
        this.overflowFactor = 1; // Multiplier for container height to render up and down of viewport
        this.viewPortItemCount = viewPortItemCount; // Items'count that are in viewport(approx.)
        this.initRenderFactor = this.overflowFactor; // Used to calculate count of initial items to render
        collectionsCount++;
        this.viewportTopIdx = null;
        this.viewportBottomIdx = null;
        this.start = 0; // Virtual collection start point
        this.end = Math.ceil(this.initRenderFactor * this.viewPortItemCount); // Virtual collection end point

        this.id = collectionsCount;
        this.upDummyContainer.setAttribute('id', 'paperDomUpDummy' + collectionsCount);
        this.downDummyContainer.setAttribute('id', 'paperDomDownDummy' + collectionsCount);
        this.repeatContainer.setAttribute('id', 'paperDomViewport' + collectionsCount);
    }

    CollectionData.prototype.refresh = function(start, end) {
        var _this = this;
        this.localCollectionChange = true;
        this.start = start;
        this.end = end;
        this.listLength = end - start + 1;

        log && console.log(logPrefix + 'new start and end indexes', start, end);

        setTimeout(function() {
            _this.localCollectionChange = false;
        }, 100);
    };

    function getItemOuterHeight(elem) {
        return Math.max(elem.offsetHeight, elem.clientHeight, elem.scrollHeight);
    }

    // Returns sum of height of sibling elements
    function getDummyContainerHeight(element, prev, count) {
        var height = 0,
            accessor = '',
            currElem = element,
            currElemHeight = 0;
        if(prev) {
            accessor  = 'previousElementSibling';
        }
        else {
            accessor = 'nextElementSibling';
        }
        for(var i = 0; i < count; i++) {
            currElem = currElem[accessor];
            if(currElem[accessor] == null) {
                console.warn('Reached beginning or end of list');
                break;
            }
            currElemHeight = getItemOuterHeight(currElem);
            if(currElemHeight < 0) {
                console.warn(logPrefix + 'Correct height not obtained for element');
            }
            height += currElemHeight;
        }
        return height;
    }

    function getTopVisibleElemIdx(topElem, startIdx, container, originalCollection) {
        var elem = topElem,
            ngElem, topIdx;
        do {
            if(elem.getBoundingClientRect().bottom - container.getBoundingClientRect().top > 0) {
                break;
            }
        } while(++startIdx && (elem = elem.nextElementSibling));

        ngElem = angular.element(elem);
        if(elem && ngElem) {
            topIdx = _.findIndex(originalCollection, 'id', ngElem.scope().attr.id);
            if(topIdx == null) throw new Error('Element doesn\'t have $index');
        }
        else {
            console.warn(logPrefix + 'Invalid element');
            return startIdx;
        }

        return topIdx;
    }

    function getLastVisibleElemIdx(collection, startIdx, containerHeight) {
        var visibleItemsHeight = 0;
        while(startIdx < collection.length) {
            visibleItemsHeight += collection[startIdx].visible ? collection[startIdx].spHeight : 0;
            if(visibleItemsHeight > containerHeight) {
                break;
            }
            startIdx++;
        }
        return startIdx;
    }

    function updateDomAsync(func) {
        window.requestAnimationFrame(func);
    }


    return dirDefn;
}
]);
