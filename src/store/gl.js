import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { get } from 'svelte/store';

export function setupNormalMatrix(context){
    return function createNormalMatrix() {
        console.log("setupNormalMatrix");
        context = get(context);
        const gl = context.gl;
        const program = context.program;
        const worldMatrix = context.worldMatrix;
        const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
        context.normalMatrixLocation = normalMatrixLocation;
        let normalMatrix = create();
        invert(normalMatrix, worldMatrix);
        transpose(normalMatrix, normalMatrix);
        gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);

    };
}