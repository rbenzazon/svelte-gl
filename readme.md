# Svelte GL

This repo is in early stage

the goal is to create a lightweight reactive webgl 3d engine using svelte stores

Its purpose is to research how reactivity can help reduce the complexity and weight of a 3d engine

One constraint it follows is to never over bundle code, using a less easy API, which leverage dependency injection and composition over OOP so the tree shaking can do its job fully

To give credit where credit is due, most of the 3d science is plundered from three.js, but everything must be optimized and rewritten to fit the constraints (no OOP, no over bundling, no over abstraction)

Existing features :
- PointLight
- Cube
- PolyHedron Sphere

List of planned features :
- PBR material
- DirectionalLight
- multiple lights
- multiple objects (partially done)
