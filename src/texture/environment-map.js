import { createVec3 } from "../geometries/common";
import PMREMVertex from "./pmrem-vertex.glsl";
import SphericalGaussianBlurFragment from "./spherical-gaussian-blur-fragment.glsl";
import CubemapToCubeUVFragment from "./cubemap-to-cube-uv-fragment.glsl";
import EquiRectangularToCubeUV from "./equi-rectangular-to-cube-uv-fragment.glsl";
import { createProgram, compileShaders, linkProgram, validateProgram, useProgram, unbindTexture } from "../store/gl";
import { appContext, selectProgram } from "../store/engine";
import { drawModes } from "../store/webgl";

const LOD_MIN = 4;
const EXTRA_LOD_SIGMA = [
    0.125,
    0.215,
    0.35,
    0.446,
    0.526,
    0.582
];
const NoBlending = 0;
const MAX_SAMPLES = 20;
const sigmas = [
    0,
    0.0078125,
    0.015625,
    0.03125,
    0.0625,
    0.125,
    0.215,
    0.35,
    0.446,
    0.526,
    0.582
];
// Golden Ratio
const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;
/*
const _axisDirections = [
     new Vector3( - PHI, INV_PHI, 0 ),
     new Vector3( PHI, INV_PHI, 0 ),
     new Vector3( - INV_PHI, 0, PHI ),
     new Vector3( INV_PHI, 0, PHI ),
     new Vector3( 0, PHI, - INV_PHI ),
     new Vector3( 0, PHI, INV_PHI ),
     new Vector3( - 1, 1, - 1 ),
     new Vector3( 1, 1, - 1 ),
     new Vector3( - 1, 1, 1 ),
     new Vector3( 1, 1, 1 )
];
*/
/** @type {vec3[]} */
const axisDirections = [
    [-PHI, INV_PHI, 0],
    [PHI, INV_PHI, 0],
    [-INV_PHI, 0, PHI],
    [INV_PHI, 0, PHI],
    [0, PHI, -INV_PHI],
    [0, PHI, INV_PHI],
    [-1, 1, -1],
    [1, 1, -1],
    [-1, 1, 1],
    [1, 1, 1]
];
/**
 * @typedef {Object} EnvMapPass
 * @property {import("src/store/programs").SvelteGLProgram[]} programs array of programs used in the pass
 * @property {() => WebGLTexture} getTexture function to get the shadow texture
 * @property {number} order order of the pass in the rendering pipeline
 */

/**
 * 
 * @param {import("src/loaders/rgbe-loader").RGBE} image 
 * @return {EnvMapPass} 
 */
