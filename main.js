/* 
    Castles is a 1-player strategy game
    The enemy has a number of "ships" that zoom towards your "base"
    If your base gets hit, you lose
    However, every turn you get to choose where each of 5 fighters will move to and aim at (your fighters have guns, albeit not very good ones)
    Then every ship in the game moves a bit and does whatever commands you requested
*/

const FPS = 60;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

var score = 0;

class Castle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    destroy() {
        alert("Game over! Corrected score at difficulty" + difficulty + ": " + correctScore(score));
        window.location.reload();
    }

    draw() {
        ctx.fillStyle = "green";
        ctx.fillRect(this.x - 25, this.y - 25, 50, 50);
    }

    box() {
        return [this.x - 25, this.y - 25, this.x + 25, this.y + 25];
    }
}


class Block {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.TTL = 360;
    }

    box() {
        return [this.x, this.y, this.x + this.w, this.y + this.h];
    }

    draw() {
        ctx.fillStyle = "grey";
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }

    loop() {
        this.TTL--;
        if (this.TTL < 0) {
            this.rm = true;
        }
    }

    destroy() {
        this.rm = true;
        score -= 2;
    }
}


function coterminal(angle, rotationLength = Math.PI * 2) {
    while (angle >= rotationLength) {
        angle -= rotationLength;
    }
    while (angle < 0) {
        angle += rotationLength;
    }
    return angle;
}


function loopize(set, cur, rotationLength = Math.PI * 2){
    if (Math.abs(set - cur) >= rotationLength/2){
        if (set > cur){
            return -(rotationLength - set + cur);
        }
        else{
            return rotationLength - cur + set;
        }
    }
    else{
        return set - cur;
    }
}

function untwist(box) { // Untwist a box
    if (box[0] > box[2]) {
        var oldBox2 = box[2];
        box[2] = box[0];
        box[0] = oldBox2;
    }
    if (box[1] > box[3]) {
        var oldBox3 = box[3];
        box[3] = box[1];
        box[1] = oldBox3;
    }
    return box;
}

function collision(one, two) {
    var oneBox = untwist(one.box());
    var twoBox = untwist(two.box());
    return oneBox[2] > twoBox[0] &&
        oneBox[0] < twoBox[2] &&
        oneBox[3] > twoBox[1] &&
        oneBox[1] < twoBox[3];
}

function clampToEdge(coords) {
    var distX = Math.min(coords[0], gameSize - coords[0]); // distance to the nearest edge on the x axis
    var distY = Math.min(coords[1], gameSize - coords[1]); // ditto, but for y
    if (distX > distY) {
        coords[0] = Math.round(coords[0] / gameSize) * gameSize;
    }
    else if (distY > distX) {
        coords[1] = Math.round(coords[1] / gameSize) * gameSize;
    }
    return coords;
}

class EnemyShip {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.xv = 0;
        this.yv = 0;
        this.target = target;
        this.anGOAL = 0;
        this.angle = 0;
        this.startCooldown = 120;
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        this.startCooldown--;
        this.anGOAL = Math.atan((this.y - this.target.y) / (this.x - this.target.x));
        if ((this.x - this.target.x) > 0) {
            this.anGOAL += Math.PI;
        }
        this.angle += loopize(this.anGOAL, this.angle) * 0.07;
        this.xv += Math.cos(this.angle) * 0.03;
        this.yv += Math.sin(this.angle) * 0.03;
        if (this.startCooldown > 0) {
            this.xv *= 0.8;
            this.yv *= 0.8;
        }
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        if (collision(this, this.target)) {
            this.target.destroy();
            this.destroy();
        }
    }

    destroy(givePoints = true) {
        this.rm = true;
        if (givePoints) {
            score += 10;
        }
    }

    draw() {
        ctx.strokeStyle = "red";
        ctx.fillStyle = "brown";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.lineTo(25, 0);
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.stroke();
        ctx.fill();
    }
}


