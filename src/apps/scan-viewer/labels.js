import { create, multiply } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec4.js";

/**
 * @typedef {Object} LabelStyle resolved CSS values, for example from getComputedStyle on a probe element
 * @property {string} [font] CSS font shorthand in CSS px
 * @property {string} [color] CSS color
 */

/**
 * @typedef {Object} Label
 * @property {string} text
 * @property {string} [id] keeps the placement state between frames, default the text
 * @property {ArrayLike<number>} [position] data coordinates (real units), projected with the camera
 * @property {ArrayLike<number>} [screen] fixed CSS px from the top left corner, used without a position
 * @property {"left" | "center" | "right" | "auto"} [align] point of the text box on the anchor, default "left"
 * @property {"top" | "middle" | "bottom" | "auto"} [baseline] point of the text box on the anchor, default "middle"
 * @property {ArrayLike<number> | "center"} [outwardFrom] data point or screen center the auto anchors point away from, default "center"
 * @property {number} [distance] CSS px between that text point and the anchor, toward the text, default 0
 * @property {boolean} [keepInView] switch sides away from the screen edges, hide when the anchor leaves the view, default true
 * @property {LabelStyle} [style] overrides the default style
 * @property {string} [badge] CSS color of a filled circle drawn behind the text
 */

/**
 * @typedef {Object} LabelView how data coordinates reach the screen, as for the WebGL programs
 * @property {ArrayLike<number>} projection
 * @property {ArrayLike<number>} view
 * @property {ArrayLike<number>} model data axes to world axes
 * @property {ArrayLike<number>} origin scene origin subtracted from data coordinates, in double precision
 * @property {number} zScale
 */

/**
 * @typedef {Object} PlacedLabel
 * @property {string} text
 * @property {string} font
 * @property {string} color
 * @property {number} x left of the text box, CSS px
 * @property {number} y top of the text box, CSS px
 * @property {number} width
 * @property {number} height
 * @property {number} ascent
 * @property {string} [badge]
 */

/**
 * @typedef {Map<string, { autoX: number, autoY: number, x: number, y: number }>} LabelMemory
 * side of each label on each axis at the previous layout: 1 toward +x / +y (down), -1 toward -x / -y, 0 centered
 */

// Auto middle zone: within 10% of the screen dimension from the reference, a zone 20% of the screen wide.
const middleZone = 0.1;
const middleHysteresis = 0.02;
// CSS px of room needed before a label switched away from an edge goes back to its wanted side.
const edgeHysteresis = 8;

const alignSigns = { left: 1, center: 0, right: -1 };
const baselineSigns = { top: 1, middle: 0, bottom: -1 };

const clip = [0, 0, 0, 0];
const point = [0, 0, 0, 1];
const metrics = new Map();

/** Call when a font finishes loading: the cached sizes were measured with the fallback font. */
export function clearLabelMetrics() {
	metrics.clear();
}

/**
 * Sizes the label canvas like the WebGL canvas, clears it and sets CSS px drawing.
 * @param {HTMLCanvasElement} labelCanvas
 * @param {HTMLCanvasElement} glCanvas
 * @returns {{ context: CanvasRenderingContext2D, viewport: [number, number] }} viewport in CSS px
 */
export function prepareLabelCanvas(labelCanvas, glCanvas) {
	const { width, height } = glCanvas;
	if (labelCanvas.width !== width || labelCanvas.height !== height) {
		labelCanvas.width = width;
		labelCanvas.height = height;
	}
	const context = labelCanvas.getContext("2d");
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, width, height);
	const pixelRatio = width / (glCanvas.clientWidth || width);
	context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	return { context, viewport: [width / pixelRatio, height / pixelRatio] };
}

/**
 * Places the labels: projection, auto anchors, sides switched away from the screen edges.
 * The placement never covers the anchor point and never crosses a screen edge when the text fits.
 * @param {CanvasRenderingContext2D} context used to measure the text
 * @param {Label[]} labels
 * @param {LabelView} labelView
 * @param {[number, number]} viewport CSS px
 * @param {Required<LabelStyle>} defaultStyle
 * @param {LabelMemory} memory updated in place
 * @returns {PlacedLabel[]}
 */
export function layoutLabels(context, labels, labelView, viewport, defaultStyle, memory) {
	const project = createProjector(labelView, viewport);
	const [width, height] = viewport;
	const placed = [];
	const seen = new Set();

	for (const label of labels) {
		const anchor = label.position ? project(label.position) : label.screen;
		const keepInView = label.keepInView ?? true;
		if (!anchor || (keepInView && !inside(anchor, viewport))) {
			continue;
		}
		const id = label.id ?? label.text;
		seen.add(id);
		const previous = memory.get(id);
		const font = label.style?.font ?? defaultStyle.font;
		const { width: textWidth, height: textHeight, ascent } = measure(context, font, label.text);

		const outward =
			label.outwardFrom == null || label.outwardFrom === "center"
				? [width / 2, height / 2]
				: (project(label.outwardFrom) ?? [width / 2, height / 2]);
		const autoX = autoSign(anchor[0] - outward[0], width, previous?.autoX);
		const autoY = autoSign(anchor[1] - outward[1], height, previous?.autoY);
		const wantedX = label.align === "auto" ? autoX : alignSigns[label.align ?? "left"];
		const wantedY = label.baseline === "auto" ? autoY : baselineSigns[label.baseline ?? "middle"];

		const [offsetX, offsetY] = distanceOffsets(label.distance ?? 0, wantedX, wantedY);
		const x = keepInView ? resolveAxis(anchor[0], textWidth, width, wantedX, offsetX, previous?.x) : wantedX;
		const y = keepInView ? resolveAxis(anchor[1], textHeight, height, wantedY, offsetY, previous?.y) : wantedY;
		memory.set(id, { autoX, autoY, x, y });

		const [finalOffsetX, finalOffsetY] = distanceOffsets(label.distance ?? 0, x, y);
		placed.push({
			text: label.text,
			font,
			color: label.style?.color ?? defaultStyle.color,
			x: boxStart(anchor[0], textWidth, x, finalOffsetX),
			y: boxStart(anchor[1], textHeight, y, finalOffsetY),
			width: textWidth,
			height: textHeight,
			ascent,
			...(label.badge && { badge: label.badge }),
		});
	}
	for (const id of memory.keys()) {
		if (!seen.has(id)) {
			memory.delete(id);
		}
	}
	return placed;
}

