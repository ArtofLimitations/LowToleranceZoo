// Vertex shader source
const vertexShaderSrc = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
    }
`;

// Fragment shader source
const fragmentShaderSrc = `
    precision mediump float;

    uniform sampler2D u_texture;
    varying vec2 v_texCoord;

    // Bicubic interpolation kernel
    float cubic(float v) {
        v = abs(v);
        if (v <= 1.0) {
            return 1.0 - 2.0 * v * v + v * v * v;
        } else if (v <= 2.0) {
            return 4.0 - 8.0 * v + 5.0 * v * v - v * v * v;
        } else {
            return 0.0;
        }
    }

    vec4 textureBicubic(sampler2D tex, vec2 texCoord) {
        vec2 texSize = vec2(textureSize(tex, 0));
        vec2 texelSize = 1.0 / texSize;
        vec2 coord = texCoord * texSize - 0.5;
        vec2 iCoord = floor(coord);
        vec2 fCoord = fract(coord);
        vec4 color = vec4(0.0);

        for (int i = -1; i <= 2; i++) {
            for (int j = -1; j <= 2; j++) {
                vec2 offset = vec2(float(i), float(j));
                vec2 sampleCoord = (iCoord + offset) * texelSize;
                vec4 sample = texture2D(tex, sampleCoord);
                color += sample * cubic(fCoord.x - float(i)) * cubic(fCoord.y - float(j));
            }
        }
        return color;
    }

    void main() {
        gl_FragColor = textureBicubic(u_texture, v_texCoord);
    }
`;


function createShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

export function main() {
    const lowToleranceCanvas = document.getElementById('lowToleranceCanvas');
    if (!lowToleranceCanvas) {
        console.error('Canvas with id "lowToleranceCanvas" not found.');
        return;
    }

    const glCanvas = document.createElement('canvas');
    //glCanvas.width = 1474;
    glCanvas.width = 1874;
    glCanvas.height = 1000;
    document.body.appendChild(glCanvas);
    const gl = glCanvas.getContext('webgl');

    const vertexShader = createShader(gl, vertexShaderSrc, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fragmentShaderSrc, gl.FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    const textureLocation = gl.getUniformLocation(program, 'u_texture');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,   1, -1,  -1, 1,
         1, -1,   1,  1,  -1, 1,
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1,   1, 1,  0, 0,
        1, 1,   1, 0,  0, 0,
    ]), gl.STATIC_DRAW);

    /*const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lowToleranceCanvas);
    */
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Set the texture wrapping to clamp to the edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Set the texture filtering to LINEAR for smoothing (bilinear interpolation)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Upload the texture image from the canvas
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lowToleranceCanvas);
    

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

main();