class PasserEnemy {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.xv = 0;
        this.yv = 0;
        this.target = target;
        this.anGOAL = 0;
        this.angle = 0;
        this.startCooldown = 120;
        this.dontHitWalls = true;
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        this.startCooldown--;
        this.anGOAL = Math.atan((this.y - this.target.y) / (this.x - this.target.x));
        if ((this.x - this.target.x) > 0) {
            this.anGOAL += Math.PI;
        }
        this.angle += loopize(this.anGOAL, this.angle) * 0.07;
        this.xv += Math.cos(this.angle) * 0.03;
        this.yv += Math.sin(this.angle) * 0.03;
        if (this.startCooldown > 0) {
            this.xv *= 0.85;
            this.yv *= 0.85;
        }
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        if (collision(this, this.target)) {
            this.target.destroy();
            this.destroy();
        }
    }

    destroy(givePoints = true) {
        this.rm = true;
        if (givePoints) {
            score += 10;
        }
    }

    draw() {
        ctx.strokeStyle = "black";
        ctx.fillStyle = "black";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.lineTo(25, 0);
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.stroke();
        ctx.fill();
    }
}


class EnemyCruiser {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.xv = 0;
        this.yv = 0;
        this.anGOAL = 0;
        this.angle = 0;
        this.startCooldown = 120;
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        var closest = undefined;
        var closestValue = Infinity;
        fighters.forEach((fighter) => {
            var dX = fighter.x - this.x;
            var dY = fighter.y - this.y;
            var distance = dX * dX + dY * dY;
            if (distance < closestValue) {
                closest = fighter;
                closestValue = distance;
            }
        });
        if (closest) {
            this.target = closest;
        }
        else {
            return;
        }
        this.startCooldown--;
        this.anGOAL = Math.atan((this.y - this.target.y) / (this.x - this.target.x));
        if ((this.x - this.target.x) > 0) {
            this.anGOAL += Math.PI;
        }
        this.angle += loopize(this.anGOAL, this.angle) * 0.07;
        this.xv += Math.cos(this.angle) * 0.03;
        this.yv += Math.sin(this.angle) * 0.03;
        if (this.startCooldown > 0) {
            this.xv *= 0.8;
            this.yv *= 0.8;
        }
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
    }

    destroy(givePoints = true) {
        this.rm = true;
        if (givePoints) {
            score += 15;
        }
    }

    draw() {
        ctx.strokeStyle = "white";
        ctx.fillStyle = "brown";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.lineTo(25, 0);
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.stroke();
        ctx.fill();
    }
}


class Burster {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.xv = Math.random();
        this.yv = Math.random();
        this.TTL = 120;
    }

    box() {
        return [this.x - 10, this.y - 10, this.x + 10, this.y + 10];
    }

    loop() {
        this.TTL--;
        if (this.TTL < 0) {
            this.destroy(false);
            for (var i = 0; i < 5; i++){
                var enemy = new EnemyShip(this.x, this.y, this.target);
                enemy.anGOAL = Math.random() * Math.PI * 2;
                enemy.xv = Math.random() * 20;
                enemy.yv = Math.random() * 20;
                enemy.startCooldown = 10;
                enemies.push(enemy);
            }
        }
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
    }

    destroy(givePoints = true) {
        this.rm = true;
        if (givePoints) {
            score += 15;
        }
    }

    draw() {
        ctx.fillStyle = "orange";
        ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
    }
}


class Ghost {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.xv = 0;
        this.yv = 0;
        this.target = target;
        this.anGOAL = 0;
        this.angle = 0;
        this.startCooldown = 120;
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        this.startCooldown--;
        this.anGOAL = Math.atan((this.y - this.target.y) / (this.x - this.target.x));
        if ((this.x - this.target.x) > 0) {
            this.anGOAL += Math.PI;
        }
        this.angle += loopize(this.anGOAL, this.angle) * 0.07;
        this.xv += Math.cos(this.angle) * 0.03;
        this.yv += Math.sin(this.angle) * 0.03;
        if (this.startCooldown > 0) {
            this.xv *= 0.8;
            this.yv *= 0.8;
        }
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        if (collision(this, this.target)) {
            this.target.destroy();
            this.destroy();
        }
    }

    destroy(givePoints = true) {
        this.rm = true;
        if (givePoints) {
            score += 10;
        }
    }

    draw() {
        var dX = this.x - this.target.x;
        var dY = this.y - this.target.y;
        var dist = Math.sqrt(dX * dX + dY * dY);
        dist = dist / gameSize; // Reduce it to a percentage of the distance from the castle to the edge - note, this does not take into account pythagorean's theorem.
        dist *= 4.5;
        ctx.globalAlpha = Math.tanh(dist) * -1 + 1;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "green";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.lineTo(25, 0);
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.stroke();
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}


