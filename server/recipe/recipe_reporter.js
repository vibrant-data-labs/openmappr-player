'use strict';
var _ = require('lodash');

/**
 * Report progress across the engine, mostly to send mesages to frontend
 * @param {[type]} engine [description]
 */
function Reporter (engine, scope, phase, itemId) {
    this.engine = engine;
    this.scope = scope;
    this.phase = phase;
    this.itemId = itemId;
}
Reporter.prototype.emitProg = function(progObj) {
    this.engine.emit('progress', _.assign({
        completion : 0,
        phase : this.phase,
        dsId: _.get(this, 'scope.dataSource.dsid')
    }, progObj));
};
Reporter.prototype.emitPhaseProg = function(progObj) {
    this.engine.emit('progress', _.assign({
        completion : 0,
        phase : this.phase + ':progress',
        dsId: _.get(this, 'scope.dataSource.dsid')
    }, progObj));
};
Reporter.prototype.emitPhaseItemProg = function(progObj) {
    this.engine.emit('progress', _.assign({
        completion : 0,
        phase : this.phase + ':progress',
        dsId: _.get(this, 'scope.dataSource.dsid'),
        itemId : this.itemId ? this.itemId : 'def_task'
    }, progObj));
};
Reporter.prototype.forItem = function(itemId) {
    return new Reporter(this.engine, this.scope, this.phase, itemId);
};
Reporter.prototype.forScope = function(scope) {
    return new Reporter(this.engine, scope, null);
};
Reporter.prototype.setPhase = function(phase) {
    this.phase = phase;
};

module.exports = Reporter;
