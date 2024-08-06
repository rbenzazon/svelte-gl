function resolveIfdefs(shaderSource) {
	let defines = new Map();
	let output = [];
	let state = "none";
	threejsVertex.split("\n").forEach((line) => {
		const trimed = line.trim();
		if (trimed.startsWith("#define")) {
			const words = trimed.split(" ");
			defines.set(words[1], words[2]);
			output.push(line);
		} else if (trimed.startsWith("#ifdef")) {
			const words = trimed.split(" ");
			if (defines.has(words[1])) {
				console.log("found", words[1]);
				output.push(line);
			} else {
				state = "skip";
			}
		} else if (trimed.startsWith("#endif") && state === "skip") {
			state = "none";
		} else if (state !== "skip") {
			output.push(line);
		}
	});
	return output.join("\n");
}