class Bullet {
    constructor(x, y, xv, yv) {
        this.x = x;
        this.y = y;
        this.xv = xv;
        this.yv = yv;
        this.TTL = 50;
    }

    draw() {
        ctx.fillStyle = "green";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        this.x += this.xv;
        this.y += this.yv;
        this.TTL--;
        if (this.TTL < 0) {
            this.destroy();
        }
        if (this.x < 0 || this.x > gameSize || this.y < 0 || this.y > gameSize) {
            this.destroy();
        }
    }

    destroy() {
        this.rm = true;
    }
};


class ExtraWalls {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 20;
        this.h = 20;
        this.isFirstLoop = true;
    }

    box() {
        return [0, 0, 0, 0];
    }

    draw() {

    }

    loop() {
        if (this.isFirstLoop) {
            wallsCount += 2;
            this.isFirstLoop = false;
        }
    }

    destroy() {

    }
}


class Fighter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.goalX = x;
        this.goalY = y;
        this.angle = Math.PI / 2;
        this.selected = false;
        this.xv = 0;
        this.yv = 0;
        this.goalAngle = 0;
        this.shootCycle = 0;
    }

    destroy() {
        this.rm = true;
        score -= 15;
    }

    box() {
        return [this.x - 20, this.y - 20, this.x + 20, this.y + 20];
    }

    loop() {
        if ((this.x != this.goalX) || (this.y != this.goalY)) {
            this.angle = Math.atan((this.y - this.goalY) / (this.x - this.goalX));
            if (this.x >= this.goalX) {
                this.angle += Math.PI;
            }
        }
        if (Math.abs(this.x - this.goalX) > 10 || Math.abs(this.y - this.goalY) > 10) {
            this.xv += Math.cos(this.angle) * 0.1;
            this.yv += Math.sin(this.angle) * 0.1;
        }
        else {
            //const factor = 0.5;
            this.angle = this.goalAngle;//this.angle = this.angle * factor + this.goalAngle * (1 - factor);
        }
        this.xv *= 0.95;
        this.yv *= 0.95;
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        this.shootCycle--;
        if (this.shootCycle < 0) {
            this.shoot();
            this.shootCycle = 30;
        }
    }

    shoot() {
        bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle) * 10, Math.sin(this.angle) * 10));
    }

    draw() {
        if (this.selected) {
            ctx.fillStyle = "yellow";
        }
        else {
            ctx.fillStyle = "blue";
        }
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillRect(-50, -2, 50, 4);
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, 20);
        ctx.lineTo(10, 0);
        ctx.fill();
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.fillStyle = "purple";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.goalX, this.goalY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.goalX, this.goalY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.moveTo(this.goalX, this.goalY);
        ctx.lineTo(this.goalX + Math.cos(this.goalAngle) * 30, this.goalY + Math.sin(this.goalAngle) * 30);
        ctx.stroke();
        this.selected = false;
    }

    highlight() {
        ctx.fillStyle = "yellow";
        var box = this.box();
        ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    }
}


class TieFighter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.goalX = x;
        this.goalY = y;
        this.angle = Math.PI / 2;
        this.selected = false;
        this.xv = 0;
        this.yv = 0;
        this.goalAngle = 0;
        this.shootCycle = 0;
    }

    destroy() {
        this.rm = true;
        score -= 30;
    }

    box() {
        return [this.x - 20, this.y - 20, this.x + 20, this.y + 20];
    }

    loop() {
        if ((this.x != this.goalX) || (this.y != this.goalY)) {
            this.angle = Math.atan((this.y - this.goalY) / (this.x - this.goalX));
            if (this.x > this.goalX) {
                this.angle += Math.PI;
            }
        }
        if (Math.abs(this.x - this.goalX) > 10 || Math.abs(this.y - this.goalY) > 10) {
            this.xv += Math.cos(this.angle) * 0.2;
            this.yv += Math.sin(this.angle) * 0.2;
        }
        else {
            //const factor = 0.5;
            this.angle = this.goalAngle;//this.angle = this.angle * factor + this.goalAngle * (1 - factor);
        }
        this.xv *= 0.95;
        this.yv *= 0.95;
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        this.shootCycle--;
        if (this.shootCycle < 0) {
            this.shoot();
            this.shootCycle = 30;
        }
    }

    shoot() {
        bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle) * 10, Math.sin(this.angle) * 10));
        bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle + Math.PI) * 10, Math.sin(this.angle + Math.PI) * 10));
    }

    draw() {
        if (this.selected) {
            ctx.fillStyle = "yellow";
        }
        else {
            ctx.fillStyle = "darkblue";
        }
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillRect(-50, -2, 50, 4);

        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(-40, -5);
        ctx.lineTo(-10, -5);
        ctx.moveTo(-40, 5);
        ctx.lineTo(-10, 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, 20);
        ctx.lineTo(10, 0);
        ctx.fill();
        ctx.rotate(-this.angle);
        ctx.translate(-this.x, -this.y);
        ctx.fillStyle = "purple";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.goalX, this.goalY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.goalX, this.goalY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.moveTo(this.goalX, this.goalY);
        ctx.lineTo(this.goalX + Math.cos(this.goalAngle) * 30, this.goalY + Math.sin(this.goalAngle) * 30);
        ctx.stroke();
        this.selected = false;
    }

    highlight() {
        ctx.fillStyle = "yellow";
        var box = this.box();
        ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    }
}


