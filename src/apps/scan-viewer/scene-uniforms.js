import { UBO_BINDING_POINT_SCENE } from "../../store/gl.js";

/**
 * "Scene" uniform block shared by the viewer programs: vec4(origin.xyz, zScale).
 * upload and bindBlock are pipeline steps; upload only writes after a change.
 */
export function createSceneUniforms() {
	const data = new Float32Array([0, 0, 0, 1]);
	let buffer = null;
	let dirty = true;

	function upload(ctx) {
		const { gl } = ctx;
		if (!buffer) {
			buffer = gl.createBuffer();
			gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
			gl.bufferData(gl.UNIFORM_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
			gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO_BINDING_POINT_SCENE, buffer);
		}
		if (dirty) {
			gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
			gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
			dirty = false;
		}
	}

	function bindBlock(ctx) {
		const { gl, program } = ctx;
		gl.uniformBlockBinding(program, gl.getUniformBlockIndex(program, "Scene"), UBO_BINDING_POINT_SCENE);
	}

	return {
		setOrigin(origin) {
			data.set(origin);
			dirty = true;
		},
		setZScale(zScale) {
			data[3] = zScale;
			dirty = true;
		},
		upload,
		bindBlock,
	};
}
