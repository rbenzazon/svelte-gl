renderer
    canvas
    loop
    backgroundColor
    camera
    ambientLight
    tonemappings
    start
    stop

scene
    nodes = meshes | lights | cameras

meshes
    mesh
        attributes
        instances
        drawMode
        material
        vertex animations
        matrix(transformMatrix) | matrices

materials
    diffuseMap
    normalMap
    specular


render
    clear
    programs
        shaders
            vertex
                vertex animations
                instances
            fragment
                diffuseMap
                normalMap
                material specular
                lights
                tonemappings
        environment
            ambientLight
            camera
            lights
            time
        
        meshes


Execution order :

if not init
    initRenderer

clear screen buffers
execute loop

//when these uniforms will be converted to UNIFORM_BUFFER_OBJECTS, they will be updated only once
createCommonBuffers
    Camera, Lights, AmbientLight

each program
    if not created 
        createProgram
        if shader not created (should not be the case maybe remove if)
            createShaders
            linkProgram
            validateProgram

    useProgram (endProgramSetup)
    setupCamera
    setupAmbientLight
    setupLights
    setupTime

    each mesh
        setupAttributes
        setupMeshColor
        setupTransformMatrix
        setupNormalMatrix
        setupTexture for diffuse and normal
        each animation
            setupAnimation
        bind VAO

        draw

