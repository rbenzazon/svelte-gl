import AGXShader from "./agx-tone-mapping.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
/**
 *
 * @param {{exposure:number}} props
 * @returns {SvelteGLToneMapping}
 */
export const createAGXToneMapping = (props) => {
	return {
		exposure: `${props.exposure.toLocaleString("en", { minimumFractionDigits: 1 })}f`,
		shader: templateLiteralRenderer(AGXShader, {
			declaration: false,
			exposure: 1,
			color: false,
		}),
	};
};
