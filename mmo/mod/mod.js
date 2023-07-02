function clamp(min, val, max) {
    if (val < min) {
        val = min;
    }
    if (val > max) {
        val = max;
    }
    return val;
}

class Protocol {
    constructor(socket, onmessage) {
        this.socket = socket;
        this.uponmessage = onmessage;
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
            this.uponmessage(command, args);
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

    ping() {
        this.socket.send("_");
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

    draw(parent) {
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
            a: this.a
        };
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
        ctx.fillStyle = "red";
        ctx.font = "10px 'Chakra Petch'";
        ctx.textAlign = "left";
        ctx.fillText(this.type + "#" + this.id + " " + this.banner + "(" + master.banners[this.banner] + ")", -50, -h/2 - 10);
        ctx.translate(-x, -y);
        ctx.strokeStyle = "green";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    tick() {
        this.xOld = this.x;
        this.yOld = this.y;
        this.wOld = this.w;
        this.hOld = this.h;
        this.aOld = this.a;
    }
}


class Game {
    constructor(socket) {
        this.comms = new Protocol(socket, (cmd, argz) => { this.onmessage(cmd, argz) });
        this.gamesize = 0;
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        this.health = -1;
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
        if (this.ctx.roundRect == undefined){ // Polyfill: roundRect doesn't have very good browser support (it's quite new: Chrome released support just last year and Firefox this year), so this is necessary. Keep your browsers up to date, dammit!
            this.ctx.roundRect = function(x, y, width, height, radii) {
                this.ctx.makeRoundRect(x, y, width, height, radii, radii);
            };
        }
        this.status = {
            spectating: false,
            online: false,
            moveShips: false,
            wait: true,
            countdown: 0, // Set by the ! command
            counter: 0, // Set by the t command
            tickTime: 1000 / 30, // Number of milliseconds between ticks or !s; this is adjusted based on real-time data.
            lastTickTime: -1,
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
        this.banners = {};
        this.bgCall = undefined;
    }

    start(formdata) {
        var is_spectating = formdata.get("spectator") == "on";
        this.comms.send('c', [
            is_spectating ? "" : formdata.get("password-input"),
            formdata.get("banner-name"),
            is_spectating ? "" : formdata.get("playmode")
        ]);
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
        else if (command == "s") {

        }
        else if (command == "e") {
            
        }
        else if (command == "d") {
            delete this.objects[args[0]];
        }
        else if (command == "n") {
            this.objects[args[1]] = new GameObject(args[2] - 0, args[3] - 0, args[7] - 0, args[8] - 0, args[4] - 0, args[0], args[5] == "1", args[1], args[6] - 0);
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
        }
        if (command == "t" || command == "!") {
            this.status.moveShips = args[1] == '1';
            var curTime = window.performance.now();
            var gTickTime = curTime - this.status.lastTickTime;
            const drag = 0.95;
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
        requestAnimationFrame(() => { this._main() });
    }

    renderGameboard() {
        this.ctx.fillStyle = "#111111";
        this.ctx.save();
        var offx = clamp(0, window.innerWidth / 2 - this.cX, this.gamesize - this.cX - window.innerWidth / 2);
        var offy = clamp(0, window.innerHeight / 2 - this.cY, this.gamesize - this.cY - window.innerHeight / 2);
        if (this.bgCall) {
            this.bgCall(clamp(0, this.cX - window.innerWidth/2, this.gamesize), clamp(0, this.cY - window.innerHeight/2, this.gamesize));
        }
        this.ctx.drawImage(document.getElementById("background"), offx, offy);
        this.ctx.translate(window.innerWidth / 2 - this.cX, window.innerHeight / 2 - this.cY);
        //this.ctx.fillRect(0, 0, this.gamesize, this.gamesize);
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(this.gameX - 5, this.gameY - 5, 10, 10);
        var interpolator = (window.performance.now() - this.status.lastTickTime) / this.status.tickTime;
        Object.values(this.objects).forEach((item) => {
            item.draw(this, interpolator);
        });
        this.ctx.restore();
    }

    drawStatus() {
        this.ctx.fillStyle = "#555555";
        this.ctx.font = "12px 'Chakra Petch'";
        this.ctx.textAlign = "left";
        this.ctx.fillText("SYSTEM STATUS", 18, 9 + 15.6/2);
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

    renderUI() {
        this.ctx.translate(0, -this.sideScroll);
        this.sidebar.draw(this);
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
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        this.renderGameboard();
        this.renderUI();
    }

    doMouse() {
        this.gameX = clamp(0, Math.round(this.cX + this.mouseX - window.innerWidth/2), this.gamesize);
        this.gameY = clamp(0, Math.round(this.cY + this.mouseY - window.innerHeight/2), this.gamesize);
    }

    interactionLoop() { // Is called as much as possible; handles interaction with the user
        this.doMouse();
    }

    talk() { // Call every server tick; sends things to the server

    }

    tick() { // Runs every server tick
        this.talk();
        Object.values(this.objects).forEach((item) => {
            item.tick();
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
            this.cX = clamp(0, this.cX, this.gamesize);
            this.cY += dy;
            this.cY = clamp(0, this.cY, this.gamesize);
        }
    }

    mouse(x, y) {
        this.mouseX = x;
        this.mouseY = y;
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
    var started = false;
    screen("establishin");
    var ws_url = document.getElementById("server-url").value;
    var socket = new WebSocket(ws_url);
    game = new Game(socket);
    var form = new FormData(document.getElementById("startform"));
    socket.onopen = () => {
        started = true;
        game.start(form);
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
}

function resizah() {
    var game = document.getElementById("game");
    game.width = window.innerWidth;
    game.height = window.innerHeight;
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
    In the olden days, the client was constantly sending MOVE requests at every frame, or thereabouts!
    This is obviously unsuitable because my system updates at 120 hz, most systems update at 60hz, and the server updates at 30hz.
    *At best, the server was receiving updates twice as often as optimal*. This is bad, but it's even worse when you consider RTFs:
    they have to send a relatively sizeable broadcast at whatever framerate the system uses *just to be usable at all*.
    In effect, every game we played was ddosing my server.

    Gonna try to avoid that!
*/

document.getElementById("server-url").value = "ws://localhost:3000/game";

play();