export function createEnvironmentMap(image) {
    let context = {};

    //context.cubeMapTexture = getCubeMapTexture();
    context.image = image;
    context.cubeImageSize = image.width / 4;//??
    context.lodMax = Math.floor(Math.log2(context.cubeImageSize));
    context.cubeSize = Math.pow(2, context.lodMax);
    context.renderTargetWidth = 3 * Math.max(context.cubeSize, 16 * 7);
    context.renderTargetHeight = 4 * context.cubeSize;
    createLodPlanes(context);

    logLodPlane(context.lodPlanes[0]);

    let hdrTexture;
    function setHDRTexture(texture) {
        hdrTexture = texture;
    }
    function getHDRTexture() {
        return hdrTexture;
    }

    let pingTexture;
    function setPingTexture(texture) {
        console.log("setPingTexture", texture);
        pingTexture = texture;
    }
    function getPingTexture() {
        console.log("getPingTexture", pingTexture);
        return pingTexture;
    }
    let pingFBO;
    function setPingFBO(fbo) {
        pingFBO = fbo;
    }
    function getPingFBO() {
        return pingFBO;
    }
    let pongTexture;
    function setPongTexture(texture) {
        console.log("setPongTexture", texture);
        pongTexture = texture;
    }
    function getPongTexture() {
        console.log("getPongTexture", pingTexture);
        return pongTexture;
    }
    let pongFBO;
    function setPongFBO(fbo) {
        pongFBO = fbo;
    }
    function getPongFBO() {
        return pongFBO;
    }
    
    return {
        programs: [
            {
                createProgram: createEquiRectangularToCubeUVProgram(context, image, setHDRTexture),
                setupProgram: [
                    createEquiRectangularToCubeUVShaders,
                    linkProgram,
                    validateProgram,
                    createFBO(context, setPingFBO, setPingTexture),
                ],
                useProgram,
                selectProgram,
                setupMaterial: [setupEquiRectangularToCubeUVUniforms, bindEnvMapTexture(getHDRTexture)],
                setupCamera: () => () => { },
                setFrameBuffer: setFrameBuffer(getPingFBO, context,getViewportSize,true),
                meshes: [context.lodPlanes[0]],
                /*postDraw: unbindTexture,*/
            },
            ...(new Array((context.lodPlanes.length - 1)*2)).fill(0).map((_, programIndex) => {
                const STANDARD_DEVIATIONS = 3;
                const lodIndex = Math.floor(programIndex / 2)+1;
                
                const pair = programIndex % 2 === 0;
                const direction = pair ? 'latitudinal' : 'longitudinal';
                const getCurrentFBO = pair ? getPongFBO : getPingFBO;
                const getCurrentTexture = pair ? getPingTexture : getPongTexture;
                
                const sigma = Math.sqrt(sigmas[lodIndex] * sigmas[lodIndex] - sigmas[lodIndex - 1] * sigmas[lodIndex - 1]);
                const poleAxis = (axisDirections[(context.lodPlanes.length - lodIndex - 1) % axisDirections.length]);
                const lodIn = lodIndex - 1;
                const lodOut = lodIndex;
                const pixels = context.sizeLods[lodIn] - 1;
                const radiansPerPixel = isFinite(sigma) ? Math.PI / (2 * pixels) : 2 * Math.PI / (2 * MAX_SAMPLES - 1);
                const sigmaPixels = sigma / radiansPerPixel;
                const samples = isFinite(sigma) ? 1 + Math.floor(STANDARD_DEVIATIONS * sigmaPixels) : MAX_SAMPLES;

                const weights = [];
                let sum = 0;
                for (let i = 0; i < MAX_SAMPLES; ++i) {
                    const x = i / sigmaPixels;
                    const weight = Math.exp(- x * x / 2);
                    weights.push(weight);
                    if (i === 0) {
                        sum += weight;
                    } else if (i < samples) {
                        sum += 2 * weight;
                    }
                }

                for (let i = 0; i < weights.length; i++) {
                    weights[i] = weights[i] / sum;
                }
                const outputSize = context.sizeLods[ lodOut ];
                const x = 3 * outputSize * ( lodOut > context.lodMax - LOD_MIN ? lodOut - context.lodMax + LOD_MIN : 0 );
                const y = 4 * ( context.cubeSize - outputSize );
                const width = 3 * outputSize;
                const height = 2 * outputSize;
                return {
                    createProgram:createBlurProgram(programIndex !== 0),
                    setupProgram: [
                        ...(programIndex === 0 ? [
                            createBlurShader,
                            linkProgram,
                            validateProgram,
                            createFBO(context, setPongFBO, setPongTexture),
                        ] : []),
                    ],
                    setupMaterial: [
                    ],
                    useProgram,
                    selectProgram,
                    setupCamera: () => () => {},
                    setFrameBuffer: setFrameBuffer(getCurrentFBO, context,getBlurViewportSize(x,y,width,height)),
                    updateProgram: [
                        bindEnvMapTexture(getHDRTexture),
                        setupBlurUniforms(samples,weights,direction === 'latitudinal',poleAxis,radiansPerPixel,context.lodMax-lodIn),
                    ],
                    meshes: [context.lodPlanes[lodIndex]],
                    ...(programIndex === ((context.lodPlanes.length - 1)*2-1) ?{postDraw:restoreState}:{}),
                }
            }),
        ],
        getTexture: getPingTexture,
        order: -1,
    }
}

