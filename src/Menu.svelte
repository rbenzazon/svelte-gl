<script type="module">
let menuOpened = false;
function toggleMenu() {
	menuOpened = !menuOpened;
}
const links = [
	{ name: "Normal map and specular", href: "./golf-ball" },
	{ name: "GLTF loader", href: "./" },
	{ name: "Obj loader", href: "./venus" },
	{ name: "Cube", href: "./cube" },
	{ name: "rock", href: "./rock" },
	{ name: "GLTF", href: "./gltf" },
	{ name: "Contact Shadow", href: "./contact-shadow" },
	{ name: "Transparency", href: "./transparency" },
	{ name: "Instances", href: "./instances" },
	{ name: "Matrix", href: "./matrix" },
	{ name: "Texture", href: "./texture" },
	{ name: "Lights", href: "./lights" },
	{ name: "Vertex Animation", href: "./vertex-anim" },
	{ name: "Scene Update", href: "./scene-update" },
	{ name: "Skybox HDR", href: "./skybox" },
	{ name: "Skybox Cube Map", href: "./skybox-cube" },
	{ name: "Draco Compressed GLTF", href: "./draco-gltf" },
	{ name: "Skybox JPG HDR", href: "./skybox-jpghdr" },
	{ name: "3D Text", href: "./text" },
	{ name: "Lightmap Chair", href: "./chair" },
	{ name: "Two cubes", href: "./two-cubes" },
	{ name: "Two cubes (HTML)", href: "./two-cubes-html" },
	{ name: "Data texture", href: "./data-texture" },
	{ name: "Camera projection", href: "./camera-projection" },
	{ name: "Scan viewer", href: "./scan-viewer" },
	{ name: "Cone", href: "./cone" },
];
</script>

<nav>
	<button class="title" on:click={toggleMenu}>
		<span class="toggle" class:collapsed={!menuOpened}>&gt;</span>
		examples
	</button>
	<ul class:collapsed={!menuOpened}>
		{#each links as link}
			{#if window.location.pathname === link.href.substring(1)}
				<li class="current">{link.name}</li>
			{:else}
				<li><a href={link.href}>{link.name}</a></li>
			{/if}
		{/each}
	</ul>
</nav>

<style>
	nav {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 2;
		width: 220px;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: Arial, sans-serif;
		font-size: 0.85rem;
		color: #cfcfcf;
		background-color: #252525;
	}
	button.title {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: none;
		background: none;
		border: none;
		border-bottom: 1px solid #393939;
		color: inherit;
		font: inherit;
		padding: 6px 8px;
		cursor: pointer;
	}
	.toggle {
		display: inline-block;
		transform: rotate(90deg);
		font-family: monospace;
	}
	.toggle.collapsed {
		transform: rotate(0deg);
	}
	ul {
		margin: 0;
		padding: 4px 0;
		list-style: none;
		min-height: 0;
		overflow-y: auto;
	}
	ul.collapsed {
		display: none;
	}
	li {
		padding: 3px 10px 3px 22px;
	}
	li a {
		color: inherit;
		text-decoration: none;
	}
	li a:hover {
		color: white;
	}
	.current {
		color: white;
	}
</style>
