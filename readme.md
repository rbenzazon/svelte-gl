# Svelte GL

This repo is in early stage

the goal is to create a lightweight reactive webgl 3d engine using svelte stores

Its purpose is to research how reactivity can help reduce the complexity and weight of a 3d engine

## Demo
https://rbenzazon.github.io/svelte-gl/build/

## Phylosophy

One constraint it follows is to never over bundle code, using a simpler more low level API, which leverage dependency injection and composition over OOP to make the bundler job easier at tree shaking.

To give credit where credit is due, most of the 3d science is plundered from three.js, but everything must be optimized and rewritten to fit the constraints (no OOP, no over bundling, no over abstraction)

## Features
- PBR material (partial completion)
    * diffuse color
    * opacity
    * metalness
    * specular
        * roughness
        * IOR
        * intensity
    * diffuse map
    * normal map
    * roughness map
- GLTF loader without draco compression (partial completion)
- Obj Loader
- Meshe instances
- Camera
- Orbit control
- Geometries : Cube, PolyHedron Sphere, Plane, Cone
- Contact shadow
- Point light
- Ambient light
- Vertex shader animations
    * noise distortion
    * wobbly
    * pulsating scale
- Tone mapping : linear, AGX
- Interactive Debug Panel

## Roadmap
- implement environment map for background and lighting

- use the following feature to improve the engine
https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile

## How to use

### installation
- clone the repo
- `pnpm install`

### development
- `pnpm watch`
- `pnpm test`
- add you own svelte entry point in rollup.config.mjs
- add assets in build folder

### production
- `pnpm build`

## Examples
### GLTF Loader | [Demo](https://rbenzazon.github.io/svelte-gl/build/) | [Code](./src/main-refactor.svelte)
### Obj Loader | [Demo](https://rbenzazon.github.io/svelte-gl/build/venus) | [Code](./src/venus.svelte)
### Cube | [Demo](https://rbenzazon.github.io/svelte-gl/build/cube) | [Code](./src/cube.svelte)
### GLTF | [Demo](https://rbenzazon.github.io/svelte-gl/build/gltf) | [Code](./src/gltf.svelte)
### Contact Shadow | [Demo](https://rbenzazon.github.io/svelte-gl/build/contact-shadow) | [Code](./src/contact-shadow.svelte)
### Transparency | [Demo](https://rbenzazon.github.io/svelte-gl/build/transparency) | [Code](./src/transparency.svelte)
### Instances | [Demo](https://rbenzazon.github.io/svelte-gl/build/instances) | [Code](./src/instances.svelte)
### Matrix | [Demo](https://rbenzazon.github.io/svelte-gl/build/matrix) | [Code](./src/matrix.svelte)
### Texture | [Demo](https://rbenzazon.github.io/svelte-gl/build/texture) | [Code](./src/texture.svelte)
### Lights | [Demo](https://rbenzazon.github.io/svelte-gl/build/lights) | [Code](./src/lights.svelte)
### Vertex Animation | [Demo](https://rbenzazon.github.io/svelte-gl/build/vertex-anim) | [Code](./src/vertex-anim.svelte)
### Debug Panel | [Demo](https://rbenzazon.github.io/svelte-gl/build/lights) | [Code](./src/lights.svelte) | [Component Code](./src/DebugPanel.svelte)