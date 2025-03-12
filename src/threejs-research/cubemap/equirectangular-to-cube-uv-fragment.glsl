layout(location = 0) out highp vec4 pc_fragColor;
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp samplerCube;
precision highp sampler3D;
precision highp sampler2DArray;
precision highp sampler2DShadow;
precision highp samplerCubeShadow;
precision highp sampler2DArrayShadow;
precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;
precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
vec3( 0.8224621, 0.177538, 0.0 ), vec3( 0.0331941, 0.9668058, 0.0 ), vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
vec3( 1.2249401, - 0.2249404, 0.0 ), vec3( - 0.0420569, 1.0420571, 0.0 ), vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
    return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
    return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
    return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
    return value;
}
vec4 LinearTosRGB( in vec4 value ) {
    return sRGBTransferOETF( value );
}
vec4 linearToOutputTexel( vec4 value ) {
    return ( LinearTransferOETF( value ) );
}
precision mediump float;
precision mediump int;
in vec3 vOutputDirection;
uniform sampler2D envMap;
float pow2( const in float x ) {
    return x*x;
}
vec3 pow2( const in vec3 x ) {
    return x*x;
}
float pow3( const in float x ) {
    return x*x*x;
}
float pow4( const in float x ) {
    float x2 = x*x;
    return x2*x2;
}
float max3( const in vec3 v ) {
    return max( max( v.x, v.y ), v.z );
}
float average( const in vec3 v ) {
    return dot( v, vec3( 0.3333333 ) );
}
highp float rand( const in vec2 uv ) {
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot( uv.xy, vec2( a, b ) ), sn = mod( dt, 3.141592653589793 );
    return fract( sin( sn ) * c );
}
float precisionSafeLength( vec3 v ) {
    return length( v );
}
struct IncidentLight {
    vec3 color;
    vec3 direction;
    bool visible;
};
struct ReflectedLight {
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
};
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
    return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
    return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
    mat3 tmp;
    tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
    tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
    tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
    return tmp;
}
float luminance( const in vec3 rgb ) {
    const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
    return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
    return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
    float u = atan( dir.z, dir.x ) * 0.15915494309189535 + 0.5;
    float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * 0.3183098861837907 + 0.5;
    return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
    return 0.3183098861837907 * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
    float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
    return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
    float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
    return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
void main() {
    vec3 outputDirection = normalize( vOutputDirection );
    vec2 uv = equirectUv( outputDirection );
    pc_fragColor = vec4( texture ( envMap, uv ).rgb, 1.0 );
}