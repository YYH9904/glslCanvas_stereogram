#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
// uniform sampler2D u_tex0; // Camo - No longer needed
uniform sampler2D u_tex1; // Depth

// --- Parameters ---
const float TILES = 8.0;
const float DEPTH_POWER = 0.05;

// --- M90 Camouflage Generation ---
// Helper function for pseudo-randomness
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// M90 color palette
const vec3 M90_BLACK = vec3(0.13, 0.13, 0.13);
const vec3 M90_DARK_GREEN = vec3(0.20, 0.29, 0.18);
const vec3 M90_LIGHT_GREEN = vec3(0.49, 0.58, 0.35);
const vec3 M90_KHAKI = vec3(0.71, 0.69, 0.54);

// Function to generate the M90 pattern color for a given UV
vec4 m90(vec2 uv) {
    uv *= 10.0; // Scale the pattern

    vec2 id = floor(uv);
    vec2 gv = fract(uv);

    // Create 4 rotated and offset grids to form the angular shapes
    vec4 n;
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        // Rotate grid
        vec2 nuv = uv + fi * 2.5;
        nuv *= mat2(0.707, -0.707, 0.707, 0.707); // Rotate 45 degrees
        // Get cell ID and random value
        vec2 nid = floor(nuv);
        n[i] = rand(nid);
    }

    // Use the random values to create stepped color fields
    float c = step(0.2, n.x) + step(0.4, n.y) + step(0.6, n.z) + step(0.8, n.w);

    // Select color from palette based on the combined fields
    vec3 color = M90_KHAKI;
    if (c > 0.5) color = M90_LIGHT_GREEN;
    if (c > 1.5) color = M90_DARK_GREEN;
    if (c > 2.5) color = M90_BLACK;

    return vec4(color, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float tileWidth = 1.0 / TILES;

    // This is our starting point for the color calculation.
    vec2 stereoUv = uv;

    // We loop, moving left by one tile-width each time, until we are in the first tile.
    // This simulates the recursive dependency of the stereogram.
    for (int i = 0; i < 10; i++) { // Loop a few more times than TILES just to be safe.
        if (stereoUv.x < tileWidth) {
            break;
        }

        // --- Depth Map Smoothing ---
        // The key is to blur the depth lookup. This prevents sharp changes in depth 
        // from creating hard edges in the final image, which would reveal the depth map.
        // We sample the depth map in a small 2x2 grid and average the results.
        vec2 pixel = 1.0 / u_resolution;
        float depth = 0.0;
        depth += texture2D(u_tex1, stereoUv).r;
        depth += texture2D(u_tex1, stereoUv + vec2(pixel.x, 0.0)).r;
        depth += texture2D(u_tex1, stereoUv + vec2(0.0, pixel.y)).r;
        depth += texture2D(u_tex1, stereoUv + vec2(pixel.x, pixel.y)).r;
        depth /= 4.0;

        float shift = depth * DEPTH_POWER;
        stereoUv.x -= (tileWidth - shift);
    }

    // Once we've found the "source" pixel in the first tile, we get its color from the camo pattern.
    gl_FragColor = m90(stereoUv);
}