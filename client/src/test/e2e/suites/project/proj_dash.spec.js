'use strict';
var params = browser.params;
var projDash = require('../../page_objects/proj_dash');

describe('project dashboard', function() {

    beforeAll(() => {
        browser.setLocation('/user-projects')
        .then(() => projDash.selectOrg(params.test_org));
    });

    describe('project ops', () => {

        it('should delete project', () => {
            var projCount = 0;
            projDash.getProjCount()
            .then(count => {
                projCount = count;
                return projDash.deleteProjByIdx(0);
            })
            .then(() => {
                browser.sleep(2000);
                expect(projDash.getProjCount()).toBe(projCount - 1);
            });
        });

        it('should rename project', () => {
            projDash.renameProjByIdx('Rename_Check', 0)
            .then(() => {
                browser.sleep(2000);
                expect(projDash.getProjNameByIdx(0)).toBe('Rename_Check');
            });
        });

        it('should clone project', () => {
            var projCount = 0;
            projDash.getProjCount()
            .then(count => {
                projCount = count;
                return projDash.cloneProject(0);
            })
            .then(() => {
                expect(projDash.getProjCount()).toBe(projCount + 1);
            });
        });

    });

});