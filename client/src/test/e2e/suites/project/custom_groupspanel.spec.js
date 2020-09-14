'use strict';
var groupsPanel = require('../../page_objects/custom_groups_panel'),
    layouts = require('../../page_objects/layouts'),
    helpers = require('../../helpers');

describe('custom_groups_panel', function() {

    beforeAll(() => {
        groupsPanel.openPanel();
    });

    it('should have no groups on proj_creation', () => {
        expect(groupsPanel.getGroupsCount()).toBe(0);
    });

    it('should create new group', () => {
        groupsPanel.createNewGroup()
        .then(() => {
            expect(groupsPanel.getGroupsCount()).toBe(1);
        });
    });

    describe('group ops', () => {

        it('should add nodes to the group', () => {
            layouts.selectClusterByLabel('Music')
            .then(() => {
                return groupsPanel.addSelectedNodesToGroupByIdx(0);
            })
            .then(() => {
                expect(groupsPanel.getGroupNodesCountByIdx(0)).toBe(12);
            });
        });

        it('should rename group', () => {
            groupsPanel.renameGroupByIdx('My_Group', 0)
            .then(() => {
                expect(groupsPanel.getGroupNameByIdx(0)).toBe('My_Group');
            });
        });

        it('should delete group', () => {
            groupsPanel.deleteGroupByIdx(0)
            .then(() => {
                expect(groupsPanel.getGroupsCount()).toBe(0);
            });
        });

    });

    afterAll(() => {
        helpers.clickStage();
    });

});