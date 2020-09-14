'use strict';
/**
 * Player Generator Mixin
 *
 */

var playerModel = require("../player/player_model.js");


var PHASE_NAME = 'player_gen';
// mixed into RecipeEngine. 'this' refers to that object
function PlayerGeneratorMixin () {
    this.gen_player = function(scope, reporter) {
        var cfg     = this.recipe.player_gen,
            self    = this,
            user = this.user,
            project = scope.project;

        reporter.setPhase(PHASE_NAME);
        self.emit('info', `[gen_player] attempting to create player for project ${project.projName}`);
        // PLayer options for generation
        var playerOpts =  {
            descr : "recipe generated player" || cfg.descr
        };
        return playerModel.buildPlayerAsync(playerOpts, user._id, project)
            .then(function (newPlayer) {
                self.emit( `[gen_player] Creating player: ${newPlayer.playerUrl}, creation details - project: ${newPlayer.project.ref}`);
                var player = update_player(newPlayer, cfg);
                return playerModel.addAsync(player);
            })
            .tap(() => self.emit('[gen_player] Success.'))
            .catch(function (err) {
                self.emit('[gen_player] Error in Creating player: ', err);
                return null;
            });
    };
}
// copy over the config set in recipe
function update_player(player, cfg) {
    if(cfg.isDisabled   != null) player.isDisabled    = cfg.isDisabled;
    if(cfg.isPrivate    != null) player.isPrivate     = cfg.isPrivate;
    if(cfg.directAccess != null) player.directAccess  = cfg.directAccess;
    if(cfg.access_token) player.access_token          = cfg.access_token;
    return player;
}
module.exports = PlayerGeneratorMixin;