class SmartFighter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.goalX = x;
        this.goalY = y;
        this.angle = Math.PI / 2;
        this.selected = false;
        this.xv = 0;
        this.yv = 0;
        this.goalAngle = 0;
        this.shootCycle = 0;
        this.turretAngle = 0;
        this.turretGoal = 0;
        this.shootCycle = 0;
    }

    destroy() {
        this.rm = true;
        score -= 30;
    }

    box() {
        return [this.x - 20, this.y - 20, this.x + 20, this.y + 20];
    }

    loop() {
        if ((this.x != this.goalX) || (this.y != this.goalY)) {
            this.angle = Math.atan((this.y - this.goalY) / (this.x - this.goalX));
            if (this.x >= this.goalX) {
                this.angle += Math.PI;
            }
        }
        if (Math.abs(this.x - this.goalX) > 10 || Math.abs(this.y - this.goalY) > 10) {
            this.xv += Math.cos(this.angle) * 0.2;
            this.yv += Math.sin(this.angle) * 0.2;
        }
        this.xv *= 0.9;
        this.yv *= 0.9;
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        this.shootCycle--;
        if (this.shootCycle < 0) {
            this.shoot();
            this.shootCycle = 30;
        }
        var nearestVal = Infinity;
        var nearestDX = 0;
        var nearestDY = 0;
        enemies.forEach(enemy => {
            var dX = enemy.x - this.x;
            var dY = enemy.y - this.y;
            var distance = dX * dX + dY * dY;
            distance -= (Math.atan2(dY, dX) - this.goalAngle) * 100; // weight based on how close to the goal angle enemy ships are
            if (distance > 300) {
                return;
            }
            if (distance < nearestVal) {
                nearestVal = distance;
                nearestDX = dX;
                nearestDY = dY;
            }
        });
        this.turretGoal = Math.atan2(nearestDY, nearestDX);
        this.turretAngle -= (this.turretAngle - this.turretGoal) * 0.05;
        this.shootCycle--;
        if (this.shootCycle < 0) {
            this.shootCycle = 30;
            this.shoot(this.turretAngle);
        }
    }

    shoot(angle) {
        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 10, Math.sin(angle) * 10));
    }

    draw() {
        if (this.selected) {
            ctx.fillStyle = "yellow";
        }
        else {
            ctx.fillStyle = "#4455AA";
        }
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillRect(-50, -2, 50, 4);

        ctx.lineWidth = 1;
        ctx.strokeStyle = "white";
        ctx.beginPath();
        ctx.moveTo(-40, -5);
        ctx.lineTo(-10, -5);
        ctx.moveTo(-40, 5);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, 20);
        ctx.lineTo(10, 0);
        ctx.fill();

        ctx.rotate(-this.angle);


        ctx.translate(-this.x, -this.y);
        ctx.fillStyle = "purple";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.goalX, this.goalY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.goalX, this.goalY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.moveTo(this.goalX, this.goalY);
        ctx.lineTo(this.goalX + Math.cos(this.goalAngle) * 30, this.goalY + Math.sin(this.goalAngle) * 30);
        ctx.stroke();
        this.selected = false;
    }

    highlight() {
        ctx.fillStyle = "yellow";
        var box = this.box();
        ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    }
}


