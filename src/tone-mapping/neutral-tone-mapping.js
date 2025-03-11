import AGXShader from "./neutral-tone-mapping.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
/**
 *
 * @param {{exposure:number}} props
 * @returns {SvelteGLToneMapping}
 */
export const createNeutralToneMapping = (props) => {
	return {
		exposure: `${props.exposure.toLocaleString("en", { minimumFractionDigits: 1 })}f`,
		shader: templateLiteralRenderer(AGXShader, {
			declaration: false,
			exposure: 1,
			color: false,
		}),
	};
};
