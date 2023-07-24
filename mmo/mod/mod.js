function clamp(min, val, max) {
    if (val < min) {
        val = min;
    }
    if (val > max) {
        val = max;
    }
    return val;
}

function randomizeBanner() {
    var banner = document.getElementById("banner");
    if (banner.value == "") {
        function rando(list) {
            return list[Math.floor(Math.random() * list.length)];
        }
        var spacer = rando([" ", "_", "-", ".", "+"]);
        var adjectives = ["Proud", "Angry", "Small", "Floral", "Wet", "Green", "Brown", "Black", "Strong", "Weak", "Limping", "Hungry"];
        var animals = ["Bear", "Wolf", "Rabbit", "Deer", "Squirrel", "Eagle", "Sparrow", "Mouse", "Hawk"];
        var junctions = ["Makes", "of", "Walks" + spacer + "in", "Eats" + spacer + "the", "Runs" + spacer + "in", "Flies" + spacer + "in", "Binge" + spacer + "Watches"];
        var elements = ["Wind", "Water", "Fire", "Dirt", "Clay", "Trees", "Costco"];
        var name = rando(adjectives) + spacer + rando(animals) + spacer + rando(junctions) + spacer + rando(elements) + spacer + Math.round(Math.random() * 10000);
        banner.value = name;
    }
}

function todo(thing) {
    throw "TODO: " + thing;
}


class ProtocolMessageReceivedEvent extends Event {
    constructor(command, args, initDict = undefined) {
        super("protocolmessagereceived", initDict);
        this.command = command;
        this.args = args;
    }
}


class Protocol extends EventTarget {
    constructor(socket, onmessage) {
        super();
        this.socket = socket;
        socket.onmessage = (message) => { this.message_recvd(message) };
        setInterval(() => {
            this.isOnline = this.pong; // if it's received a pong in 500ms, it's online; otherwise, it is not. Either way send a ping.
            this.ping();
            this.pong = false; // After sending, we can't have received a pong!
        }, 500);
        this.isOnline = false;
    }

    message_recvd(raw) {
        this.pong = true; // If it's receiving anything, it's online
        if (raw.data) {
            var data = raw.data;
            if (data == "_") { // If it's a pong message, do nothing, this is not meant for the game handler to see
                return;
            }
            var command = data[0];
            var args = [];
            var i = 1;
            var buffer = "";
            while (i < data.length) {
                var iEnd = i + data.charCodeAt(i);
                while (i < iEnd) {
                    i++;
                    buffer += data[i];
                }
                args.push(buffer);
                buffer = "";
                i++;
            }
            this.dispatchEvent(new ProtocolMessageReceivedEvent(command, args));
        }
    }

    send(command, args) {
        if (!Array.isArray(args)) {
            args = [args]; // Make sure args is a list
        }
        for (var i = 0; i < args.length; i++){
            args[i] = "" + args[i]; // Convert all the arguments to strings
        }
        var message = command;
        args.forEach(arg => {
            message += String.fromCharCode(arg.length);
            message += arg;
        });
        this.socket.send(message);
    }

    place(type, x, y) {
        this.send('p', [type, x, y]);
    }

    ping() {
        this.socket.send("_");
    }

    connect(banner, password, playMode, isSpectating) {
        this.send('c', [
            isSpectating ? "" : password,
            banner,
            isSpectating ? "" : playMode
        ]);
    }

    move(id, x, y, a) {
         this.send("m", [id, x, y, a]);
    }

    cost(amount) {
        this.send("C", [amount]);
    }

    rtf(thrust, left, right, brake, shoot) {
        this.send("R", [thrust, left, right, brake, shoot]);
    }

    talk(message) { // This function will see significant changes as I actually implement chatroom!
        this.send("T", [message]);
    }

    upgrade(id, upgrade) {
        this.send("U", [id, upgrade]);
    }
}