class FourShooter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.goalX = x;
        this.goalY = y;
        this.angle = Math.PI / 2;
        this.selected = false;
        this.xv = 0;
        this.yv = 0;
        this.goalAngle = 0;
        this.shootCycle = 0;
    }

    destroy() {
        this.rm = true;
        score -= 30;
    }

    box() {
        return [this.x - 20, this.y - 20, this.x + 20, this.y + 20];
    }

    loop() {
        if ((this.x != this.goalX) || (this.y != this.goalY)) {
            this.angle = Math.atan((this.y - this.goalY) / (this.x - this.goalX));
            if (this.x >= this.goalX) {
                this.angle += Math.PI;
            }
        }
        if (Math.abs(this.x - this.goalX) > 10 || Math.abs(this.y - this.goalY) > 10) {
            this.xv += Math.cos(this.angle) * 0.1;
            this.yv += Math.sin(this.angle) * 0.1;
        }
        else {
            //const factor = 0.5;
            this.angle = this.goalAngle;//this.angle = this.angle * factor + this.goalAngle * (1 - factor);
        }
        this.xv *= 0.95;
        this.yv *= 0.95;
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, gameSize);
        this.y = coterminal(this.y, gameSize);
        this.shootCycle--;
        if (this.shootCycle < 0) {
            this.shoot();
            this.shootCycle = 30;
        }
    }

    _shoot(angle) {
        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 10, Math.sin(angle) * 10));
    }

    shoot() {
        this._shoot(this.angle);
        this._shoot(this.angle + Math.PI / 2);
        this._shoot(this.angle + Math.PI);
        this._shoot(this.angle + Math.PI * 3 / 2);
    }

    draw() {
        if (this.selected) {
            ctx.fillStyle = "yellow";
        }
        else {
            ctx.fillStyle = "grey";
        }
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 20);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(0, -20);
        ctx.lineTo(6, -6);
        ctx.fill();
        ctx.rotate(-this.angle);


        ctx.translate(-this.x, -this.y);
        ctx.fillStyle = "purple";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.goalX, this.goalY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.goalX, this.goalY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.moveTo(this.goalX, this.goalY);
        ctx.lineTo(this.goalX + Math.cos(this.goalAngle) * 30, this.goalY + Math.sin(this.goalAngle) * 30);
        ctx.stroke();
        this.selected = false;
    }

    highlight() {
        ctx.fillStyle = "yellow";
        var box = this.box();
        ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    }
}


var enemies = [];
var fighters = [];
var bullets = [];
var blocks = [];

var isStratChange = true;

var mousePos = {
    realX: 0,
    realY: 0,
    gameX: 0,
    gameY: 0
};

var hovered = -1;
var selected = -1;
var isAngleAdjust = false;

window.addEventListener("mousemove", (evt) => {
    mousePos.realX = evt.clientX;
    mousePos.realY = evt.clientY;
    var gameBox = canvas.getBoundingClientRect();
    mousePos.gameX = mousePos.realX - gameBox.left;
    mousePos.gameY = mousePos.realY - gameBox.top;
});

var countdown = 0;
var inventory = false;
var inventoryHovered = -1;
var inventorySelected = -1;


wallsCount = 2;

var toPlaceBlocks = 0;
var didPlace = true;

var inventoryStuff = [
    {
        type: Fighter,
        name: "Fighter",
        maxCount: 6,
        cost: 20
    },
    {
        type: TieFighter,
        name: "Tie Fighter",
        maxCount: 4,
        cost: 40
    },
    {
        type: SmartFighter,
        name: "Smart Fighter",
        maxCount: 2,
        cost: 60
    },
    {
        type: FourShooter,
        name: "Four Shooter",
        maxCount: 2,
        cost: 100
    },
    {
        type: ExtraWalls,
        name: "Extra Walls",
        maxCount: 1,
        cost: 30
    }
];

function countFightersOfType(type) {
    var count = 0;
    fighters.forEach(fighter => {
        if (fighter.constructor == type) {
            count++;
        }
    });
    return count;
}

var enemyTypes = [EnemyShip, EnemyCruiser, Ghost, PasserEnemy, Burster];
var probabilities = [1, 0, 0, 0, 0];