function disableDepthTest(){
    const { gl } = appContext;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
}

function restoreDepthTest(){
    const { gl } = appContext;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
}

function enableScissorTest(){
    const { gl } = appContext;
    gl.enable(gl.SCISSOR_TEST);
}

function restoreScissorTest(){
    const { gl } = appContext;
    gl.disable(gl.SCISSOR_TEST);
}

function restoreFlipY(){
    const { gl } = appContext;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

function restoreState(){
    restoreDepthTest();
    restoreScissorTest();
    restoreFlipY();
    unbindTexture();
}

function setSourceTexture(getTexture) {
	const { gl, program } = appContext;
    const textureLocation = gl.getUniformLocation(program, "envMap");
    gl.uniform1i(textureLocation, 0);
    gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, getTexture());
}

/**
 * 
 * @param {number} samples 
 * @param {number[]} weights 
 * @param {boolean} latitudinal 
 * @param {vec3} poleAxis 
 * @param {number} dTheta 
 * @param {number} mipInt 
 * 
 * @returns 
 */
function setupBlurUniforms(samples,weights,latitudinal,poleAxis,dTheta,mipInt){
    return function setupBlurUniforms(){
        const { gl, program } = appContext;
        const samplesLocation = gl.getUniformLocation(program, "samples");
        gl.uniform1i(samplesLocation, samples);
        const weightsLocation = gl.getUniformLocation(program, "weights");
        gl.uniform1fv(weightsLocation, weights);
        const latitudinalLocation = gl.getUniformLocation(program, "latitudinal");
        gl.uniform1i(latitudinalLocation, latitudinal ? 1 : 0);
        if (poleAxis) {
            const poleAxisLocation = gl.getUniformLocation(program, "poleAxis");
            gl.uniform3fv(poleAxisLocation, poleAxis);
        }
        const dThetaLocation = gl.getUniformLocation(program, "dTheta");
        gl.uniform1f(dThetaLocation, dTheta);
        const mipIntLocation = gl.getUniformLocation(program, "mipInt");
        gl.uniform1f(mipIntLocation, mipInt);
        //setSourceTexture(getTexture);
    }
}


function halfBlur(targetIn, targetOut, lodIn, lodOut, sigmaRadians, direction, poleAxis, lodPlanes, sizeLods, lodMax) {

    const renderer = this._renderer;
    const blurMaterial = this._blurMaterial;

    if (direction !== 'latitudinal' && direction !== 'longitudinal') {

        console.error(
            'blur direction must be either latitudinal or longitudinal!');

    }

    // Number of standard deviations at which to cut off the discrete approximation.
    const STANDARD_DEVIATIONS = 3;

    const blurMesh = new Mesh(lodPlanes[lodOut], blurMaterial);
    const blurUniforms = blurMaterial.uniforms;

    const pixels = sizeLods[lodIn] - 1;
    const radiansPerPixel = isFinite(sigmaRadians) ? Math.PI / (2 * pixels) : 2 * Math.PI / (2 * MAX_SAMPLES - 1);
    const sigmaPixels = sigmaRadians / radiansPerPixel;
    const samples = isFinite(sigmaRadians) ? 1 + Math.floor(STANDARD_DEVIATIONS * sigmaPixels) : MAX_SAMPLES;

    if (samples > MAX_SAMPLES) {

        console.warn(`sigmaRadians, ${sigmaRadians}, is too large and will clip, as it requested ${samples} samples when the maximum is set to ${MAX_SAMPLES}`);

    }

    const weights = [];
    let sum = 0;

    for (let i = 0; i < MAX_SAMPLES; ++i) {

        const x = i / sigmaPixels;
        const weight = Math.exp(- x * x / 2);
        weights.push(weight);

        if (i === 0) {

            sum += weight;

        } else if (i < samples) {

            sum += 2 * weight;

        }

    }

    for (let i = 0; i < weights.length; i++) {

        weights[i] = weights[i] / sum;

    }

    blurUniforms['envMap'].value = targetIn.texture;
    blurUniforms['samples'].value = samples;
    blurUniforms['weights'].value = weights;
    blurUniforms['latitudinal'].value = direction === 'latitudinal';

    if (poleAxis) {

        blurUniforms['poleAxis'].value = poleAxis;

    }

    blurUniforms['dTheta'].value = radiansPerPixel;
    blurUniforms['mipInt'].value = lodMax - lodIn;

    const outputSize = sizeLods[lodOut];
    const x = 3 * outputSize * (lodOut > lodMax - LOD_MIN ? lodOut - lodMax + LOD_MIN : 0);
    const y = 4 * (this._cubeSize - outputSize);

    _setViewport(targetOut, x, y, 3 * outputSize, 2 * outputSize);
    renderer.setRenderTarget(targetOut);
    //render with orthographic camera
    renderer.render(blurMesh, _flatCamera);

}
function getViewportSize(context) {
    const size = context.cubeSize;
    return {
        x: 0,
        y: 0,
        width: 3 * size,
        height: 2 * size,
    }
}
function getBlurViewportSize(x,y,width,height) {
    return function getBlurViewportSize(){
        return {
            x,
            y,
            width,
            height,
        }
    }
}