class Sidebar {
    constructor() {
        this.path = new Path2D();
        this.path.moveTo(60, 56);
        this.path.quadraticCurveTo(36, 56, 36, 80);
        this.path.lineTo(36, 262);
        this.path.quadraticCurveTo(36, 286, 60, 286);
        this.path.lineTo(242, 286);
        this.path.quadraticCurveTo(266, 286, 266, 310);
        this.path.lineTo(266, 856);
        this.path.quadraticCurveTo(266, 872, 250, 880);
        this.path.lineTo(152, 928);
        this.path.quadraticCurveTo(136, 936, 136, 952);
        this.path.lineTo(136, 1120);
        this.path.quadraticCurveTo(136, 1144, 160, 1144);
        this.path.lineTo(0, 1144);
        this.path.lineTo(0, 56);
        this.path.closePath();
        this.dumpass = new Path2D(); // Whatever you think the name is, you are wrong, it isn't
        this.dumpass.moveTo(266, 910);
        this.dumpass.quadraticCurveTo(266, 897, 254, 903);
        this.dumpass.lineTo(158, 950);
        this.dumpass.quadraticCurveTo(152, 953, 152, 958);
        this.dumpass.lineTo(152, 1120);
        this.dumpass.quadraticCurveTo(152, 1129, 170, 1129);
        this.dumpass.lineTo(258, 1129);
        this.dumpass.quadraticCurveTo(266, 1129, 266, 1121);
        this.dumpass.lineTo(266, 910);
    }