function chooseEnemyType() {
    var total = 0;
    for (var i = 0; i < probabilities.length; i++){
        total += probabilities[i];
    }
    console.log(total);
    var threshold = Math.random() * total;
    var soFar = 0;
    var pick = undefined;
    for (var i = 0; i < enemyTypes.length; i++){
        if (soFar < threshold) {
            pick = enemyTypes[i];
        }
        soFar += probabilities[i];
    }
    return pick;
}

function bumpProbabilities() {
    for (var i = 1; i < probabilities.length; i++){
        probabilities[i] += probabilities[i - 1] * 0.2;
        if (probabilities[i] > 1) {
            probabilities[i] = 1;
        }
    }
}

var gameSize = 800; // default value
var castle = undefined;

var difficulty = 0;
/* The difficulty calculation:
Add based on the size:
    If on small size, 10
    If on medium size, 6
    If on big size, 4
    If on huge size, 2
    If on massive size, 0

For each fixed bullet per round (1 per regular fighter, 2 per tie fighter, 4 per four-shooter), subtract 1
For each Smart Fighter, subtract 3

Thus, default quad-fighter at default size is 6 - 4 = 2.
the lowest possible difficulty is 0 (massive) - 8 (most OP starting arrangement), -8
the highest possible difficulty is 10 - 2 (least OP starting arrangement), 8
thus, divide difficulty by 8

To calculate corrected score:
difficulty -= 2 // normalize for the average difficulty
difficulty /= 8 // convert it to a percentage
difficulty *= 0.5 // don't let difficulty changes affect the score more than halfway
difficulty += 1 // make it so a 0 corrected difficulty has no impact on the score
score = score * difficulty
*/

function correctScore(score) {
    var correctedD = difficulty;
    correctedD -= 2;
    correctedD /= 8;
    correctedD *= 0.5;
    correctedD += 1;
    return score * correctedD;
}