/**
 * @param {CanvasRenderingContext2D} context from prepareLabelCanvas
 * @param {PlacedLabel[]} placed
 */
export function drawPlacedLabels(context, placed) {
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	for (const { text, font, color, x, y, width, height, ascent, badge } of placed) {
		if (badge) {
			context.fillStyle = badge;
			context.beginPath();
			context.arc(x + width / 2, y + height / 2, Math.max(width, height) / 2 + 3, 0, 2 * Math.PI);
			context.fill();
		}
		context.font = font;
		context.fillStyle = color;
		// Whole CSS px keep the glyphs on the pixel grid.
		context.fillText(text, Math.round(x), Math.round(y + ascent));
	}
}

/**
 * Data coordinates to CSS px, with the matrices of this frame.
 * @param {LabelView} labelView
 * @param {[number, number]} viewport CSS px
 * @returns {(position: ArrayLike<number>) => [number, number] | null} null behind the camera
 */
export function createProjector({ projection, view, model, origin, zScale }, [width, height]) {
	const modelViewProjection = create();
	multiply(modelViewProjection, projection, view);
	multiply(modelViewProjection, modelViewProjection, model);
	return function project(position) {
		point[0] = position[0] - origin[0];
		point[1] = position[1] - origin[1];
		point[2] = (position[2] - origin[2]) * zScale;
		transformMat4(clip, point, modelViewProjection);
		if (clip[3] <= 0) {
			return null;
		}
		return [(clip[0] / clip[3] + 1) * 0.5 * width, (1 - clip[1] / clip[3]) * 0.5 * height];
	};
}

/**
 * Drops the labels overlapping one kept before them: earlier labels win.
 * @param {PlacedLabel[]} placed
 * @param {number} [padding] CSS px kept free around each label
 * @returns {PlacedLabel[]}
 */
export function hideOverlaps(placed, padding = 2) {
	const kept = [];
	for (const label of placed) {
		const overlaps = kept.some(
			(other) =>
				label.x < other.x + other.width + padding &&
				other.x < label.x + label.width + padding &&
				label.y < other.y + other.height + padding &&
				other.y < label.y + label.height + padding,
		);
		if (!overlaps) {
			kept.push(label);
		}
	}
	return kept;
}

function inside([x, y], [width, height]) {
	return x >= 0 && x <= width && y >= 0 && y <= height;
}

// Font box metrics, the same for every text of a font, so labels of one row line up.
function measure(context, font, text) {
	const key = `${font}\n${text}`;
	let entry = metrics.get(key);
	if (!entry) {
		// Ruler texts change with the zoom: keep the cache bounded.
		if (metrics.size > 2000) {
			metrics.clear();
		}
		context.font = font;
		const measured = context.measureText(text);
		const ascent = measured.fontBoundingBoxAscent ?? measured.actualBoundingBoxAscent;
		const descent = measured.fontBoundingBoxDescent ?? measured.actualBoundingBoxDescent;
		entry = { width: measured.width, height: ascent + descent, ascent };
		metrics.set(key, entry);
	}
	return entry;
}

// Side away from the reference, centered inside the middle zone; the zone edge moves with the previous side.
function autoSign(delta, dimension, previous) {
	const zone = dimension * (middleZone + (previous === 0 ? middleHysteresis : -middleHysteresis));
	if (Math.abs(delta) < zone) {
		return 0;
	}
	return delta > 0 ? 1 : -1;
}

// The distance is measured from the anchor to the text box point, diagonally for a corner.
function distanceOffsets(distance, signX, signY) {
	const length = Math.hypot(signX, signY) || 1;
	return [(distance * Math.abs(signX)) / length, (distance * Math.abs(signY)) / length];
}

function boxStart(anchor, size, sign, offset) {
	if (sign > 0) {
		return anchor + offset;
	}
	if (sign < 0) {
		return anchor - offset - size;
	}
	return anchor - size / 2;
}

/**
 * Side of the text on one axis: the wanted one, or the side away from the edge it would cross.
 * A side switched away from an edge is kept until the wanted side fits with some room.
 */
function resolveAxis(anchor, size, limit, wanted, offset, previous) {
	const fits = (sign, margin) => {
		const start = boxStart(anchor, size, sign, offset);
		return start >= margin && start + size <= limit - margin;
	};
	if (previous !== undefined && previous !== wanted && fits(previous, 0) && !fits(wanted, edgeHysteresis)) {
		return previous;
	}
	if (fits(wanted, 0)) {
		return wanted;
	}
	const away = boxStart(anchor, size, wanted, offset) < 0 ? 1 : -1;
	if (fits(away, 0)) {
		return away;
	}
	// Fits on neither side: the side with more room.
	return limit - anchor - offset >= anchor - offset ? 1 : -1;
}
