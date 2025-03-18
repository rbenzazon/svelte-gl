const fs = require("fs");
const path = require("path");

const inputFilePath = path.join(__dirname, "cubemap/fragment-object.glsl");
const outputFilePath = path.join(__dirname, "cubemap/resolved-fragment-object.glsl");

// Read the input file
const shaderCode = fs.readFileSync(inputFilePath, "utf8");

// Split the shader code into lines
const lines = shaderCode.split("\n");

// Stack to handle nested preprocessor directives
const stack = [];
let outputLines = [];
let skipLines = false;
let definedSymbols = new Set();

// Function to evaluate #if and #elif conditions
function evaluateCondition(condition) {
	// Replace defined(X) with true or false
	condition = condition.replace(/defined\s*\(\s*(\w+)\s*\)/g, (match, symbol) => {
		return definedSymbols.has(symbol) ? "true" : "false";
	});

	// Replace symbols with true or false
	condition = condition.replace(/\b(\w+)\b/g, (match, symbol) => {
		if (!isNaN(symbol)) {
			return symbol; // Keep numbers unchanged
		}
		if (symbol === "true" || symbol === "false") {
			return symbol;
		}
		return definedSymbols.has(symbol) ? "true" : "false";
	});

	// Evaluate the condition as a boolean expression
	try {
		return !!eval(condition);
	} catch (e) {
		return false;
	}
}

lines.forEach((line) => {
	const trimmedLine = line.trim();

	if (trimmedLine.startsWith("#define")) {
		const parts = trimmedLine.split(/\s+/);
		const symbol = parts[1];
		definedSymbols.add(symbol);
		outputLines.push(line);
	} else if (trimmedLine.startsWith("#undef")) {
		const parts = trimmedLine.split(/\s+/);
		const symbol = parts[1];
		definedSymbols.delete(symbol);
		outputLines.push(line);
	} else if (trimmedLine.startsWith("#ifdef")) {
		const symbol = trimmedLine.split(/\s+/)[1];
		stack.push(skipLines);
		skipLines = skipLines || !definedSymbols.has(symbol);
	} else if (trimmedLine.startsWith("#ifndef")) {
		const symbol = trimmedLine.split(/\s+/)[1];
		stack.push(skipLines);
		skipLines = skipLines || definedSymbols.has(symbol);
	} else if (trimmedLine.startsWith("#if")) {
		const condition = trimmedLine.substring(3).trim();
		stack.push(skipLines);
		skipLines = skipLines || !evaluateCondition(condition);
	} else if (trimmedLine.startsWith("#elif")) {
		const condition = trimmedLine.substring(5).trim();
		if (stack.length > 0 && stack[stack.length - 1]) {
			skipLines = true;
		} else {
			skipLines = !evaluateCondition(condition);
		}
	} else if (trimmedLine.startsWith("#else")) {
		if (stack.length > 0 && stack[stack.length - 1]) {
			skipLines = true;
		} else {
			skipLines = !skipLines;
		}
	} else if (trimmedLine.startsWith("#endif")) {
		if (stack.length > 0) {
			skipLines = stack.pop();
		}
	} else {
		if (!skipLines) {
			outputLines.push(line);
		}
	}
});

// Write the resolved shader code to the output file
fs.writeFileSync(outputFilePath, outputLines.join("\n"), "utf8");

console.log(`Resolved shader written to ${outputFilePath}`);
