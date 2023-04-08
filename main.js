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
        alert("Game over! Your score: " + score);
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
    var distX = Math.min(coords[0], 800 - coords[0]); // distance to the nearest edge on the x axis
    var distY = Math.min(coords[1], 800 - coords[1]); // ditto, but for y
    if (distX > distY) {
        coords[0] = Math.round(coords[0] / 800) * 800;
    }
    else if (distY > distX) {
        coords[1] = Math.round(coords[1] / 800) * 800;
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
    }

    box() {
        return [this.x - 5, this.y - 5, this.x + 5, this.y + 5];
    }

    loop() {
        this.anGOAL = Math.atan((this.y - this.target.y) / (this.x - this.target.x));
        if ((this.x - this.target.x) > 0) {
            this.anGOAL += Math.PI;
        }
        this.angle += loopize(this.anGOAL, this.angle) * 0.07;
        this.xv += Math.cos(this.angle) * 0.03;
        this.yv += Math.sin(this.angle) * 0.03;
        this.x += this.xv;
        this.y += this.yv;
        this.x = coterminal(this.x, 800);
        this.y = coterminal(this.y, 800);
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
    }

    destroy() {
        this.rm = true;
    }
};


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
            if (this.x > this.goalX) {
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
        this.x = coterminal(this.x, 800);
        this.y = coterminal(this.y, 800);
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


var castle = new Castle(400, 400);
var enemies = [];
var fighters = [];
var bullets = [];
var blocks = [];

fighters.push(new Fighter(600, 400));
fighters.push(new Fighter(400, 600));
fighters.push(new Fighter(200, 400));
fighters.push(new Fighter(400, 200));

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

var toPlaceBlocks = 0;
var didPlace = true;

var inventoryStuff = [
    {
        type: Fighter,
        name: "Fighter",
        maxCount: 4,
        cost: 20
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

setInterval(() => {
    ctx.fillStyle = "lightblue";
    ctx.fillRect(0, 0, 800, 800);
    if (inventory) {
        ctx.fillStyle = "red";  
        ctx.font = "bold 40px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BUY STUFF AND PRESS 'i' WHEN DONE", 400, 50);
        if (inventorySelected == -1) {
            inventoryStuff.forEach((type, i) => {
                var x = (i % 5) * 160;
                var y = 100 + Math.floor(i / 5) * 160;
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
                inventoryHovered = -1;
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
            (new inventoryStuff[inventorySelected].type(400, 400)).draw();
            ctx.font = "18px sans-serif";
            ctx.fillStyle = "purple";
            ctx.textAlign = "center";
            ctx.fillText("Cost: " + inventoryStuff[inventorySelected].cost, 400, 500);
            if (score >= inventoryStuff[inventorySelected].cost) {
                ctx.fillText("Press enter to buy, or click anywhere to exit.", 400, 600);
            }
            else {
                ctx.fillText("Insufficient score to buy! Press enter or click anywhere to exit.", 400, 600);
            }
        }
        return;
    }
    countdown--;
    if (countdown < 0) {
        isStratChange = true;
        if (!didPlace && toPlaceBlocks <= 0) {
            toPlaceBlocks = 2;
            didPlace = true;
        }
    }

    ctx.fillStyle = "black";
    ctx.fillRect(mousePos.gameX - 5, mousePos.gameY - 5, 10, 10);

    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("" + score, 10, 18);

    if (isStratChange) {
        if (toPlaceBlocks <= 0) {
            ctx.fillStyle = "red";
            ctx.font = "bold 40px monospace";
            ctx.textAlign = "center";
            ctx.fillText("MOVE YOUR SHIPS AND PRESS ENTER", 400, 50);
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
            ctx.textAlign = "center";
            ctx.fillText("PLACE " + toPlaceBlocks + " WALLS", 400, 50);
        }
    }
    else {
        didPlace = false;
        if (Math.random() < 0.01) {
            var coords = [Math.random() * 800, Math.random() * 800];
            coords = clampToEdge(coords);
            var newEnemy = new EnemyShip(coords[0], coords[1], castle);
            newEnemy.angle = Math.random() * Math.PI * 2;
            enemies.push(newEnemy);
        }
        enemies.forEach((enemy, index) => {
            enemy.loop();
            if (enemy.rm) {
                enemies.splice(index, 1);
            }
            fighters.forEach(fighter => {
                if (collision(fighter, enemy)) {
                    fighter.destroy();
                    enemy.destroy();
                }
            });
            bullets.forEach(bullet => {
                if (collision(bullet, enemy)) {
                    bullet.destroy();
                    enemy.destroy();
                }
            });
            blocks.forEach(block => {
                if (collision(block, enemy)) {
                    block.destroy();
                    enemy.destroy(false);
                }
            });
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
}, 1000/FPS);