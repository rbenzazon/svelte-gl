class DrawPass {
    program;
    vao;
    uniforms;

}

class Mesh {
    attributes : { positions, normals, elements, uvs };
    drawMode;
    instances;
    matrix | matrices;
    animations;
    material;
}