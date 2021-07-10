import ai from './ai';
import board from './board';
import config from './config';
import events from './events';
import game from './game';
import heroes from './heroes';
import player from './player';
import tiles from './tiles';
import ui from './ui';

export default class Hero {
    constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.color = config.heroes[id];
        this.cell = {
            x: 0,
            y: 0
        };
        this.target = this.cell;
        this.pos = {x: this.target.x, y: this.target.y};

        this.status = 'set'; // set, selected, exited
        this.selectable = true;
        this.path = [];
    }

    /**
    * Set hero on cell
    * @param {int} x cell X coordinate
    * @param {int} y cell Y coordinate
    */
    set(x, y) {
        this.cell = { x, y };
        this.path = [];
        this.selectable = false;

        // Move SVG element to bottom of parent (z-index hack)
        ui.moveToEnd(`hero-${this.id}`);
    }

    /**
    * Get path from this hero to a cell
    * @param  {Object} target Target cell
    * @return {Object}        Path
    */
    getPath(target) {
        const hero = this.cell;
        const path = this.path = [];

        const targetCell = board.get(target.x, target.y);
        if (targetCell.isEmpty()) return;

        if (hero.x === target.x && hero.y === target.y) {
            // Same column and row = same cell
            path.push({x: hero.x, y: hero.y});
            return path;
        }

        const role = config.debug ? ['up', 'right', 'down', 'left', 'explore', 'escalator', 'vortex'] : player.role;

        // Check for vortex
        if (role.includes('vortex')) {
            const targetItem = board.get(target.x, target.y).item;
            if (targetItem && targetItem.type === 'vortex' && targetItem.color === this.color) {
                path.push({x: hero.x, y: hero.y});
                path.push({x: target.x, y: target.y, reachable: game.isPhase(1)});
                return path;
            }
        }

        // Check for escalator
        if (role.includes('escalator')) {
            const escalator = board.get(hero.x, hero.y).escalator;
            if (escalator && escalator.x === target.x && escalator.y === target.y) {
                path.push({x: hero.x, y: hero.y});
                path.push({x: target.x, y: target.y, reachable: true});
                return path;
            }
        }

        const heroTile = { x: Math.floor(hero.x / 4), y: Math.floor(hero.y / 4) };
        const targetTile = { x: Math.floor(target.x / 4), y: Math.floor(target.y / 4) };

        const deltaX = heroTile.y - targetTile.y;
        const deltaY = targetTile.x - heroTile.x;

        const goingUp = hero.x === target.x + deltaX && hero.y > target.y;
        const goingDown = hero.x === target.x + deltaX && hero.y < target.y;
        const goingLeft = hero.y === target.y + deltaY && hero.x > target.x;
        const goingRight = hero.y === target.y + deltaY && hero.x < target.x;

        if (goingRight) {
            for (let i = hero.x; i <= target.x; i += 1) {
                const deltaY = Math.floor(hero.x / 4) - Math.floor(i / 4);
                path.push({ x: i, y: hero.y + deltaY });
            }
        } else if (goingLeft) {
            for (let i = hero.x; i >= target.x; i -= 1) {
                const deltaY = Math.floor(hero.x / 4) - Math.floor(i / 4);
                path.push({ x: i, y: hero.y + deltaY });
            }
        } else if (goingDown) {
            for (let i = hero.y; i <= target.y; i += 1) {
                const deltaX = Math.floor(i / 4) - Math.floor(hero.y / 4);
                path.push({ x: hero.x + deltaX, y: i });
            }
        } else if (goingUp) {
            for (let i = hero.y; i >= target.y; i -= 1) {
                const deltaX = Math.floor(i / 4) - Math.floor(hero.y / 4);
                path.push({ x: hero.x + deltaX, y: i });
            }
        }
        return path;
    }

    /**
    * Check path legality
    * @param  {Object} target Target cell
    */
    checkPath(target) {
        // No specified target, check for self position (current cell)
        if (!target) target = this.cell;

        // Use player role
        const role = config.debug ? ['up', 'right', 'down', 'left', 'explore', 'escalator', 'vortex'] : player.role;

        const path = this.getPath(target);
        if (!path) return;

        for (let i in path) {
            i = parseInt(i);
            if (path[i].reachable === undefined) path[i].reachable = true;

            // Out of set tiles (empty cell)
            if (board.get(path[i].x, path[i].y).isEmpty()) {
                path[i].reachable = false;
                return;
            }

            // Already marked as reachable (vortex and escalator)
            if (path[i + 1] && path[i + 1].reachable) {

                // Make sure there is no other hero on target
                for (let hero of heroes.all) {
                    if (path[i + 1].x === hero.cell.x && path[i + 1].y === hero.cell.y) {
                        // Another hero blocking the way
                        path[i + 1].reachable = false;
                        return;
                    }
                }

                path[i].reachable = true;
                return;
            }

            if (i > 0) {
                for (let hero of heroes.all) {
                    // Make sure there is no hero blocking the way (ignore exited heroes)
                    if (path[i].x === hero.cell.x && path[i].y === hero.cell.y && !hero.hasExited()) {
                        path[i].reachable = false;
                        return;
                    }
                }

                if (!path[i - 1].reachable) {
                    // Previous cell in path is unreachable, this one should be as well
                    path[i].reachable = false;
                    return;
                }

                // Check current cell and next cell walls depending on direction
                const x = path[i - 1].x;
                const y = path[i - 1].y;
                const cell = board.get(x, y);
                const next = board.get(path[i].x, path[i].y);

                const currentCellTile = { x: Math.floor(cell.coord.x / 4), y: Math.floor(cell.coord.y / 4) };
                const nextCellTile = { x: Math.floor(next.coord.x / 4), y: Math.floor(next.coord.y / 4) };

                const deltaX = currentCellTile.y - nextCellTile.y;
                const deltaY = nextCellTile.x - currentCellTile.x;

                const goingUp = cell.coord.x === next.coord.x + deltaX && cell.coord.y > next.coord.y;
                const goingDown = cell.coord.x === next.coord.x + deltaX && cell.coord.y < next.coord.y;
                const goingLeft = cell.coord.y === next.coord.y + deltaY && cell.coord.x > next.coord.x;
                const goingRight = cell.coord.y === next.coord.y + deltaY && cell.coord.x < next.coord.x;

                if (goingUp) {
                    path[i].reachable = !cell.walls.top && !next.walls.bottom;
                    if (this.color === 'orange' && cell.walls.top === 'orange' && next.walls.bottom === 'orange') path[i].reachable = true;
                    if (!role.includes('up')) path[i].reachable = false;
                } else if (goingDown) {
                    path[i].reachable = !cell.walls.bottom && !next.walls.top;
                    if (this.color === 'orange' && cell.walls.bottom === 'orange' && next.walls.top === 'orange') path[i].reachable = true;
                    if (!role.includes('down')) path[i].reachable = false;
                } else if (goingLeft) {
                    path[i].reachable = !cell.walls.left && !next.walls.right;
                    if (this.color === 'orange' && cell.walls.left === 'orange' && next.walls.right === 'orange') path[i].reachable = true;
                    if (!role.includes('left')) path[i].reachable = false;
                } else if (goingRight) {
                    path[i].reachable = !cell.walls.right && !next.walls.left;
                    if (this.color === 'orange' && cell.walls.right === 'orange' && next.walls.left === 'orange') path[i].reachable = true;
                    if (!role.includes('right')) path[i].reachable = false;
                }

                // Can't go to time cells when two or more cameras are active
                if (next.item && next.item.type === 'time') {
                    const cameras = board.findItem('camera').filter(c => {
                        return !c.isUsed()
                    });
                    if (cameras.length >= 2) path[i].reachable = false;
                }
            }
        }
    }

    display(force = false) {
        // Don't display hidden heroes
        if (this.display === false) return;

        let targetX = (this.cell.x - Math.floor(this.cell.y / 4) * .85 + [.5, .36, .18, 0][this.cell.x % 4]) * config.size + 8;
        let targetY = (this.cell.y + Math.floor(this.cell.x / 4) * .85 + [.5, .36, .18, 0][this.cell.y % 4]) * config.size + 8;

        if (this.hasExited()) {
            // Find exit cell (out of board)
            const boardCell = board.get(this.cell.x, this.cell.y);
            const tileCell = boardCell.tileCell;
            const tileID = boardCell.tileID;
            const tile = tiles.getTile(tileID);
            const exit = tile.getExitPlusOne(tileCell.x, tileCell.y);

            targetX += exit.x * config.size;
            targetY += exit.y * config.size;
        }

        if (force) {
            this.x = targetX;
            this.y = targetY;
        }

        let deltaX = targetX - this.x;
        let deltaY = targetY - this.y;
        let delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1 / 1000;

        if (delta < 10 && !this.selectable) {
            this.selectable = true;

            // Check for events on this cell
            events.checkForEvents(this.cell, this);

            // Run AI again
            ai.run();
        }

        const x = this.x + (deltaX < 0 ?
            Math.max(-config.heroSpeed * Math.abs(deltaX / delta) * (1 + delta / 20), deltaX) :
            Math.min(config.heroSpeed * Math.abs(deltaX / delta) * (1 + delta / 20), deltaX));

        const y = this.y + (deltaY < 0 ?
            Math.max(-config.heroSpeed * Math.abs(deltaY / delta) * (1 + delta / 20), deltaY) :
            Math.min(config.heroSpeed * Math.abs(deltaY / delta) * (1 + delta / 20), deltaY));

        this.x = x;
        this.y = y;

        ui.setAttribute(`hero-${this.id}`, 'transform', `translate(${x} ${y})`);

        if (this.status === 'selected') ui.setAttribute(`hero-${this.id}`, 'stroke-width', '2');
        else ui.setAttribute(`hero-${this.id}`, 'stroke-width', '1');
    }

    displayPath() {
        ui.getById('path').innerHTML = '';

        const path = this.path;

        let svg = '';

        for (let cell of path) {
            const boardCell = board.get(cell.x, cell.y);
            const tileCell = boardCell.tileCell;

            let x1 = 0;
            let y1 = 0;
            let l = 1;
            let h = 1;

            if (tileCell) {
                const walls = boardCell.walls;

                x1 += [.32, .16, 0, -.16][tileCell.x];
                y1 += [.32, .16, 0, -.16][tileCell.y];
                let x2 = 1 + [.16, 0, -.16, -.32][tileCell.x];
                let y2 = 1 + [.16, 0, -.16, -.32][tileCell.y];

                if (walls.left && tileCell.x === 3) {
                    x1 += .22;
                } else if (!walls.left && tileCell.x === 0) {
                    x1 -= .32;
                }

                if (walls.right && tileCell.x === 0) {
                    x2 -= .22;
                } else if (!walls.right && tileCell.x === 3){
                    x2 += .32;
                }

                if (walls.top && tileCell.y === 3) {
                    y1 += .16;
                } else if (!walls.top && tileCell.y === 0) {
                    y1 -= .32;
                }

                if (walls.bottom && tileCell.y === 0) {
                    y2 -= .22;
                } else if (!walls.bottom && tileCell.y === 3) {
                    y2 += .32;
                }

                l = x2 - x1;
                h = y2 - y1;
            }

            const x = (cell.x + x1 - Math.floor(cell.y / 4) * .85) * config.size;
            const y = (cell.y + y1 + Math.floor(cell.x / 4) * .85) * config.size;

            svg += `<rect class="path ${cell.reachable ? 'reachable' : ''}" x="${x}" y="${y}" width="${l * config.size}" height="${h * config.size}" fill="black" />`;
        }

        ui.addHTML('path', svg);
    }

    /**
    * Check if hero can go to target cell
    * @param  {Object}  target Target cell
    * @return {Boolean}
    */
    canGoTo(target) {
        const path = this.path;

        // No path, no go
        if (path.length === 0) return false;

        // Make sure last cell in path is the target (anti-spam security)
        const last = path[path.length - 1];
        if (last.x !== target.x || last.y !== target.y) return false;

        // Get first unreachable cell in this path
        for (let i in path) {
            if (!path[i].reachable) {
                return false;
            }
        }

        return true;
    }

    exit() {
        this.status = 'exited';
        this.selectable = false;

        ui.addClass(`hero-${this.id}`, 'exited');

        // Run AI again
        ai.run();
    }

    hasExited() {
        return this.status === 'exited';
    }
}
