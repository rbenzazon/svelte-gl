# Svelte GL

This repo is in early stage

the goal is to create a lightweight reactive webgl 3d engine using svelte stores

Its purpose is to research how reactivity can help reduce the complexity and weight of a 3d engine

## Demo
https://rbenzazon.github.io/svelte-gl/build/

## Phylosophy

Constraints:  
-never over bundle code, leveraging dependency injection and composition over OOP to maximize tree shaking
-using a simple almost low level API but no quite, to maximize performance and minimize bundle size

To give credit where credit is due, most of the 3d science is plundered from three.js, but everything must be optimized and rewritten to fit the constraints (no OOP, no over bundling, no over abstraction)

## High Level Features
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
    * environment map, including HDR support
- GLTF loader, basic implementation
- Optional Draco decoder for GLTF geometry
- Obj Loader
- Meshe instances
- Camera
- Orbit control
- Geometries : Cube, PolyHedron Sphere, Plane, Cone
- Skybox, including HDR support
- Contact shadow
- Point light
- Ambient light
- Vertex shader animations
    * noise distortion
    * wobbly
    * pulsating scale
- Tone mapping : linear, AGX, ACES Filmic
- Interactive Debug Panel
- Display mesh normals

## Low Level Features

- separation of pipeline computation and execution
- pipeline caching

## Fixes TODO

- fix polyhedrong UVs

## Roadmap

- shadow mapping (cast and receive)
- complete PBR material : 
    * emmisive
    * clear coat
    * anisotropy
    * sheen
    * transmission
- engine optimizations
    * material property update without recompiling shader
- spot light
- directional light
- sky simulation shader

- use the following feature to improve the engine :
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
### Scene Update | [Demo](https://rbenzazon.github.io/svelte-gl/build/scene-update) | [Code](./src/scene-update.svelte)
### Skybox HDR | [Demo](https://rbenzazon.github.io/svelte-gl/build/skybox) | [Code](./src/skybox.svelte)
### Skybox SDR | [Demo](https://rbenzazon.github.io/svelte-gl/build/skybox-cube) | [Code](./src/skybox-cube.svelte)
### Draco Compressed GLTF | [Demo](https://rbenzazon.github.io/svelte-gl/build/draco-gltf) | [Code](./src/draco-gltf.svelte)
