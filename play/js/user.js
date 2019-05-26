import ai from './ai';
import board from './board';
import clock from './clock';
import config from './config';
import events from './events';
import game from './game';
import Hero from './hero';
import heroes from './heroes';
import p5 from 'p5';
import player from './player';
import sketch from './sketch';
import Tile from './tile';
import tiles from './tiles';

const allTiles = require('../data/tiles.json');
const scenarios = require('../data/scenarios.json');

export default {
    start(options) {
        new p5(sketch);
        game.init(options);
        const deck = this.buildDeck(options.scenario);
        tiles.init(deck);
        board.init();
        events.init();
        heroes.init();
        clock.init();
        if (options.roles) player.setRoles(options.roles);
        if (game.isAdmin()) ai.run();
    },

    buildDeck(scenario) {
        if (scenario > 7) scenario = 7;
        let deck = { tiles: [], firstInStock: null };
        const ids = scenarios[scenario].tiles;

        deck.firstInStock = scenarios[scenario].firstInStock;

        for (let id of ids) {
            deck.tiles[id] = allTiles[id];
        }

        return deck;
    }
}