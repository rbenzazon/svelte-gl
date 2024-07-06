import AGXShader from "../shaders/agx-tone-mapping.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
export const createAGXToneMapping = (props) => {
	return {
		exposure: `${props.exposure.toLocaleString("en", { minimumFractionDigits: 1 })}f`,
		shader: (segment) => templateLiteralRenderer(segment, AGXShader),
	};
};