    draw(parent, interpolator) {
        var ctx = parent.ctx;
        ctx.fillStyle = "black";
        ctx.fill(this.path);
        ctx.beginPath();
        ctx.roundRect(46, 66, 220, 210, 14);
        ctx.fill();
        ctx.fill(this.dumpass);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "white";
        ctx.stroke(this.dumpass);
        ctx.font = "bold 14px 'Chakra Petch'";
        ctx.textAlign = "left";
        ctx.fillStyle = "white";
        ctx.fillText("X", 20, 632 + 7);
        ctx.fillText("Y", 148, 632 + 7);
        ctx.font = "24px 'Chakra Petch'";
        ctx.fillText(parent.gameX, 20, 650 + 12);
        ctx.fillText(parent.gameY, 148, 650 + 12);
        ctx.fillStyle = "#333";
        ctx.fillRect(18, 487, 218, 2);
        ctx.fillRect(18, 771, 218, 2);

        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect(197, 1060, 26, 26);
        if (parent.controls.up) {
            ctx.fillRect(197, 1060, 26, 26);
        }    
        ctx.strokeRect(168, 1089, 26, 26);
        if (parent.controls.left) {
            ctx.fillRect(168, 1089, 26, 26);
        }
        ctx.strokeRect(197, 1089, 26, 26);
        if (parent.controls.down) {
            ctx.fillRect(197, 1089, 26, 26);
        }
        ctx.strokeRect(226, 1089, 26, 26);
        if (parent.controls.right) {
            ctx.fillRect(226, 1089, 26, 26);
        }
        if (parent.castle) {
            ctx.strokeRect(226, 1060, 26, 26);
            ctx.fillRect(226, 1060, 26, 26);
            ctx.beginPath();
            ctx.save();
            ctx.translate(238, 1072);
            var ang = Math.atan2(parent.castle.y - parent.gameY, parent.castle.x - parent.gameX);
            ctx.rotate(ang);
            ctx.moveTo(6, 0);
            ctx.lineTo(-6, -3);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-6, 3);
            ctx.closePath();
            ctx.fillStyle = "black";
            ctx.fill();
            ctx.restore();
            ctx.beginPath();
            ctx.arc(209, 992, 50, 0, Math.PI * 2);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "white";
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(209, 992, 4, 0, Math.PI * 2);
            ctx.fillStyle = "white";
            ctx.fill();
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(209, 992, 33, 0, Math.PI * 2);
            ctx.moveTo(226, 992);
            ctx.arc(209, 992, 17, 0, Math.PI * 2);
            ctx.stroke();
            Object.values(parent.objects).forEach(object => {
                var dx = object.getX(interpolator) - parent.castle.getX(interpolator);
                var dy = object.getY(interpolator) - parent.castle.getY(interpolator);
                if (dx * dx + dy * dy < 400 * 400 && object.isCompassVisible() && object != parent.castle) {
                    if (object.isOurs) {
                        ctx.fillStyle = "rgb(47, 237, 51)";
                    }
                    else {
                        ctx.fillStyle = "rgb(231, 57, 30)";
                    }
                    var offsetX = (dx / 400) * 50;
                    var offsetY = (dy / 400) * 50;
                    ctx.beginPath();
                    ctx.arc(209 + offsetX, 992 + offsetY, 5, 0, Math.PI * 2);
                    ctx.globalAlpha = 0.5;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                    ctx.arc(209 + offsetX, 992 + offsetY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.moveTo(209, 1069);
        ctx.lineTo(214, 1075);
        ctx.lineTo(204, 1075);
        ctx.closePath()
        ctx.moveTo(183, 1096);
        ctx.lineTo(177, 1101);
        ctx.lineTo(183, 1106);
        ctx.closePath();
        ctx.moveTo(204, 1098);
        ctx.lineTo(214, 1098);
        ctx.lineTo(209, 1104);
        ctx.closePath();
        ctx.moveTo(235, 1096);
        ctx.lineTo(241, 1101);
        ctx.lineTo(235, 1106);
        ctx.closePath();
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.stroke();
    }
}


class GameObject {
    constructor(x, y, w, h, a, type, editable, id, banner) {
        this.x = x;
        this.xOld = x;
        this.y = y;
        this.yOld = y;
        this.w = w;
        this.wOld = w;
        this.h = h;
        this.hOld = h;
        this.a = a;
        this.aOld = a;
        this.type = type;
        this.isEditable = editable;
        this.id = id;
        this.banner = banner;
        this.upgrades = [];
        this.goalPos = {
            x: this.x,
            y: this.y,
            a: this.a,
            hasChanged: false
        };
        this.box = this.bbox();
        this.isOurs = false;
        this.isHovered = false;
        this.editState = 0; // 0 = none; 1 = picked up, moving; 2 = picked up, setting angle
    }

    interpolate(value, property) {
        return this[property] * value + this[property + "Old"] * (1 - value);
    }

    getX(interpolator) {
        return this.interpolate(interpolator, "x");
    }

    getY(interpolator) {
        return this.interpolate(interpolator, "y");
    }

    getA(interpolator) {
        return this.interpolate(interpolator, "a");
    }

    getW(interpolator) {
        return this.interpolate(interpolator, "w");
    }

    getH(interpolator) {
        return this.interpolate(interpolator, "h");
    }

    draw(master, interpolator) {
        var ctx = master.ctx;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "white";
        var w = this.getW(interpolator);
        var h = this.getH(interpolator);
        var a = this.getA(interpolator);
        var x = this.getX(interpolator);
        var y = this.getY(interpolator);
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.rotate(-a);
        ctx.font = "10px 'Chakra Petch'";
        if (this.isOurs) {
            ctx.fillStyle = "orange";
            ctx.font = "bold 12px 'Chakra Petch'";
        }
        else{
            ctx.fillStyle = "yellow";
        }
        ctx.textAlign = "left";
        ctx.fillText(this.type + "#" + this.id + " " + this.banner + "(" + master.banners[this.banner] + ")", -50, -h/2 - 10);
        ctx.translate(-x, -y);
        ctx.strokeStyle = "green";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 1;
        ctx.strokeRect(this.box[0], this.box[1], this.box[2] - this.box[0], this.box[3] - this.box[1]);
        if (this.isOurs && this.isEditable) {
            ctx.strokeStyle = "green";
            ctx.fillStyle = "green";
            if (this.isHovered) {
                ctx.fillRect(this.goalPos.x - 5, this.goalPos.y - 5, 10, 10);
            }
            ctx.strokeRect(this.goalPos.x - 5, this.goalPos.y - 5, 10, 10);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.goalPos.x, this.goalPos.y);
            ctx.lineTo(this.goalPos.x + Math.cos(this.goalPos.a) * 20, this.goalPos.y + Math.sin(this.goalPos.a) * 20);
            ctx.stroke();
        }
    }

    isChanged() {
        return this.xOld != this.x || this.yOld != this.y || this.aOld != this.a || this.wOld != this.w || this.hOld != this.h;
    }

    tick(game) {
        if (this.isChanged()) {
            this.box = this.bbox();
        }
        this.xOld = this.x;
        this.yOld = this.y;
        this.wOld = this.w;
        this.hOld = this.h;
        this.aOld = this.a;
        if (this.goalPos.hasChanged) {
            this.goalPos.hasChanged = false;
            game.comms.move(this.id, this.goalPos.x, this.goalPos.y, this.goalPos.a);
        }
    }

    bbox() { // Produces a high-quality bbox of rotated rectangular objects
        var topleft = new Vector(-this.w / 2, -this.h / 2).rotate(this.a);
        var topright = new Vector(this.w / 2, -this.h / 2).rotate(this.a);
        var bottomleft = new Vector(-this.w / 2, this.h / 2).rotate(this.a);
        var bottomright = new Vector(this.w / 2, this.h / 2).rotate(this.a);
        var minX = topleft.sort((v1, v2) => {
            return v1.x < v2.x;
        }).with(topright).with(bottomleft).with(bottomright).x;
        var minY = topleft.sort((v1, v2) => {
            return v1.y < v2.y;
        }).with(topright).with(bottomleft).with(bottomright).y;
        var maxX = topleft.sort((v1, v2) => {
            return v1.x > v2.x;
        }).with(topright).with(bottomleft).with(bottomright).x;
        var maxY = topleft.sort((v1, v2) => {
            return v1.y > v2.y;
        }).with(topright).with(bottomleft).with(bottomright).y;
        return [this.x + minX, this.y + minY, this.x + maxX, this.y + maxY];
    }

    interact(game) {
        this.isOurs = game.mine.indexOf(this.id) != -1;
        if (!game.status.moveShips) {
            this.editState = 0;
        }
        if (this.editState == 1) {
            this.goalPos.x = game.gameX;
            this.goalPos.y = game.gameY;
            this.goalPos.hasChanged = true;
        }
        else if (this.editState == 2) {
            this.goalPos.a = new Vector(game.gameX - this.goalPos.x, game.gameY - this.goalPos.y).angle();
            this.goalPos.hasChanged = true;
        }
    }

    click(game) { // called on EVERY CLICK, not just clicks where it's hovered
        if (!game.status.moveShips) {
            return;
        }
        if (this.editState == 1) {
            this.editState = 2;
        }
        else if (this.editState == 2) {
            this.editState = 0;
            game.locked = false;
        }
        if (!game.locked) {
            if (this.isHovered) {
                this.editState = 1;
                game.locked = true;
            }
        }
    }

    isCompassVisible() { // Can it be seen on a compass?
        const hidden = ["s", "b"]; // List of types that can't be displayed on minimap/compass
        var isSniper = this.upgrades.indexOf("s")!= -1;
        return this.isOurs || (hidden.indexOf(this.type) == -1 && !isSniper);
    }

    upgrade(upgrade) {
        this.upgrades.push(upgrade);
    }
}


class Game {
    constructor(socket) {
        this.comms = new Protocol(socket);
        this.comms.addEventListener("protocolmessagereceived", (evt) => {
            this.onmessage(evt.command, evt.args);
        });
        this.gamesize = 0;
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        this.health = -1;
        this.hasPlacedCastle = false;
        this.castle = undefined;
        this.ctx.makeRoundRect = function (x, y, width, height, rx, ry) { // Stolen from #platformer
            this.translate(x, y);
            this.moveTo(rx, 0);
            this.lineTo(width - rx, 0);
            this.quadraticCurveTo(width, 0, width, ry);
            this.lineTo(width, height - ry);
            this.quadraticCurveTo(width, height, width - rx, height);
            this.lineTo(rx, height);
            this.quadraticCurveTo(0, height, 0, height - ry);
            this.lineTo(0, ry);
            this.quadraticCurveTo(0, 0, rx, 0);
            this.translate(-x, -y);
        };
        if (this.ctx.roundRect == undefined) { // Polyfill: roundRect doesn't have very good browser support (it's quite new: Chrome released support just last year and Firefox this year), so this is necessary. Keep your browsers up to date, dammit!
            this.ctx.roundRect = function (x, y, width, height, radii) {
                this.ctx.makeRoundRect(x, y, width, height, radii, radii);
            };
        }
        this.status = {
            spectating: false,
            online: false,
            moveShips: false,
            isTeamLeader: false,
            wallsRemaining: 4, // 4 on the first turn
            wallsTurn: 2, // 2 every next turn, but Extra Walls can increase this.
            wait: true,
            score: 0,
            countdown: 0, // Set by the ! command
            counter: 0, // Set by the t command
            tickTime: 1000 / 30, // Number of milliseconds between ticks or !s; this is adjusted based on real-time data.
            lastTickTime: -1,
            canPlaceObject: false, // if the mouse is close to the home castle with 400 tolerance
            mouseWithinNarrowField: false, // if the mouse is close to any game object with 400 tolerance
            mouseWithinWideField: false, // if the mouse is close to any game object with 600 tolerance
            getTableBite() { // Don't ask
                return this.online ? (this.spectating ? "SPECTATING" : "ONLINE") : "OFFLINE";
            },
            getChairBites() { // Don't ask even more
                return this.wait ? "WAITING" : (this.moveShips ? "MOVE SHIPS" : "PLAY");
            },
            ticksRemaining() {
                return this.wait ? this.countdown : this.counter;
            },
            getTimes() {
                var _ms = this.ticksRemaining() * this.tickTime;
                var _secs = _ms / 1000;
                var minutes = Math.floor(_secs / 60);
                var seconds = Math.floor(_secs % 60);
                var hundreds = _secs % 1;
                hundreds = Math.round(hundreds * 100);
                return [minutes, seconds, hundreds];
            },
            getTimeString() {
                var times = this.getTimes();
                return "- " + zeroes("" + times[0]) + ":" + zeroes("" + times[1]) + ":" + zeroes("" + times[2]);
            }
        };
        this.mouseX = 0; // Mouse position in UI
        this.mouseY = 0;
        this.gameX = 0; // Mouse position in game
        this.gameY = 0;
        this.cX = 0; // Distance from the top-left corner of the actual gameboard to the center of the view screen
        this.cY = 0;
        this.sideScroll = 0;
        this.sidebar = new Sidebar();
        this.objects = {};
        this.banners = {}; // Relating banners to banner names
        this.teams = {}; // Relating player banners to team banners
        this.bgCall = undefined;
        this.mine = [];
        this.locked = false; // for objects to not be edited at the same time
        this.keysDown = {};
        this.controls = {
            up: false,
            left: false,
            down: false,
            right: false
        };
    }

    attemptWall() {
        if (this.status.canPlaceObject && this.status.wallsRemaining > 0) {

        }
    }

    start(formdata) {
        var isSpectating = formdata.get("spectator") == "on";
        this.comms.connect(formdata.get("banner-name"), formdata.get("password-input"), formdata.get("playmode"), isSpectating);
    }

    onmessage(command, args) {
        if (command == "m") {
            this.gamesize = args[0] - 0;
            screen("gameui");
            this.bgCall = prerenderBackground(this.gamesize); // Pre-draw the background image onto a hidden canvas
            this._main();
        }
        else if (command == "t") {
            this.tick();
            this.status.wait = false; // If it's receiving TICK commands it is not waiting
            this.status.counter = args[0] - 0;
        }
        else if (command == "!") {
            this.status.countdown = args[0] - 0;
        }
        else if (command == "?") {
            this.status.isTeamLeader = true;
        }
        else if (command == "B") {
            console.log("banner " + args[1] + " sent a message with priority " + args[2] + ": " + args[0]);
        }
        else if (command == "s") {

        }
        else if (command == "S") {
            this.status.score = args[0] - 0;
        }
        else if (command == "e") {
            
        }
        else if (command == "d") {
            delete this.objects[args[0]];
        }
        else if (command == "n") {
            this.objects[args[1]] = new GameObject(args[2] - 0, args[3] - 0, args[7] - 0, args[8] - 0, args[4] - 0, args[0], args[5] == "1", args[1], args[6] - 0);
            if ((args[0] == "c" || args[0] == "R") && this.mine.indexOf(args[1]) != -1) {
                this.castle = this.objects[args[1]];
            }
        }
        else if (command == "M") {
            var obj = this.objects[args[0]];
            obj.x = args[1] - 0;
            obj.y = args[2] - 0;
            if (args.length > 3) {
                obj.a = args[3] - 0;
            }
            if (args.length > 4) {
                obj.w = args[4] - 0;
                obj.h = args[5] - 0;
            }
        }
        else if (command == "w") {
            if (args[0] == 0) {
                this.status.spectating = true;
            }
        }
        else if (command == "b") {
            this.banners[args[0]] = args[1];
            if (args.length > 2) {
                this.teams[args[1]] = args[2];
            }
        }
        else if (command == "a") {
            this.mine.push(args[0]);
        }
        else if (command == "l") {
            screen("youLose");
            setTimeout(() => {
                screen("gameui");
            }, 3000);
        }
        else if (command == "E") {
            if (this.castle.banner == args[0]) {
                screen("youWin");
            }
            else {
                document.getElementById("winnerBanner").innerText = this.banners[this.castle.banner];
                screen("gameOver");
            }
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
        else if (command == "u") {
            this.objects[args[0]].upgrade(args[1]);
        }
        else {
            console.warn("UNRECOGNIZED COMMAND " + command + "!");
            console.log(args);
        }
        if (command == "t" || command == "!") {
            this.status.moveShips = args[1] == '1';
            var curTime = window.performance.now();
            var gTickTime = curTime - this.status.lastTickTime;
            const drag = 0.99;
            this.status.tickTime = this.status.tickTime * drag + gTickTime * (1 - drag);
            this.status.lastTickTime = curTime;
            if (args[2]) {
                this.health = args[2] - 0;
            }
        }
    }

    _main() {
        this.status.online = this.comms.isOnline;
        this.interactionLoop();
        this.renderLoop();
        if (!this.harikari) {
            requestAnimationFrame(() => { this._main() });
        }
    }

    renderGameboard(interpolator) {
        this.ctx.fillStyle = "#111111";
        this.ctx.save();
        if (this.bgCall) {
            this.bgCall(this.cX - window.innerWidth / 2, this.cY - window.innerHeight / 2);
        }
        this.ctx.drawImage(document.getElementById("background"), 0, 0); //offx, offy);
        this.ctx.translate(window.innerWidth / 2 - this.cX, window.innerHeight / 2 - this.cY);
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.gamesize, this.gamesize);
        //this.ctx.fillRect(0, 0, this.gamesize, this.gamesize);
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(this.gameX - 5, this.gameY - 5, 10, 10);
        Object.values(this.objects).forEach((item) => {
            item.draw(this, interpolator);
        });
        this.ctx.restore();
    }

    drawStatus() {
        this.ctx.fillStyle = "#555555";
        this.ctx.font = "12px 'Chakra Petch'";
        this.ctx.textAlign = "left";
        this.ctx.fillText("SYSTEM STATUS", 18, 9 + 15.6 / 2);
        this.ctx.font = "16px 'Chakra Petch'";
        this.ctx.fillStyle = "white";
        var word = this.status.getTableBite();
        var width = this.ctx.measureText(word).width;
        this.ctx.fillRect(18, 28, width, 21);
        this.ctx.fillStyle = "black";
        this.ctx.fillText(word, 18, 28 + 6 + 21 / 2);
        word = this.status.getChairBites();
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.status.getChairBites(), 18 + width + 13, 28 + 6 + 21 / 2);
        width += 13 + this.ctx.measureText(word).width;
        this.ctx.fillStyle = "#CBCAFF";
        this.ctx.fillText(this.status.getTimeString(), 18 + width + 17, 28 + 6 + 21 / 2);
    }

    renderUI(interpolator) {
        this.ctx.translate(0, -this.sideScroll);
        this.sidebar.draw(this, interpolator);
        this.ctx.translate(0, this.sideScroll);
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, window.innerWidth, 56);
        this.ctx.fillRect(0, window.innerHeight - 56, window.innerWidth, 56);
        this.ctx.fillRect(0, 0, 9, window.innerHeight);
        this.ctx.fillRect(window.innerWidth - 56, 0, 56, window.innerHeight);
        this.ctx.beginPath();
        this.ctx.moveTo(window.innerWidth - 80, 56);
        this.ctx.quadraticCurveTo(window.innerWidth - 56, 56, window.innerWidth - 56, 80);
        this.ctx.lineTo(window.innerWidth - 56, 56);
        this.ctx.fill();
        this.ctx.moveTo(window.innerWidth - 80, window.innerHeight - 56);
        this.ctx.quadraticCurveTo(window.innerWidth - 56, window.innerHeight - 56, window.innerWidth - 56, window.innerHeight - 80);
        this.ctx.lineTo(window.innerWidth - 56, window.innerHeight - 56);
        this.ctx.fill();
        this.drawStatus();
    }

    renderLoop() { // Is called as much as possible; draws things and does smooth rendering
        this.ctx.fillStyle = "lightcoral";
        var interpolator = (window.performance.now() - this.status.lastTickTime) / this.status.tickTime;
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        this.renderGameboard(interpolator);
        this.renderUI(interpolator);
    }

    mouseFieldCheckOnOne(size, obj) {
        var bbox = obj.box;
        return this.gameX > bbox[0] - size && this.gameX < bbox[2] + size && this.gameY > bbox[1] - size && this.gameY < bbox[3] + size;
    }

    mouseFieldCheck(size) {
        var objects = Object.values(this.objects);
        for (var i = 0; i < objects.length; i++) {
            if (this.mouseFieldCheckOnOne(size, objects[i])) {
                return true;
            }
        }
        return false;
    }

    doMouse() {
        this.gameX = clamp(0, Math.round(this.cX + this.mouseX - window.innerWidth / 2), this.gamesize);
        this.gameY = clamp(0, Math.round(this.cY + this.mouseY - window.innerHeight / 2), this.gamesize);
        this.status.mouseWithinNarrowField = this.mouseFieldCheck(400);
        this.status.mouseWithinWideField = this.mouseFieldCheck(600);
        if (this.castle) {
            this.status.canPlaceObject = this.mouseFieldCheckOnOne(400, this.castle);
        }
    }

    interactionLoop() { // Is called as much as possible; handles interaction with the user
        this.doMouse();
        Object.values(this.objects).forEach((item) => {
            item.isHovered = this.gameX > item.x - 5 && this.gameX < item.x + 5 && this.gameY > item.y - 5 && this.gameY < item.y + 5;
            item.interact(this);
        });

        this.controls.up = this.keysDown["ArrowUp"] || this.keysDown["w"];
        this.controls.down = this.keysDown["ArrowDown"] || this.keysDown["s"];
        this.controls.left = this.keysDown["ArrowLeft"] || this.keysDown["a"];
        this.controls.right = this.keysDown["ArrowRight"] || this.keysDown["d"];
        if (this.controls.up) {
            this.cY -= 20;
        }
        else if (this.controls.down) {
            this.cY += 20;
        }
        if (this.controls.left) {
            this.cX -= 20;
        }
        else if (this.controls.right) {
            this.cX += 20;
        }
        this.cX = clamp(0, this.cX, this.gamesize);
        this.cY = clamp(0, this.cY, this.gamesize);
    }

    talk() { // Call every server tick; sends things to the server

    }

    tick() { // Runs every server tick
        this.talk();
        Object.values(this.objects).forEach((item) => {
            item.tick(this);
        });
    }

    connectionClosed() {

    }

    scroll(dx, dy) {
        if (this.mouseX < 266) {
            this.sideScroll += dy + dx;
            this.sideScroll = clamp(0, this.sideScroll, 1144 - window.innerHeight + 56)
        }
        else {
            this.cX += dx;
            this.cY += dy;
            this.cX = clamp(0, this.cX, this.gamesize);
            this.cY = clamp(0, this.cY, this.gamesize);
        }
    }

    mouse(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }

    mouseDown() {
        
    }

    place(type) {
        this.comms.place(type, this.gameX, this.gameY);
    }

    mouseUp() {
        if (this.mouseX < 266) { // It's in the sidebar

        }
        else {
            if (this.hasPlacedCastle) {
                Object.values(this.objects).forEach(item => {
                    if (item.isOurs) {
                        item.click(this);
                    }
                });
            }
            else if (!this.status.mouseWithinWideField){
                this.place("c");
                this.hasPlacedCastle = true;
            }
        }
    }

    kill() {
        this.harikari = true;
    }
}


function screen(s) {
    Array.from(document.body.children).forEach(el => {
        if (el.id == s) {
            el.style.display = "";
        }
        else {
            el.style.display = "none";
        }
    });
}

screen("gameui");

var game = undefined;

function play() {
    randomizeBanner();
    var started = false;
    screen("establishin");
    var ws_url = document.getElementById("server-url").value;
    var socket = new WebSocket(ws_url);
    game = new Game(socket);
    var form = new FormData(document.getElementById("startform"));
    socket.onopen = () => {
        started = true;
        game.start(form);
        window.addEventListener("wheel", (evt) => {
            game.scroll(evt.deltaX, evt.deltaY);
            evt.preventDefault();
            return false;
        },
        {passive:false}
        );

        window.addEventListener("scroll", (evt) => {
            evt.preventDefault();
            return false;
        });

        window.addEventListener("mousemove", (evt) => {
            game.mouse(evt.clientX, evt.clientY);
        });

        window.addEventListener("mousedown", (evt) => {
            game.mouseDown();
        });

        window.addEventListener("mouseup", (evt) => {
            game.mouseUp();
        });

        window.addEventListener("keydown", (evt) => {
            game.keysDown[evt.key] = true;
        });
        
        window.addEventListener("keyup", (evt) => {
            game.keysDown[evt.key] = false;
        });
    };
    socket.onerror = () => {
        if (!started) {
            screen("failedToConnect");
            setTimeout(() => {
                screen("startscreen");
            }, 1000);
        }
    };
    socket.onclose = () => {
        game.connectionClosed();
    };
}

function resizah() {
    var game = document.getElementById("game");
    game.width = window.innerWidth;
    game.height = window.innerHeight;
    var background = document.getElementById("background");
    if (diva) {
        background.width = divaW;
        background.height = divaH;
        background.style.display = "";
    }
    else{
        background.width = window.innerWidth;
        background.height = window.innerHeight;
    }
};

resizah();

window.addEventListener("resize", resizah);

function zeroes(num, size = 2) { 
    while (num.length < size) {
        num = "0" + num;
    }
    return num;
}

function guessWS() {
    var construct = "ws";
    if (window.location.protocol == "https:") {
        construct += "s";
    }
    construct += "://";
    construct += window.location.host + window.location.pathname;
    construct += "/game";
    return construct;
}


/* OPTIMIZATION:
    In the olden days, the client was constantly sending requests (usually MOVE) at every frame, or thereabouts!
    This is obviously unsuitable because my system updates at 120 hz, most systems update at 60hz, and the server updates at 30hz.
    *At best, the server was receiving updates twice as often as optimal*. This is bad, but it's even worse when you consider RTFs:
    they have to send a relatively sizeable broadcast at whatever framerate the system uses *just to be usable at all*.
    In effect, every game we played was ddosing my server.

    Gonna try to avoid that!
*/

document.getElementById("server-url").value = "ws://localhost:3000/game";

randomizeBanner();
screen("startscreen");