/**
 * 
 * @param {Object} context 
 * @param {import("src/loaders/rgbe-loader").RGBE} image 
 * @param {(value:WebGLTexture)=>void} setHDRTexture 
 * @returns {(programStore)=>()=>void}
 */
function createEquiRectangularToCubeUVProgram(context, image,setHDRTexture) {
    console.log("createCubeMapToCubeUVProgram", context, image);
    return function createEquiRectangularToCubeUVProgram(programStore) {
        return function createEquiRectangularToCubeUVProgram() {
            setupHDRTexture(image, setHDRTexture);
            createProgram(programStore)();
            disableDepthTest();
            enableScissorTest();
        }
    }
}

function setupHDRTexture(image, setHDRTexture) {
    const { gl } = appContext;
    const texture = gl.createTexture();
    setHDRTexture(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        image.width,
        image.height,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        image.data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    //flip y
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    //pre multiply alpha false
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function createEquiRectangularToCubeUVShaders() {
    const { gl, program } = appContext;
    compileShaders(gl, program, PMREMVertex, EquiRectangularToCubeUV);
}

function createCubemapToCubeUVShaders() {
    const { gl, program } = appContext;
    compileShaders(gl, program, PMREMVertex, CubemapToCubeUVFragment);
}

function createBlurShader() {
    const { gl, program } = appContext;
    compileShaders(gl, program, PMREMVertex, SphericalGaussianBlurFragment);
}

function createFBO(context, setFBO, setTexture) {
    return function createFBO() {
        const { gl } = appContext;
        const { renderTargetWidth, renderTargetHeight } = context;
        console.log("createFBO", renderTargetWidth, renderTargetHeight);
        
        // The geometry texture will be sampled during the HORIZONTAL pass
        const texture = gl.createTexture();
        setTexture(texture);
        /*
        alphaSize: 16
        blueSize: 16
        componentType: FLOAT
        depthSize: 0
        encoding: LINEAR
        format: RGBA
        greenSize: 16
        height: 4096
        internalFormat: RGBA16F
        redSize: 16
        stencilSize: 0
        texture: WebGLTexture - ID: 6
        textureCubeMapFace: NONE
        textureLayer: 0
        textureLevel: 0
        textureType: HALF_FLOAT
        type: TEXTURE
        width: 3072
        */
        gl.bindTexture(gl.TEXTURE_2D, texture);
        //gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, renderTargetWidth, renderTargetHeight);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA16F, // Internal format for HDR
            renderTargetWidth,
            renderTargetHeight,
            0,
            gl.RGBA,
            gl.HALF_FLOAT,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        

        const fbo = gl.createFramebuffer();
        setFBO(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
}
/*

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, renderTargetWidth, renderTargetHeight);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        */

function setupEquiRectangularToCubeUVUniforms() {
    return function setupEquiRectangularToCubeUVUniforms() {
        const { gl, program } = appContext;
        const location = gl.getUniformLocation(program, "flipEnvMap");
        gl.uniform1f(location, -1);
    }
}

function bindEnvMapTexture(getBuffer) {
    return function bindEnvMapTexture() {
        const { gl, program } = appContext;
        gl.bindTexture(gl.TEXTURE_2D, getBuffer());
    };
}


function setFrameBuffer(getFBO = null, context,getViewportSize,clear = false) {
    return function setFrameBuffer() {
        const { gl } = appContext;
        const fbo = getFBO ? getFBO() : null;
        const { renderTargetWidth, renderTargetHeight } = context;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        if (appContext.fbo !== fbo && fbo != null) {
            console.log("framebuffer change clearing from", appContext.fbo, "to", fbo, [0, 0, 0, 1], renderTargetWidth, renderTargetHeight);
            const {x,y,width, height} = getViewportSize(context);
            console.log("viewport",x,y,width,height);
            
            gl.viewport(x,y, width, height);
            gl.scissor(x,y, width, height);
            appContext.frameBufferWidth = renderTargetWidth;
            appContext.frameBufferHeight = renderTargetHeight;
            if(clear){
                gl.clearColor(...[0, 0, 0, 0]);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            }
        }
        appContext.fbo = fbo;
    };
}

/**
 *
 * @param {boolean} mapCurrent makes the previous program the current one
 * which allows to reuse one program in two consecutive and different draw passes
 * This case is necessary to draw twice with different settings (uniforms)
 *
 */
export function createBlurProgram(mapCurrent = false) {
	return function createBlurProgram(programStore) {
		return function createBlurProgram() {
			const { gl, programMap, vaoMap } = appContext;
			if (!programMap.has(programStore) && !mapCurrent) {
				const program = gl.createProgram();
				programMap.set(programStore, program);
				vaoMap.set(programStore, new Map());
				appContext.program = program;
			} else if (mapCurrent) {
				programMap.set(programStore, appContext.program);
				vaoMap.set(programStore, new Map());
			} else {
				//todo check if necessary, this check is done in engine already, if it exists, createProgram is not called
				appContext.program = appContext.programMap.get(programStore);
			}
		};
	};
}

function createLodPlanes(context) {
    const lodPlanes = [];
    const sizeLods = [];
    const sigmas = [];

    let lod = context.lodMax;
    const totalLods = context.lodMax - LOD_MIN + 1 + EXTRA_LOD_SIGMA.length;

    for (let lodIndex = 0; lodIndex < totalLods; lodIndex++) {
        const sizeLod = Math.pow(2, lod);
        
        sizeLods.push(sizeLod);
        let sigma = 1.0 / sizeLod;

        if (lodIndex > context.lodMax - LOD_MIN) {
            sigma = EXTRA_LOD_SIGMA[lodIndex - context.lodMax + LOD_MIN - 1];
        } else if (lodIndex === 0) {
            sigma = 0;
        }

        sigmas.push(sigma);

        const texelSize = 1.0 / (sizeLod - 2);
        const min = - texelSize;
        const max = 1 + texelSize;
        const uv1 = [min, min, max, min, max, max, min, min, max, max, min, max];

        const cubeFaces = 6;
        const vertices = 6;
        const positionSize = 3;
        const uvSize = 2;
        const faceIndexSize = 1;

        const position = new Float32Array(positionSize * vertices * cubeFaces);
        const uv = new Float32Array(uvSize * vertices * cubeFaces);
        const faceIndex = new Float32Array(faceIndexSize * vertices * cubeFaces);
        for (let face = 0; face < cubeFaces; face++) {

            const x = (face % 3) * 2 / 3 - 1;
            const y = face > 2 ? 0 : - 1;
            const coordinates = [
                x, y, 0,
                x + 2 / 3, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y + 1, 0
            ];
            position.set(coordinates, positionSize * vertices * face);
            uv.set(uv1, uvSize * vertices * face);
            const fill = [face, face, face, face, face, face];
            faceIndex.set(fill, faceIndexSize * vertices * face);

        }
        const geometry = {
            attributes: {
                positions: position,
                uvs: uv,
                faceIndex:{
                    array: faceIndex,
                    itemSize: faceIndexSize
                },
            },
            drawMode:drawModes[4],
        }
        lodPlanes.push(geometry);

        if (lod > LOD_MIN) {
            lod--;
        }
    }
    context.lodPlanes = lodPlanes;
    context.sizeLods = sizeLods;
    context.sigmas = sigmas;

}

function logLodPlane(lodPlane){
    const faces = []
    //one face is composed of 6 vertices, which are composed of 3 positions
    //
    for(let i = 0;i<6;i++){
        //ignore z the triangles are flat
        //positions is a typearray
        //const points = lodPlane.attributes.positions.slice(i*3*6, 3*6);
        const point = lodPlane.attributes.positions;
        const points = [
            [point[i*3], point[i*3+1], point[i*3+2]],
            [point[i*3+3], point[i*3+4], point[i*3+5]],
            [point[i*3+6], point[i*3+7], point[i*3+8]],
            [point[i*3+9], point[i*3+10], point[i*3+11]],
            [point[i*3+12], point[i*3+13], point[i*3+14]],
            [point[i*3+15], point[i*3+16], point[i*3+17]],
        ];
        //take the smallest x
        const x = points.map(p=>p[0]).reduce((a,b)=>Math.min(a,b));
        const y = points.map(p=>p[1]).reduce((a,b)=>Math.min(a,b));
        const width = points.map(p=>p[0]).reduce((a,b)=>Math.max(a,b)) - x;
        const height = points.map(p=>p[1]).reduce((a,b)=>Math.max(a,b)) - y;


        
        
        faces.push({
            x,
            y,
            width,
            height,
        })

    }
    console.log("faces",faces);
}

/*
{
                createProgram: createShadowProgram(),
                setupProgram: [
                    createShaders,
                    linkProgram,
                    validateProgram,
                    createFBO(textureWidth, textureHeight, setGeometryFBO, setGeometryTexture),
                ],
                setupMaterial: [setupDarknessUniform(darkness)],
                useProgram,
                selectProgram,
                setupCamera: setupShadowCamera(projection, view),
                setFrameBuffer: setFrameBuffer(getGeometryFBO, textureWidth, textureHeight),
                allMeshes: true,
            },
*/


export function createEnvironmentMap_project(cubeMapTexture) {
    const cubeImageSize = cubeMapTexture.image.width;//??
    const lodMax = Math.floor(Math.log2(cubeImageSize));
    const cubeSize = Math.pow(2, lodMax);

    const renderTargetWidth = 3 * Math.max(cubeSize, 16 * 7);
    const renderTargetHeight = 4 * cubeSize;
    /*
    const params = {
        magFilter: LinearFilter,
        minFilter: LinearFilter,
        generateMipmaps: false,
        type: HalfFloatType,
        format: RGBAFormat,
        colorSpace: LinearSRGBColorSpace,
        depthBuffer: false
    };
        */

    const lodPlanes = [];
    const sizeLods = [];
    const sigmas = [];

    let lod = lodMax;

    const totalLods = lodMax - LOD_MIN + 1 + EXTRA_LOD_SIGMA.length;

    for (let i = 0; i < totalLods; i++) {
        const sizeLod = Math.pow(2, lod);
        sizeLods.push(sizeLod);
        let sigma = 1.0 / sizeLod;

        if (i > lodMax - LOD_MIN) {

            sigma = EXTRA_LOD_SIGMA[i - lodMax + LOD_MIN - 1];

        } else if (i === 0) {

            sigma = 0;

        }

        sigmas.push(sigma);

        const texelSize = 1.0 / (sizeLod - 2);
        const min = - texelSize;
        const max = 1 + texelSize;
        const uv1 = [min, min, max, min, max, max, min, min, max, max, min, max];

        const cubeFaces = 6;
        const vertices = 6;
        const positionSize = 3;
        const uvSize = 2;
        const faceIndexSize = 1;

        const position = new Float32Array(positionSize * vertices * cubeFaces);
        const uv = new Float32Array(uvSize * vertices * cubeFaces);
        const faceIndex = new Float32Array(faceIndexSize * vertices * cubeFaces);
        for (let face = 0; face < cubeFaces; face++) {

            const x = (face % 3) * 2 / 3 - 1;
            const y = face > 2 ? 0 : - 1;
            const coordinates = [
                x, y, 0,
                x + 2 / 3, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y + 1, 0
            ];
            position.set(coordinates, positionSize * vertices * face);
            uv.set(uv1, uvSize * vertices * face);
            const fill = [face, face, face, face, face, face];
            faceIndex.set(fill, faceIndexSize * vertices * face);

            const geometry = {
                attributes: {
                    position: { array: position, itemSize: positionSize },
                    uv: { array: uv, itemSize: uvSize },
                    faceIndex: { array: faceIndex, itemSize: faceIndexSize },
                }
            }
            lodPlanes.push(geometry);

            if (lod > LOD_MIN) {

                lod--;

            }

        }
    }

    renderCubeMaterial(lodPlanes);



    renderBlurShader(lodMax, renderTargetWidth, renderTargetHeight, lodPlanes, sizeLods);
}

function renderBlurShader(lodMax, width, height, lodPlanes, sizeLods) {
    const weights = new Float32Array(MAX_SAMPLES);
    const poleAxis = [0, 1, 0];
    /*
    const shaderParams = {

        name: 'SphericalGaussianBlur',

        defines: {
            'n': MAX_SAMPLES,
            'CUBEUV_TEXEL_WIDTH': 1.0 / width,
            'CUBEUV_TEXEL_HEIGHT': 1.0 / height,
            'CUBEUV_MAX_MIP': `${lodMax}.0`,
        },

        uniforms: {
            'envMap': { value: null },
            'samples': { value: 1 },
            'weights': { value: weights },
            'latitudinal': { value: false },
            'dTheta': { value: 0 },
            'mipInt': { value: 0 },
            'poleAxis': { value: poleAxis }
        },
        blending: NoBlending,
        depthTest: false,
        depthWrite: false
    };
    */
    const vertexShaderSource = PMREMVertex;

    const fragmentShaderSource = SphericalGaussianBlurFragment;

    //create program


    const n = lodPlanes.length;

    for (let i = 1; i < n; i++) {

        const sigma = Math.sqrt(sigmas[i] * sigmas[i] - sigmas[i - 1] * sigmas[i - 1]);

        const poleAxis = axisDirections[(n - i - 1) % axisDirections.length];
        const lodIn = i - 1;
        const lodOut = i;

        //cubeUVRenderTarget is a framebuffer
        //pingPongRenderTarget is a framebuffer
        //render 
        halfBlur(
            cubeUVRenderTarget,
            pingPongRenderTarget,
            lodIn,
            lodOut,
            sigma,
            'latitudinal',
            poleAxis,
            lodPlanes,
            sizeLods,
            lodMax
        );

        halfBlur(
            pingPongRenderTarget,
            cubeUVRenderTarget,
            lodOut,
            lodOut,
            sigma,
            'longitudinal',
            poleAxis,
            lodPlanes,
            sizeLods,
            lodMax
        );
        //this._blur( cubeUVRenderTarget, i - 1, i, sigma, poleAxis );

    }


}

function renderCubeMaterial(lodPlanes) {
    const options = {
        name: 'CubemapToCubeUV',

        uniforms: {
            'envMap': { value: null },
            'flipEnvMap': { value: - 1 }
        },
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        envMap: texture,
    }

    const vertexShaderSource = PMREMVertex;

    const fragmentShaderSource = CubemapToCubeUVFragment;

    //create program

    //render with lodPlanes[0]
}