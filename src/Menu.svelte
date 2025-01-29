<script type="module">
let menuOpened = false;
function toggleMenu() {
	console.log("toggleMenu", menuOpened);
	menuOpened = !menuOpened;
}
const links = [
	{ name: "Normal map and specular", href: "./golf-ball" },
	{ name: "GLTF loader", href: "./" },
	{ name: "Obj loader", href: "./venus" },
	{ name: "Cube", href: "./cube" },
	{ name: "GLTF", href: "./gltf" },
	{ name: "Contact Shadow", href: "./contact-shadow" },
	{ name: "Transparency", href: "./transparency" },
	/*{ name: "Instances", href: "./instances" },*/
	{ name: "Matrix", href: "./matrix" },
	{ name: "Texture", href: "./texture" },
	{ name: "Lights", href: "./lights" },
	{ name: "Vertex Animation", href: "./vertex-anim" },
];
</script>
<button on:click={toggleMenu}>examples</button>
<ul class:menuOpened>
    {#each links as link}
        {#if window.location.pathname===link.href.substring(1)}
            <li class="current">{link.name}</li>
        {:else}
            <li><a href={link.href} >{link.name}</a></li>
        {/if}
    {/each}
</ul>
<style>
	button {
		position: relative;
		font-family: Arial;
		font-size: 20px;
		padding: 10px;
	}
	ul {
		position: relative;
		display:none;
		font-family: Arial;
		font-size: 20px;
		
	}
	li {
		padding: 10px;
		background-color: white;
		width: fit-content;
	}
	li a {
		text-decoration: none;
		color: black;
	}
	.menuOpened {
		display: block;
	}
    .current {
        color: red;
    }
</style>