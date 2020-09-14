(function() {
    'use strict';

    angular.module('mappr')
        .factory('analytics', ['$mixpanel', 'projFactory', 'orgFactory', 'userFactory', 'networkService',
            function($mixpanel, projFactory, orgFactory, userFactory, networkService) {

                var api = {
                    setSuperProps: function() {
                        var org = getOrg();
                        $mixpanel.register({
                            org_id: org._id,
                            org_name: org.orgName
                        });
                    },
                    setUser: function() {
                        getUser();
                        $mixpanel.identify(user._id);
                        $mixpanel.people.set({
                            $email: user.email,
                            name: user.name
                        });
                    },
                    projLoadStart: function() {
                        $mixpanel.time_event('proj_load');
                    },
                    projLoadFinish: function() {
                        var project = getProject();
                        $mixpanel.track('proj_load', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },
                    projLoadFailed: function(projId) {
                        $mixpanel.track('proj_load_failure', {
                            proj_id: projId,
                            user_id: user._id
                        });
                    },
                    projRenderStart: function() {
                        $mixpanel.time_event('proj_render');
                    },
                    projRenderFinished: function() {
                        var project = getProject();
                        $mixpanel.track('proj_render', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },
                    projRenderFailed: function() {
                        var project = getProject();
                        $mixpanel.track('proj_render_failure', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },
                    netgenStart: function() {
                        $mixpanel.time_event('netgen');
                    },
                    netgenFinished: function(networkId) {
                        if (!networkId) throw new Error('Need Network Id');
                        var project = getProject();
                        $mixpanel.track('netgen', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            netw_id: networkId,
                            user_id: user._id
                        });
                    },
                    netgenFailed: function() {
                        var project = getProject();
                        $mixpanel.track('netgen_failure', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },
                    subnetStart: function() {
                        $mixpanel.time_event('subnet');
                    },
                    subnetFinished: function(networkId) {
                        if (!networkId) throw new Error('Need Network Id');
                        var project = getProject();
                        $mixpanel.track('subnet', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            netw_id: networkId,
                            user_id: user._id
                        });
                    },
                    subnetFailed: function() {
                        var project = getProject();
                        $mixpanel.track('subnet_failure', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    nodeAttrsUpdated: function() {
                        var project = getProject();
                        $mixpanel.track('node_attrs_updated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    selectionBakedIntoDS: function() {
                        var project = getProject();
                        $mixpanel.track('selection_baked_into_ds', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    dpCatNamesChanged: function() {
                        var project = getProject();
                        $mixpanel.track('dp_cat_names_changed', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    networkUpdated: function() {
                        var project = getProject();
                        var network = getNetwork();
                        $mixpanel.track('network_updated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            netw_id: network._id
                        });
                    },

                    networkDeleted: function(delNwId) {
                        if (!delNwId) throw new Error('Need deleted network id');
                        var project = getProject();
                        $mixpanel.track('network_deleted', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            netw_id: delNwId
                        });
                    },

                    dataMerged: function() {
                        var project = getProject();
                        var network = getNetwork();
                        $mixpanel.track('data_merged', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            netw_id: network._id
                        });
                    },

                    playerUpdated: function(updateOp) {
                        updateOp = updateOp || 'settings';
                        var project = getProject();
                        $mixpanel.track('player_updated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            update_op: updateOp
                        });
                    },

                    snapshotAdded: function(snap) {
                        var project = getProject();
                        $mixpanel.track('snapshot_added', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            snap_id: snap.id,
                            snap_name: snap.snapName
                        });
                    },

                    snapshotUpdated: function(snap) {
                        var project = getProject();
                        $mixpanel.track('snapshot_updated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            snap_id: snap.id,
                            snap_name: snap.snapName
                        });
                    },

                    snapshotDeleted: function(snap) {
                        var project = getProject();
                        $mixpanel.track('snapshot_deleted', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            snap_id: snap.id,
                            snap_name: snap.snapName
                        });
                    },

                    dgAdded: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_added', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgDPsAdded: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_dps_added', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgInverted: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_inverted', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgDPsRemoved: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_dps_removed', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgNameUpdated: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_name_updated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgDPsReplaced: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_dps_replaced', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    dgDeleted: function(groupName) {
                        if (!groupName) throw new Error('Need data group name');
                        var project = getProject();
                        $mixpanel.track('datagroup_deleted', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            group_name: groupName
                        });
                    },

                    filtersVisiblityToggled: function(visible) {
                        if (visible == null) throw new Error('Need filters visiblity');
                        var project = getProject();
                        var eventName = visible === true ? 'stats_filters_shown' : 'stats_filters_hidden';

                        $mixpanel.track(eventName, {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    statsAttrSearched: function(query) {
                        if (!query) throw new Error('Search query not passed');
                        var project = getProject();
                        $mixpanel.track('stats_attr_searched', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            attr_query: query
                        });
                    },

                    nodeSearched: function(query) {
                        if (!query) return;
                        var project = getProject();
                        $mixpanel.track('search_node', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            search_query: query
                        });
                    },

                    searchFailure: function() {
                        var project = getProject();
                        $mixpanel.track('search_failure', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id
                        });
                    },

                    searchAttrToggled: function(data) {
                        var attrTitle = _.get(data, 'attrTitle'),
                            attrSelected = _.get(data, 'selected');
                        if (!attrTitle || attrSelected == null) throw new Error('Data missing');
                        var project = getProject();
                        $mixpanel.track('search_attr_filtered', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            attr_title: attrTitle,
                            attr_selected: attrSelected
                        });
                    },

                    layoutCreated: function(data) {
                        var layoutName = _.get(data, 'layoutName'),
                            layoutType = _.get(data, 'layoutType');
                        if (!layoutName || !layoutType) throw new Error('Data missing');
                        var project = getProject();
                        $mixpanel.track('layoutpanel_layoutcreated', {
                            proj_id: project._id,
                            proj_name: project.projName,
                            user_id: user._id,
                            layout_name: layoutName,
                            layout_type: layoutType
                        });
                    }

                };

                // Local Data
                var TRACK_LOCAL = true;
                var user; //Global for this service

                function getProject() {
                    var project = projFactory.currProjectUnsafe();
                    if (!project) throw new Error('Current project not set');
                    return project;
                }

                function getNetwork() {
                    var network = networkService.getCurrentNetwork();
                    if (!network) throw new Error('Current network not set');
                    return network;
                }

                function getOrg() {
                    var org = orgFactory.currOrgUnsafe();
                    if (!org) throw new Error('Current org not set');
                    return org;
                }

                function getUser() {
                    user = userFactory.currUserUnsafe();
                    if (!user) throw new Error('Current user not set');
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
