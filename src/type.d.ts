declare type mat2Array = [number, number, number, number];
declare type mat3Array = [number, number, number, number, number, number, number, number, number];
declare type mat4Array = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];
declare type vec2Array = [number, number];
declare type vec3Array = [number, number, number];
declare type vec4Array = [number, number, number, number];

declare type TypedArray =
	| Float32Array
	| Float64Array
	| Int8Array
	| Int16Array
	| Int32Array
	| Uint8Array
	| Uint16Array
	| Uint32Array;
declare type mat4Typed = TypedArray & { length: 16 };
declare type mat3Typed = TypedArray & { length: 9 };
declare type mat2Typed = TypedArray & { length: 4 };

declare type vec4Typed = TypedArray & { length: 4 };
declare type vec3Typed = TypedArray & { length: 3 };
declare type vec2Typed = TypedArray & { length: 2 };

declare type mat2 = mat2Typed | mat2Array;
declare type mat3 = mat3Typed | mat3Array;
declare type mat4 = mat4Typed | mat4Array;
declare type vec2 = vec2Typed | vec2Array;
declare type vec3 = vec3Typed | vec3Array;
declare type vec4 = vec4Typed | vec4Array;
