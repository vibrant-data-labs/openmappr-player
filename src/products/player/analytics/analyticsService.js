(function() {
    'use strict';

    angular.module('player')
        .factory('analytics', ['$mixpanel', 'projFactory', 'playerFactory',
            function($mixpanel, projFactory, playerFactory) {

                var api = {
                    setSuperProps: function() {
                        var player = getPlayer();
                        $mixpanel.register({
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },
                    playerLoadStart: function() {
                        $mixpanel.time_event('player_load');
                    },
                    playerLoadFinish: function() {
                        var player = getPlayer();
                        $mixpanel.track('player_load', {
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },
                    playerLoadFailure: function() {
                        var player = getPlayer();
                        $mixpanel.track('player_load_failure', {
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },
                    playerRenderStart: function() {
                        $mixpanel.time_event('player_render');
                    },
                    playerRenderFinish: function() {
                        var player = getPlayer();
                        $mixpanel.track('player_render', {
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },
                    playerRenderFailure: function() {
                        var player = getPlayer();
                        $mixpanel.track('player_render_failure', {
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },

                    nodeSearched: function(query) {
                        if (!query) return;
                        var player = getPlayer();
                        $mixpanel.track('search_node', {
                            player_id: player._id,
                            player_url: player.playerUrl,
                            search_query: query
                        });
                    },
                    searchFailure: function() {
                        var player = getPlayer();
                        $mixpanel.track('search_failure', {
                            player_id: player._id,
                            player_url: player.playerUrl
                        });
                    },

                    searchAttrToggled: function(data) {
                        var attrTitle = _.get(data, 'attrTitle'),
                            attrSelected = _.get(data, 'selected');
                        if (!attrTitle || attrSelected == null) throw new Error('Data missing');
                        var player = getPlayer();
                        $mixpanel.track('search_attr_filtered', {
                            player_id: player._id,
                            player_url: player.playerUrl,
                            attr_title: attrTitle,
                            attr_selected: attrSelected
                        });
                    }

                };

                // Local Data
                var TRACK_LOCAL = true;

                function getPlayer() {
                    var player = playerFactory.getPlayerUnsafe();
                    if (!player) throw new Error('Player not set');
                    return player;
                }



                // Don't track for dev environments
                if (document.location.host.split('.')[0] !== 'mappr' && !TRACK_LOCAL) {
                    api = _.reduce(_.keys(api), function(acc, val) {
                        acc[val] = _.noop;
                        return acc;
                    }, {});
                }

                return api;
            }
        ]);

}());
