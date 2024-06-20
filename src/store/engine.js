import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { derived, get, writable } from 'svelte/store';
import {setupNormalMatrix, initRenderer, createProgram, endProgramSetup, createShaders, setupCamera, render,setupLights, setupWorldMatrix, setupAttributes, updateWorldMatrix} from './gl.js';


function createRenderer(){
    
    const {subscribe, set, update} = writable({
        initRenderer,
        backgroundColor: [2.55,2.55,2.55,1],
        canvas: null,
        camera: null,
        //worldMatrix: null,
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
        /*setWorldMAtrix: (worldMatrix) => update(renderer => {
            renderer.worldMatrix = worldMatrix;
            return renderer;
        }),*/
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
const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);
const createWorldMatrix = () => {
    const {subscribe, set} = writable(defaultWorldMatrix);
    return {
        subscribe,
        set: (worldMatrix) => {
            set(worldMatrix);
            console.log("set worldMatrix",worldMatrix);
            if(contextStore && get(contextStore).program){

                updateWorldMatrix(contextStore,worldMatrix);
            }
        },
    };
};
export const worldMatrix = createWorldMatrix();

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
export const renderState = createRenderState();

function createContextStore () {
    const {subscribe,set} = writable({});
    return {
        subscribe,
        set: (context) => {
            console.log("set context",context);
            set(context)
        },
    };
}

export const contextStore = createContextStore();
// make this store inactive until the conditions are met (single flag?)
export const webglapp = derived([renderer,programs,worldMatrix], ([$renderer,$programs,$worldMatrix]) => {
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
        $renderer.lights.length === 0
    ){
        console.log("no renderer or programs or canvas");
        return[];
    }
    
    console.log("$renderState",get(renderState),context);
    const initInstructions = get(renderState).init ? [] : [$renderer.initRenderer(context,contextStore)];

    const setupInstructions = get(renderState).init ? [] : $programs.reduce((acc,program) => {
        return [
            ...acc,
            program.createProgram(contextStore),
            program.createShaders(contextStore),
            program.endProgramSetup(contextStore),
            setupCamera(contextStore,$renderer.camera),
            setupWorldMatrix(contextStore,get(worldMatrix)),
            setupNormalMatrix(contextStore),
            setupAttributes(contextStore,program.mesh),
            setupLights(contextStore,$renderer.lights),
        ];
    },[]);
    
    const list = [
        ...initInstructions,
        ...setupInstructions,
        render(contextStore),
    ];
    //list.forEach(fn => console.log(fn));
    return list;
});
