import config from './config';
import board from './board';
import pieces from './pieces';
import game from './game';
import ai from './ai';

export default class Hero {
    constructor(id) {
        this.id = id,
        this.color = config.heroes[id],
        this.cell = {
            x: 0,
            y: 0
        },
        this.status = 'set', // set, selected, moving, exited
        this.path = [];
    }

    /**
    * Move hero to cell
    * @param {Object} cell cell X and Y coordinates
    */
    move(force = false) {
        if (force) {
            this.pos = {x: this.target.x, y: this.target.y};
            ai.run();
        } else {
            let deltaX = this.target.x - this.pos.x;
            let deltaY = this.target.y - this.pos.y;
            let delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            let x = this.pos.x + deltaX / delta / config.heroSpeed;
            let y = this.pos.y + deltaY / delta / config.heroSpeed;
            this.pos = {x, y};
        }
    }

    /**
    * Set hero on cell
    * @param {Object} cell cell X and Y coordinates
    */
    set(cell) {
        this.cell = {
            x: cell.x,
            y: cell.y
        };

        const boardCell = board.get(cell.x, cell.y);
        const tileCell = boardCell.tileCell;
        const tileShift = tiles[boardCell.tileID].shift;

        if (config.debug) {
            this.target = {
                x: cell.x ,
                y: cell.y
            }
        } else {
            this.target = {
                x: cell.x + [.25, .1, -.1, -.25][tileCell.x] + tileShift.x / config.size,
                y: cell.y + [.25, .1, -.1, -.25][tileCell.y] + tileShift.y / config.size
            }
        }

        this.path = [];
    }

    /**
    * Get path from this hero to a cell
    * @param  {Object} target Target cell
    * @return {Object}        Path
    */
    getPath(target) {
        const piece = this.cell;
        const path = this.path = [];

        if (piece.x === target.x && piece.y === target.y) {
            // Same column and row = same cell
            path.push({x: piece.x, y: piece.y});
            return path;
        }

        // Check for vortex
        if (role.indexOf('vortex') > -1) {
            const item = board.get(piece.x, piece.y).item;
            if (item && item.type === 'vortex' && item.color === this.color) {
                const targetItem = board.get(target.x, target.y).item;
                if (targetItem && targetItem.type === 'vortex' && targetItem.color === this.color) {
                    path.push({x: piece.x, y: piece.y});
                    path.push({x: target.x, y: target.y, reachable: true});
                    return path;
                }
            }
        }

        if (piece.x !== target.x && piece.y !== target.y) {
            // Not the same column or row
            // Check for escalator
            if (role.indexOf('escalator') > -1) {
                const escalator = board.get(piece.x, piece.y).escalator;
                if (escalator && escalator.x === target.x && escalator.y === target.y) {
                    path.push({x: piece.x, y: piece.y});
                    path.push({x: target.x, y: target.y, reachable: true});
                    return path;
                }
            }

            return;
        }

        if (piece.x < target.x) {
            for (let i = piece.x; i <= target.x; i += 1) {
                path.push({x: i, y: piece.y})
            }
        } else if (piece.x > target.x) {
            for (let i = piece.x; i >= target.x; i -= 1) {
                path.push({x: i, y: piece.y})
            }
        }

        if (piece.y < target.y) {
            for (let i = piece.y; i <= target.y; i += 1) {
                path.push({x: piece.x, y: i})
            }
        } else if (piece.y > target.y) {
            for (let i = piece.y; i >= target.y; i -= 1) {
                path.push({x: piece.x, y: i})
            }
        }
        return path;
    }

    /**
    * Check path legality
    * @param  {Object} target Target cell
    * @param  {array}  role   Roles (for bots)
    */
    checkPath(target, role) {
        // No specified target, check for self position (current cell)
        if (!target) target = this.cell;

        // No specified role, use player role
        if (!role) role = window.role;

        const path = this.getPath(target);
        if (!path) return;

        for (let i in path) {
            i = parseInt(i);
            path[i].reachable = true;

            // Out of set tiles (empty cell)
            if (board.get(path[i].x, path[i].y).isEmpty()) {
                path[i].reachable = false;
                return;
            }

            // Already marked as reachable (vortex and escalator)
            if (path[i+1] && path[i+1].reachable) {

                // Make sure there is no other piece on target
                for (let piece of pieces.all) {
                    if (path[i+1].x === piece.cell.x && path[i+1].y === piece.cell.y) {
                        // Another piece blocking the way
                        path[i+1].reachable = false;
                        return;
                    }
                }

                path[i].reachable = true;
                return;
            }

            if (i > 0) {
                for (let piece of pieces.all) {
                    if (path[i].x === piece.cell.x && path[i].y === piece.cell.y) {
                        // Another piece blocking the way
                        path[i].reachable = false;
                        return;
                    }
                }

                if (!path[i-1].reachable) {
                    // Previous cell in path is unreachable, this one should be as well
                    path[i].reachable = false;
                    return;
                }

                // Check current cell and next cell walls depending on direction
                const x = path[i - 1].x;
                const y = path[i - 1].y;
                const cell = board.get(x, y);
                const next = board.get(path[i].x, path[i].y);
                if (path[i].x === x) {
                    if (path[i].y > y) {
                        // Going down
                        path[i].reachable = !cell.walls.bottom && !next.walls.top;
                        if (this.color === 'orange' && cell.walls.bottom === 'orange' && next.walls.top === 'orange') path[i].reachable = true;
                        if (role.indexOf('down') === -1) path[i].reachable = false;
                    } else {
                        // Going up
                        path[i].reachable = !cell.walls.top && !next.walls.bottom;
                        if (this.color === 'orange' && cell.walls.top === 'orange' && next.walls.bottom === 'orange') path[i].reachable = true;
                        if (role.indexOf('up') === -1) path[i].reachable = false;
                    }
                } else if (path[i].y === y) {
                    if (path[i].x > x) {
                        // Going right
                        path[i].reachable = !cell.walls.right && !next.walls.left;
                        if (this.color === 'orange' && cell.walls.right === 'orange' && next.walls.left === 'orange') path[i].reachable = true;
                        if (role.indexOf('right') === -1) path[i].reachable = false;
                    } else {
                        // Going left
                        path[i].reachable = !cell.walls.left && !next.walls.right;
                        if (this.color === 'orange' && cell.walls.left === 'orange' && next.walls.right === 'orange') path[i].reachable = true;
                        if (role.indexOf('left') === -1) path[i].reachable = false;
                    }
                }
            }
        }
    }

    /**
    * Check if hero can go to target cell
    * @param  {Object} target Target cell
    * @return {bool}
    */
    canGo(target) {
        const path = this.path;

        // No path, no go
        if (path.length === 0) {
            return false;
        }

        // Get first unreachable cell in this path
        for (let i in path) {
            if (!path[i].reachable) {
                return false;
            }
        }

        return true;
    }

    steal() {
        this.stolen = true;
    }

    hasStolen() {
        return this.stolen;
    }

    exit(cell) {
        this.status = 'exited';
        // this.set({x: 0, y: 0});
    }

    hasExited() {
        return this.status === 'exited';
    }
}
