const NUM_METABALLS = 100;

function prerenderBackground(size) {
    var canvas = document.getElementById("background");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var gl = canvas.getContext("webgl");
    function compileShader(shaderSource, shaderType) {
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert("YOUR MOM IS A POOP POOP");
        }
        return shader;
    }
    function getAttribLocation(program, name) {
        var attributeLocation = gl.getAttribLocation(program, name);
        if (attributeLocation === -1) {
            throw 'Can not find attribute ' + name + '.';
        }
        return attributeLocation;
    }
    function getUniformLocation(program, name) {
        var uniformLocation = gl.getUniformLocation(program, name);
        if (uniformLocation === -1) {
            throw 'Can not find uniform ' + name + '.';
        }
        return uniformLocation;
    }
    var vertex = compileShader(`
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
    `, gl.VERTEX_SHADER);
    var fragment = compileShader(`
    precision highp float;
    uniform vec3 balls[` + NUM_METABALLS + `];
    uniform vec2 offset;
    void main(){
        const float BANDCOUNT = 4.0;
        float total = 0.0;
        for (int i = 0; i < ` + NUM_METABALLS + `; i ++) {
            float dx = balls[i].x + offset.x - gl_FragCoord.x;
            float dy = balls[i].y + offset.y - gl_FragCoord.y;
            float r = balls[i].z;
            total += (r * r) / (dx * dx + dy * dy);
        }
        gl_FragColor = vec4(floor(total * BANDCOUNT)/BANDCOUNT, 0.0, 0.0, 1.0);
    }
    `, gl.FRAGMENT_SHADER);/*
    var error_log = gl.getShaderInfoLog(fragment);
    console.log(error_log);*/

    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    var texture = new Float32Array([ // shamelessly copypasted
        -1.0,  1.0, // top left
        -1.0, -1.0, // bottom left
        1.0,  1.0, // top right
        1.0, -1.0, // bottom right
    ]);

    var offset = new Float32Array([
        0.0, 0.0
    ]);

    var leBalls = [];
    for (var x = 0; x < NUM_METABALLS; x++) {
        leBalls.push({
            x: Math.random() * size,
            y: Math.random() * size,
            r: Math.random() * 100,
            xv: (Math.random() - 0.5) * 2,
            yv: (Math.random() - 0.5) * 2
        });
    }
    var ballsHandle = getUniformLocation(program, 'balls');
    var offsetHandle = getUniformLocation(program, "offset");
    var toGPU = new Float32Array(3 * NUM_METABALLS);

    function updateBalls() {
        leBalls.forEach((ball, index) => {
            toGPU[index * 3] = ball.x;
            toGPU[index * 3 + 1] = ball.y;
            toGPU[index * 3 + 2] = ball.r;
        });
        gl.uniform3fv(ballsHandle, toGPU);
    }

    function main(x, y) {
        offset[0] = -x;
        offset[1] = y;
        gl.uniform2fv(offsetHandle, offset);
        leBalls.forEach(ball => {
            ball.x += ball.xv;
            ball.y += ball.yv;
            if (ball.x > size) {
                ball.x = size;
                ball.xv *= -1;
            }
            if (ball.x < 0) {
                ball.x = 0;
                ball.xv *= -1;
            }
            if (ball.y > window.innerHeight) {
                ball.y = window.innerHeight;
                ball.yv *= -1;
            }
            if (ball.y < -size + window.innerHeight) {
                ball.y = -size + window.innerHeight;
                ball.yv *= -1;
            }
        });
        updateBalls();

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var textureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texture, gl.STATIC_DRAW);

    var positionHandle = getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionHandle);
    gl.vertexAttribPointer(positionHandle, 2, gl.FLOAT, gl.FALSE, 2 * 4, 0);
    return main;
}