/**
 * @typedef {"POINTS"| "LINES"| "LINE_LOOP"| "LINE_STRIP"| "TRIANGLES"| "TRIANGLE_STRIP"| "TRIANGLE_FAN"} DrawMode
 */

/**
 * @type {Object.<number, DrawMode>}
 */
export const drawModes = {
	0: "POINTS",
	1: "LINES",
	2: "LINE_LOOP",
	3: "LINE_STRIP",
	4: "TRIANGLES",
	5: "TRIANGLE_STRIP",
	6: "TRIANGLE_FAN",
};
