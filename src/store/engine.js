import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { derived, get, writable } from 'svelte/store';
import {setupNormalMatrix} from './gl.js';

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
  return a * degree;
}
function createRenderer(){
    
    const {subscribe, set, update} = writable({
        init:initRenderer,
        backgroundColor: [2.55,2.55,2.55,1],
        canvas: null,
        camera: null,
        worldMatrix: null,
        meshes: [],
        lights: [],
        loop: null,
    });
    return {
        subscribe,
        setCamera: (fov,near,far,position,target,up) => update(renderer => {
            renderer.camera = {
                fov,
                near,
                far,
                position,
                target,
                up,
            };
            return renderer;
        }),
        addMesh: (mesh) => update(renderer => {
            renderer.meshes = [...renderer.meshes, mesh];
            return renderer;
        }),
        addLight: (light) => update(renderer => {
            renderer.lights = [...renderer.lights, light];
            return renderer;
        }),
        setLoop: (loop) => update(renderer => {
            renderer.loop = loop;
            return renderer;
        }),
        setWorldMAtrix: (worldMatrix) => update(renderer => {
            renderer.worldMatrix = worldMatrix;
            return renderer;
        }),
        setCanvas: (canvas) => update(renderer => {
            renderer.canvas = canvas;
            return renderer;
        }),
        setBackgroundColor: (backgroundColor) => update(renderer => {
            renderer.backgroundColor = backgroundColor;
            return renderer;
        }),
    };
}
export const renderer = createRenderer();

export const programs = derived(renderer,$renderer => {
    return $renderer.meshes.map(mesh => {
        return {
            createProgram,
            mesh,
            material:mesh.material,
            attributes:mesh.attributes,
            createShaders:createShaders(mesh.material,mesh.attributes),
            endProgramSetup,
        }
    });
});

function createRenderState () {
    const {subscribe,set} = writable({
        init:false,
        rendered:false,
    });
    return {
        subscribe,
        set,
    };
}
const renderState = createRenderState();

function createContextStore () {
    const {subscribe,set} = writable({});
    return {
        subscribe,
        set: (context) => {
            set(context)
        },
    };
}

export const contextStore = createContextStore();

export const webglapp = derived([renderer,programs], ([$renderer,$programs]) => {
    let context = {
        canvas: $renderer.canvas,
        backgroundColor: $renderer.backgroundColor,
    };

    if(
        !$renderer ||
        !$programs ||
        !$renderer.canvas ||
        $programs.length === 0 ||
        !$renderer.camera ||
        !$renderer.lights
    ){
        console.log("no renderer or programs or canvas");
        return[];
    }
    console.log("$renderState",renderState);
    const initInstructions = renderState.init ? [] : [$renderer.init(context)];

    const setupInstructions = renderState.rendered ? [] : $programs.reduce((acc,program) => {
        return [
            ...acc,
            program.createProgram(contextStore),
            program.createShaders(contextStore),
            program.endProgramSetup(contextStore),
            setupCamera(contextStore,$renderer.camera),
            setupWorldMatrix(contextStore,$renderer.worldMatrix),
            setupNormalMatrix(contextStore),
            setupAttributes(contextStore,program.mesh),
            setupLights(contextStore,$renderer.lights),
        ];
    },[]);
    renderState.set({
        init:true,
        rendered:true,
    });
    const list = [
        ...initInstructions,
        ...setupInstructions,
        render(contextStore),
    ];
    //list.forEach(fn => console.log(fn.toString()));
    return list;
});

export function initRenderer(context) {
    return function () {

        const canvasRect = context.canvas.getBoundingClientRect();
        context.canvas.width = canvasRect.width;
        context.canvas.height = canvasRect.height;
        const gl = context.gl = context.canvas.getContext("webgl");
        contextStore.set(context);
        gl.viewportWidth = context.canvas.width;
        gl.viewportHeight = context.canvas.height;
        gl.clearColor.apply(gl, context.backgroundColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);
    };
}

