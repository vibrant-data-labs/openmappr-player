(function() {
    'use strict';

    angular.module('mappr')
    .directive('imgHolder', [
        function() {
            return {
                restrict: 'A',
                link: function(scope, ele) {
                    return window.Holder.run({
                        images: ele[0]
                    });
                }
            };
        }
    ])
    .directive('customBackground', function() {
        return {
            restrict: "A",
            controller: [
                '$scope', '$element', '$location', function($scope, $element, $location) {
                    var addBg, path;
                    path = function() {
                        return $location.path();
                    };
                    addBg = function(path) {

                        $element.removeClass('body-home body-full-page body-bg-img body-tasks');
                        var keys = path.split('/');

                        var checkKeys = function(keys, exp){
                            for(var i = 0, l = checkKeys.length; i < l; i++){
                                if(_.contains(keys[i], exp)) return true;
                            }
                            return false;
                        };


                        if(checkKeys(keys, 'user')){
                            // console.log('[dirUI] path contains user');
                            return;
                        } else if(_.contains(keys, 'projects') || _.contains(keys, 'recipes')){
                            // console.log('[dirUI] path contains projects');
                            return;
                        } else if(_.contains(keys, 'play')){
                            // console.log('[dirUI] path contains play');
                            return $element.addClass('body-full-page');
                        } else if(_.contains(keys, 'lock-screen')){
                            return $element.addClass('body-full-page body-bg-img');
                        } else {
                            return $element.addClass('body-full-page body-home');
                        }
                    };

                    addBg($location.path());

                    return $scope.$watch(path, function(newVal, oldVal) {
                        if (newVal === oldVal) {
                            return;
                        }
                        return addBg($location.path());
                    });
                }
            ]
        };
    })
    .directive('uiColorSwitch', [
        function() {
            return {
                restrict: 'A',
                link: function(scope, ele) {
                    return ele.find('.color-option').on('click', function(event) {
                        var $this, hrefUrl, style;
                        $this = $(this);
                        hrefUrl = void 0;
                        style = $this.data('style');
                        if (style === 'loulou') {
                            hrefUrl = 'styles/main.css';
                            $('link[href^="styles/main"]').attr('href', hrefUrl);
                        } else if (style) {
                            style = '-' + style;
                            hrefUrl = 'styles/main' + style + '.css';
                            $('link[href^="styles/main"]').attr('href', hrefUrl);
                        } else {
                            return false;
                        }
                        return event.preventDefault();
                    });
                }
            };
        }
    ])
    .directive('toggleMinNav', ['$rootScope', 'BROADCAST_MESSAGES',
        function($rootScope, BROADCAST_MESSAGES) {
            return {
                restrict: 'A',
                link: function(scope, ele, attrs) {
                    var $window, Timer, app, updateClass;
                    app = $('#app');
                    $window = $(window);
                    ele.on('click', function(e) {
                        if (app.hasClass('nav-min')) {
                            app.removeClass('nav-min');
                        } else {
                            app.addClass('nav-min');
                            $rootScope.$broadcast(BROADCAST_MESSAGES.minNav.enabled);
                        }
                        return e.preventDefault();
                    });
                    Timer = void 0;
                    updateClass = function() {
                        //remove because don't want to shown nav when
                        //screen is small
                        // var width;
                        // width = $window.width();
                        // if (width < 768) {
                        //     return app.removeClass('nav-min');
                        // }
                    };
                    return $window.resize(function() {
                        var t;
                        clearTimeout(t);
                        return t = setTimeout(updateClass, 300);
                    });
                }
            };
        }
    ])
    .directive('closeMinNav', ['$rootScope', 'BROADCAST_MESSAGES',
        function($rootScope, BROADCAST_MESSAGES) {
            return {
                restrict: 'A',
                link: function(scope, ele, attrs) {
                    var $window, Timer, app, updateClass;
                    app = $('#app');
                    $window = $(window);
                    ele.on('click', function(e) {
                        if (app.hasClass('nav-min')) {
                            //app.removeClass('nav-min');
                        } else {
                            app.addClass('nav-min');
                            $rootScope.$broadcast(BROADCAST_MESSAGES.minNav.enabled);
                        }
                        return e.preventDefault();
                    });
                    Timer = void 0;
                    updateClass = function() {
                        var width;
                        width = $window.width();
                        // if (width < 768) {
                        //     return app.removeClass('nav-min');
                        // }
                    };
                    return $window.resize(function() {
                        var t;
                        clearTimeout(t);
                        return t = setTimeout(updateClass, 300);
                    });
                }
            };
        }
    ])
    .directive('openMinNav', [
        function() {
            return {
                restrict: 'A',
                link: function(scope, ele) {
                    var $window, Timer, app, updateClass;
                    app = $('#app');
                    $window = $(window);
                    ele.on('click', function(e) {
                        if (app.hasClass('nav-min')) {
                            app.removeClass('nav-min');
                        } else {
                            //app.addClass('nav-min');
                            //$rootScope.$broadcast('minNav:enabled');
                        }
                        return e.preventDefault();
                    });
                    Timer = void 0;
                    updateClass = function() {
                        var width;
                        width = $window.width();
                        if (width < 768) {
                            return app.removeClass('nav-min');
                        }
                    };
                    return $window.resize(function() {
                        var t;
                        clearTimeout(t);
                        return t = setTimeout(updateClass, 300);
                    });
                }
            };
        }
    ])
    .directive('collapseNav', ['BROADCAST_MESSAGES',
        function(BROADCAST_MESSAGES) {
            return {
                restrict: 'A',
                link: function(scope, ele) {
                    var $a, $aRest, $lists, $listsRest, app;
                    $lists = ele.find('ul').parent('li');
                    $lists.append('<i class="fa fa-caret-right icon-has-ul"></i>');
                    $a = $lists.children('a');
                    $listsRest = ele.children('li').not($lists);
                    $aRest = $listsRest.children('a');
                    app = $('#app');
                    $a.on('click', function(event) {
                        var $parent, $this;
                        if (app.hasClass('nav-min')) {
                            return false;
                        }
                        $this = $(this);
                        $parent = $this.parent('li');
                        $lists.not($parent).removeClass('open').find('ul').slideUp();
                        $parent.toggleClass('open').find('ul').slideToggle();
                        return event.preventDefault();
                    });
                    $aRest.on('click', function() {
                        return $lists.removeClass('open').find('ul').slideUp();
                    });
                    return scope.$on(BROADCAST_MESSAGES.minNav.enabled, function() {
                        return $lists.removeClass('open').find('ul').slideUp();
                    });
                }
            };
        }
    ])
    .directive('highlightActive', [function() {
        return {
            restrict: "A",
            controller: ['$scope', '$element', '$attrs', '$location',
                function($scope, $element, $attrs, $location) {
                    var highlightActive, links, path;
                    links = $element.find('a');
                    path = function() {
                        return $location.path();
                    };
                    highlightActive = function(links, path) {
                        path = '#' + path;
                        return angular.forEach(links, function(link) {
                            var $li, $link, href;
                            $link = angular.element(link);
                            $li = $link.parent('li');
                            href = $link.attr('href');
                            if ($li.hasClass('active')) {
                                $li.removeClass('active');
                            }
                            if (path.indexOf(href) === 0) {
                                return $li.addClass('active');
                            }
                        });
                    };
                    highlightActive(links, $location.path());
                    return $scope.$watch(path, function(newVal, oldVal) {
                        if (newVal === oldVal) {
                            return;
                        }
                        return highlightActive(links, $location.path());
                    });
                }
            ]
        };}
    ])
    .directive('toggleOffCanvas', [function() {
        return {
            restrict: 'A',
            link: function(scope, ele) {
                return ele.on('click', function() {
                    return $('#app').toggleClass('on-canvas');
                });
            }
        };
    }])
    .directive('slimScroll', [function() {
        return {
            restrict: 'A',
            link: function(scope, ele) {
                return ele.slimScroll({
                    height: '100%'
                });
            }
        };
    }])
    .directive('goBack', [
        function() {
            return {
                restrict: "A",
                controller: [
                    '$scope', '$element', '$window', function($scope, $element, $window) {
                        return $element.on('click', function() {
                            return $window.history.back();
                        });
                    }
                ]
            };
        }
    ])
    .directive('uiRangeSlider', [function() {
        return {
            restrict: 'A',
            link: function(scope, ele) {
                return ele.slider();
            }
        };
    }])
    .directive('uiWizardForm', [function() {
        return {
            link: function(scope, ele) {
                return ele.steps();
            }
        };
    }])
    .directive('onFinishRender', function ($timeout) {
        return {
            restrict: 'A',
            link: function(scope, element, attr) {
                if (scope.$last === true) {
                    $timeout(function() {
                        scope.$emit(attr.onFinishRender);
                    });
                }
            }
        };
    });

}());
