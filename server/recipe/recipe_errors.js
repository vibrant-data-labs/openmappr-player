'use strict';

// Some consts
var VALIDATION_FAILED = 'validation.failed';

function RecipeEngineError(phase, fnName, failureType, message) {
    this.message = message;
    this.phase = phase;
    this.fnName = fnName;
    this.failureType = failureType;
    this.name = "RecipeEngineError";
    Error.captureStackTrace(this, RecipeEngineError);
}
RecipeEngineError.prototype = Object.create(Error.prototype);
RecipeEngineError.prototype.constructor = RecipeEngineError;

// when an invalid data source is given
function DataSourceInvalidError(phase, fnName, srcUrl, message) {
    this.message = `Data source Url doesn't exist or is invalid. Given: ${srcUrl}` + (message ? `error: ${message}` : '');
    this.name = "DataSourceInvalidError";
    this.phase = phase;
    this.fnName = fnName;
    this.failureType = "DataSourceInvalidError";
    Error.captureStackTrace(this, DataSourceInvalidError);
}
DataSourceInvalidError.prototype = Object.create(RecipeEngineError.prototype);
DataSourceInvalidError.prototype.constructor = DataSourceInvalidError;

module.exports = {
    RecipeEngineError,
    DataSourceInvalidError,
    VALIDATION_FAILED
};