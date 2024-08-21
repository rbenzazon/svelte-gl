import { normalize, add, lerp } from "gl-matrix/esm/vec3.js";

export function createCone(radius = 1, height = 1, radialSegment = 3, heightSegment = 1){

    radialSegment = Math.max(radialSegment,3);
    heightSegment = Math.max(heightSegment,1);
    const positions = [];
    const normals = [];
    //const elements = [];
    const uvs = [];

    const angle = Math.PI*2/radialSegment;
    const heightIncrement = height/heightSegment;
    let iy = 1;
    const slope = radius/height;
    // apex segment, no quads, no shared
    
    const loopPositions = [];
    const apexLoopNormals = [];
    for(let ir = 0;ir<radialSegment;ir++){
        const radialAngle = angle * ir;
        const sinRadial = Math.sin(radialAngle);
        const cosRadial = Math.cos(radialAngle);
        loopPositions.push([
            Math.cos(radialAngle) * radius,
            height - heightIncrement * iy,
            Math.sin(radialAngle) * radius,
        ]);
        console.log("theta",radialAngle)
        console.log("sinTheta",sinRadial)
        console.log("slope",slope)
        console.log("cosTheta",cosRadial)
        const normal = [sinRadial,slope,cosRadial];
        apexLoopNormals.push(normalize(normal,normal));
    }
    console.log("apexLoopPositions",loopPositions);
    console.log("apexLoopNormals",apexLoopNormals);
    const downNormal = [0,-1,0];
    for(let ir = 0;ir<radialSegment;ir++){
        const nextIndex = ir === radialSegment-1 ? 0 : (ir+1);
        //draw two triangles so the apex is used twice with different normals
        //must create a point between corrent and next point
        const middlePoint = [];
        lerp(middlePoint,loopPositions[ir],loopPositions[nextIndex],0.5);
        positions.push(
            [0,height,0],
            middlePoint,
            loopPositions[ir],
        );
        positions.push(
            [0,height,0],
            loopPositions[nextIndex],
            middlePoint,
        );
        const middleNormal = [];
        add(middleNormal,apexLoopNormals[ir],apexLoopNormals[nextIndex]);
        normalize(middleNormal,middleNormal);
        normals.push(
            apexLoopNormals[ir],
            middleNormal,
            apexLoopNormals[ir],
        );
        normals.push(
            apexLoopNormals[nextIndex],
            apexLoopNormals[nextIndex],
            middleNormal,
        );
        console.log("normals",apexLoopNormals[ir],middleNormal,apexLoopNormals[nextIndex]);
        const halfIndex = ir+0.5;
        const unsafeNextIndex = ir+1;
        uvs.push(
            [ir/radialSegment,0],
            [halfIndex/radialSegment,heightIncrement*iy/height],
            [ir/radialSegment,heightIncrement*iy/height],
        )
        uvs.push(
            [nextIndex/radialSegment,0],
            [unsafeNextIndex/radialSegment,heightIncrement*iy/height],
            [halfIndex/radialSegment,heightIncrement*iy/height],
        )
        //console.log("uvs",ir/radialSegment,halfIndex/radialSegment,unsafeNextIndex/radialSegment);
        /*positions.push(
            [0,0,0],
            loopPositions[ir],
            loopPositions[nextIndex],
        );
        normals.push(
            downNormal,
            downNormal,
            downNormal,
        );
        uvs.push(
            [halfIndex/radialSegment,1],
            [halfIndex/radialSegment,1],
            [nextIndex/radialSegment,1],
        );*/
    }
    


    /*for(let ir = 0;ir<radialSegment;ir++){
        elements.push(
            ir*3,
            ir === radialSegment-1 ? 1 : ((ir+1)*3+1),
            ir*3+1,
        );
    }*/

    //for(let iy = 1;iy<heightSegment;iy++){
    console.log("positions",positions)
    return {
        positions:new Float32Array(positions.flatMap(p=>p)),
        normals:new Float32Array(normals.flatMap(p=>p)),
        //elements:new Uint16Array(elements),
        uvs:new Float32Array(uvs.flatMap(p=>p)),
    }
}

function vectorFromSpherical(polar,azimuth){
    return [
        Math.cos(azimuth) * Math.cos(polar),
        Math.sin(azimuth) * Math.cos(polar),
        Math.sin(polar),
    ]
}