function startGame() {
    switch (document.getElementById("size").value) {
        case "medium":
            gameSize = 800;
            difficulty += 6;
            break;
        case "small":
            gameSize = 500;
            difficulty += 10
            break;
        case "big":
            gameSize = 1000;
            difficulty += 4
            break;
        case "huge":
            gameSize = 1400;
            difficulty += 2
            break;
        case "massive":
            gameSize = 2000;
            break;
    }
    canvas.width = gameSize;
    canvas.height = gameSize;
    castle = new Castle(gameSize/2, gameSize/2);
    switch (document.getElementById("formation").value) {
        case "quad":
            fighters.push(new Fighter(gameSize/2 + 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2, gameSize/2 + 200));
            fighters.push(new Fighter(gameSize/2 - 200, gameSize/2));
            fighters.push(new Fighter(gameSize / 2, gameSize / 2 - 200));
            break;
        case "hex":
            fighters.push(new Fighter(gameSize/2 + 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2 - 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2 - 100, gameSize/2 + 150));
            fighters.push(new Fighter(gameSize/2 + 100, gameSize/2 + 150));
            fighters.push(new Fighter(gameSize/2 - 100, gameSize/2 - 150));
            fighters.push(new Fighter(gameSize / 2 + 100, gameSize / 2 - 150));
            break;
        case "defendedHex":
            fighters.push(new Fighter(gameSize/2 + 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2 - 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2 - 100, gameSize/2 + 150));
            fighters.push(new Fighter(gameSize/2 + 100, gameSize/2 + 150));
            fighters.push(new Fighter(gameSize/2 - 100, gameSize/2 - 150));
            fighters.push(new Fighter(gameSize / 2 + 100, gameSize / 2 - 150));
            fighters.push(new TieFighter(gameSize / 2, gameSize / 2));
        case "qplust":
            fighters.push(new Fighter(gameSize/2 + 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2, gameSize/2 + 200));
            fighters.push(new Fighter(gameSize/2 - 200, gameSize/2));
            fighters.push(new Fighter(gameSize/2, gameSize/2 - 200));
            fighters.push(new TieFighter(gameSize / 2, gameSize / 2));
            break;
        case "twof":
            fighters.push(new Fighter(gameSize/2 + 200, gameSize/2));
            fighters.push(new Fighter(gameSize / 2 - 200, gameSize / 2));
            break;
        case "tiefighter":
            fighters.push(new TieFighter(gameSize / 2, gameSize / 2));
            break;
    }
    fighters.forEach(item => {
        switch (item.constructor) {
            case Fighter:
                difficulty -= 1;
                break;
            case TieFighter:
                difficulty -= 2;
                break;
            case FourShooter:
                difficulty -= 4;
                break;
            case SmartFighter:
                difficulty -= 3;
        }
    });
    document.getElementById("startGameScreen").style.display = "none";
    window.addEventListener("keyup", evt => {
        if (!inventory) {
            if (evt.key == "Enter") {
                if (isStratChange) {
                    isStratChange = false;
                    countdown = 240;
                }
            }
            if (evt.key == " ") {
                toPlaceBlocks--;
            }
        }
        else {
            if (evt.key == "Enter") {
                if (inventorySelected != -1) {
                    if (score >= inventoryStuff[inventorySelected].cost) {
                        fighters.push(new inventoryStuff[inventorySelected].type(Math.random() * 700 + 50, Math.random() * 700 + 50));
                        score -= inventoryStuff[inventorySelected].cost;
                    }
                    inventorySelected = -1;
                }
            }
        }
        if (evt.key == "i") {
            if (isStratChange) {
                inventory = !inventory;
            }
        }
    });

    window.addEventListener("mouseup", (evt) => {
        if (inventory) {
            if (inventorySelected == -1) {
                inventorySelected = inventoryHovered;
            }
            else {
                inventorySelected = -1;
            }
        }
        else {
            if (toPlaceBlocks > 0 && isStratChange) {
                blocks.push(new Block(mousePos.gameX - 15, mousePos.gameY - 15, 30, 30));
                toPlaceBlocks--;
            }
            else {
                if (selected != -1 && !isAngleAdjust) {
                    isAngleAdjust = true;
                }
                else {
                    selected = hovered;
                    isAngleAdjust = false;
                }
            }
        }
    });
    setInterval(() => {
        ctx.fillStyle = "lightblue";
        ctx.fillRect(0, 0, gameSize, gameSize);
        if (inventory) {
            ctx.fillStyle = "red";
            ctx.font = "bold 40px monospace";
            if (gameSize < 800) {
                ctx.font = "bold 25px monospace";
            }
            ctx.textAlign = "center";
            ctx.fillText("BUY STUFF AND PRESS 'i' WHEN DONE", gameSize / 2, 50);
            fitSize = Math.floor(gameSize / 160);
            if (inventorySelected == -1) {
                inventoryHovered = -1;
                inventoryStuff.forEach((type, i) => {
                    var x = (i % fitSize) * 160;
                    var y = 100 + Math.floor(i / fitSize) * 160;
                    var thingOccurences = countFightersOfType(type.type);
                    ctx.font = "18px sans-serif";
                    ctx.fillStyle = "black";
                    ctx.textAlign = "center";
                    ctx.fillText(type.name, x + 80, y + 40);
                    (new type.type(x + 80, y + 110)).draw();
                    ctx.font = "18px sans-serif";
                    ctx.fillStyle = "purple";
                    ctx.textAlign = "center";
                    ctx.fillText(thingOccurences + "/" + type.maxCount, x + 80, y + 145);
                    if (thingOccurences < type.maxCount) {
                        if (mousePos.gameX > x && mousePos.gameX < x + 160 && mousePos.gameY > y && mousePos.gameY < y + 120) {
                            inventoryHovered = i;
                            ctx.strokeStyle = "yellow";
                            ctx.strokeRect(x, y, 160, 160);
                        }
                    }
                });
            }
            else {
                (new inventoryStuff[inventorySelected].type(gameSize/2, gameSize/2)).draw();
                ctx.font = "18px sans-serif";
                ctx.fillStyle = "purple";
                ctx.textAlign = "center";
                ctx.fillText("Cost: " + inventoryStuff[inventorySelected].cost, gameSize/2, gameSize/2 + 100);
                if (score >= inventoryStuff[inventorySelected].cost) {
                    ctx.fillText("Press enter to buy, or click anywhere to exit.", gameSize/2, gameSize/2 + 200);
                }
                else {
                    ctx.fillText("You can't afford it! Press enter to exit.", gameSize/2, gameSize/2 + 200);
                }
            }
            return;
        }
        countdown--;
        if (countdown < 0) {
            isStratChange = true;
            if (!didPlace && toPlaceBlocks <= 0) {
                toPlaceBlocks = wallsCount;
                didPlace = true;
                bumpProbabilities();
            }
        }

        ctx.fillStyle = "black";
        ctx.fillRect(mousePos.gameX - 5, mousePos.gameY - 5, 10, 10);

        ctx.font = "16px monospace";
        ctx.textAlign = "left";
        ctx.fillText("" + correctScore(score), 10, 18);

        if (isStratChange) {
            if (toPlaceBlocks <= 0) {
                ctx.fillStyle = "red";
                ctx.font = "bold 40px monospace";
                if (gameSize < 800) {
                    ctx.font = "bold 25px monospace";
                }
                ctx.textAlign = "center";
                ctx.fillText("MOVE YOUR SHIPS AND PRESS ENTER", gameSize/2, 50);
                hovered = -1;
                fighters.forEach((fighter, index) => {
                    var box = untwist(fighter.box());
                    if (mousePos.gameX > box[0] && mousePos.gameX < box[2] && mousePos.gameY > box[1] && mousePos.gameY < box[3]) {
                        fighter.highlight();
                        hovered = index;
                    }
                });
            }
            else {
                ctx.fillStyle = "red";
                ctx.font = "bold 40px monospace";
                if (gameSize < 800) {
                    ctx.font = "bold 25px monospace";
                }
                ctx.textAlign = "center";
                ctx.fillText("PLACE " + toPlaceBlocks + " WALLS", gameSize/2, 50);
            }
        }
        else {
            didPlace = false;
            var eType = chooseEnemyType();
            number = 1;
            for (var x = 0; x < number; x++) {
                if (Math.random() < 0.01) {
                    var coords = [Math.random() * gameSize, Math.random() * gameSize];
                    coords = clampToEdge(coords);
                    var newEnemy = new eType(coords[0], coords[1], castle);
                    newEnemy.angle = Math.random() * Math.PI * 2;
                    enemies.push(newEnemy);
                }
            }
            enemies.forEach((enemy, index) => {
                enemy.loop();
                if (enemy.rm) {
                    enemies.splice(index, 1);
                }
                if (!enemy.dontHitShips) {
                    fighters.forEach(fighter => {
                        if (collision(fighter, enemy)) {
                            fighter.destroy();
                            enemy.destroy();
                        }
                    });
                }
                bullets.forEach(bullet => {
                    if (collision(bullet, enemy)) {
                        bullet.destroy();
                        enemy.destroy();
                    }
                });
                if (!enemy.dontHitWalls) {
                    blocks.forEach(block => {
                        if (collision(block, enemy)) {
                            block.destroy();
                            enemy.destroy(false);
                        }
                    });
                }
            });

            fighters.forEach((fighter, index) => {
                fighter.loop();
                if (fighter.rm) {
                    fighters.splice(index, 1);
                }
            });

            bullets.forEach((bullet, index) => {
                bullet.loop();
                if (bullet.rm) {
                    bullets.splice(index, 1);
                }
            });

            blocks.forEach((block, index) => {
                block.loop();
                if (block.rm) {
                    blocks.splice(index, 1);
                }
            });
        }

        enemies.forEach((enemy) => {
            enemy.draw();
        });

        bullets.forEach((bullet) => {
            bullet.draw();
        });

        blocks.forEach((block) => {
            block.draw();
        });

        fighters.forEach((fighter, index) => {
            if (index == selected) {
                if (isAngleAdjust) {
                    fighter.goalAngle = Math.atan((fighter.goalY - mousePos.gameY) / (fighter.goalX - mousePos.gameX));
                    if (fighter.goalX >= mousePos.gameX) {
                        fighter.goalAngle += Math.PI;
                    }
                    ctx.lineWidth = 10;
                    ctx.strokeStyle = "red";
                    ctx.beginPath();
                    ctx.moveTo(fighter.goalX, fighter.goalY);
                    ctx.lineTo(fighter.goalX + Math.cos(fighter.goalAngle) * 50, fighter.goalY + Math.sin(fighter.goalAngle) * 50);
                    ctx.stroke();
                }
                else {
                    fighter.selected = true;
                    fighter.goalX = mousePos.gameX;
                    fighter.goalY = mousePos.gameY;
                }
            }
            fighter.draw();
        });
        castle.draw();
    }, 1000 / FPS);
}