export function render(context) {
    return function () {
        context = get(context);
        const gl = context.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        context.loop && context.loop();
        if (context.hasElements) {
            gl.drawElements(gl.TRIANGLES, context.attributeLength, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, context.attributeLength);
        }
    };
}
export function createProgram(context) {
    return function createProgram() {
        context = get(context);
        const gl = context.gl;
        const program = gl.createProgram();
        context.program = program;
    };
}
export function endProgramSetup(context) {
    return function () {
        context = get(context);
        const gl = context.gl;
        const program = context.program;
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('ERROR linking program!', gl.getProgramInfoLog(program));
        }
        gl.validateProgram(program);
        if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
            console.error('ERROR validating program!', gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
    };
}
export function setupCamera(context, camera) {
    return function createCamera() {
        context = get(context);
        const gl = context.gl;
        const program = context.program;

        // projection matrix
        const projectionLocation = gl.getUniformLocation(program, "projection");

        const fieldOfViewInRadians = toRadian(camera.fov);
        const aspectRatio = context.canvas.width / context.canvas.height;
        const nearClippingPlaneDistance = camera.near;
        const farClippingPlaneDistance = camera.far;

        let projection = new Float32Array(16);
        projection = perspective(
            projection,
            fieldOfViewInRadians,
            aspectRatio,
            nearClippingPlaneDistance,
            farClippingPlaneDistance
        );

        gl.uniformMatrix4fv(projectionLocation, false, projection);


        // view matrix
        const viewLocation = gl.getUniformLocation(program, "view");
        const view = new Float32Array(16);

        lookAt(view, camera.position, camera.target, camera.up);
        gl.uniformMatrix4fv(viewLocation, false, view);
    };
}
export function createShaders(material, attributes) {
    return function (context) {
        return function () {
            context = get(context);
            const gl = context.gl;
            const program = context.program;
            const vertexShaderSource = `precision mediump float;
    
attribute vec3 position;
attribute vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 normalMatrix;

// Pass the color attribute down to the fragment shader
varying vec3 fragColor;
varying vec3 vNormal;
varying vec3 vertex;

void main() {
    

    // Pass the color down to the fragment shader
    fragColor = vec3(2.55,2.55,2.55);
    // Pass the vertex down to the fragment shader
    vertex = vec3(world * vec4(position, 1.0));
    // Pass the normal down to the fragment shader
    vNormal = vec3(normalMatrix * vec4(normal, 1.0));
    //vNormal = normal;
    
    // Pass the position down to the fragment shader
    gl_Position = projection * view * world * vec4(position, 1.0);
}`;
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, vertexShaderSource);
            gl.compileShader(vertexShader);
            const fragmentShaderSource = `precision mediump float;

uniform vec3 lightPosition;

varying vec3 vertex;
varying vec3 vNormal;    
varying vec3 fragColor;


void main() {
    //vec3 offset = lightPosition - vertex;
    vec3 offset = vec3(0.0,7.0,-3.0) - vertex;
    float distance = length(offset);
    vec3 direction = normalize(offset);

    float diffuse = max(dot(direction, vNormal), 0.0);
    float attenuation = 3.0 / (1.0 + 0.1*distance + 0.1*distance*distance);
    float brightness = max(diffuse * attenuation,0.1);
    gl_FragColor = vec4(brightness*fragColor,1.0);
}`;
            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, fragmentShaderSource);
            gl.compileShader(fragmentShader);
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
        };
    };
}
export function setupLights(context, lights) {
    return function () {
        context = get(context);
        const gl = context.gl;
        const program = context.program;
        const lightPositionLocation = gl.getUniformLocation(program, "lightPosition");
        gl.uniform3fv(lightPositionLocation, new Float32Array(lights[0]));
    };
}
export function setupWorldMatrix(context, worldMatrix) {
    return function () {
        context = get(context);
        const gl = context.gl;
        const program = context.program;
        if (!worldMatrix) {
            worldMatrix = new Float32Array(16);
            identity(worldMatrix);
        }
        context.worldMatrix = worldMatrix;
        const worldLocation = gl.getUniformLocation(program, "world");
        gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
    };
}
export function setupAttributes(context, mesh) {
    return function () {
        context = get(context);
        const gl = context.gl;
        const program = context.program;
        context.attributeLength = mesh.attributes.elements ? mesh.attributes.elements.length : mesh.attributes.positions.length / 3;

        const positionsData = new Float32Array(mesh.attributes.positions);
        //position
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
        const positionLocation = gl.getAttribLocation(program, "position");
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);
        //normal
        const normalsData = new Float32Array(mesh.attributes.normals);
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
        const normalLocation = gl.getAttribLocation(program, "normal");
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalLocation);
        if (mesh.attributes.elements) {
            
            context.hasElements = true;
            const elementsData = new Uint16Array(mesh.attributes.elements);
            const elementBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
        }

    };
}
