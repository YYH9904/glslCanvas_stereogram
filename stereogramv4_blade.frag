#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Camo (Surface)
uniform sampler2D u_tex1; // Depth (Hidden Truth)

// --- [TUNING BOARD] ---
const float STRENGTH = 0.045;   // Depth magnitude (Lower = easier on eyes)
const float REPEATS = 6.0;      // Pattern repetition
const float NOISE_AMT = 0.15;   // Noise grain strength

// [CRITICAL] BLUR STRENGTH
// 0.0 = Sharp edges (Tearing)
// 5.0 - 10.0 = Smooth slopes (Good Stereogram)
// Increase this if you still see cuts!
const float BLUR_RADIUS = 8.0; 

// --- UTILS: Random Noise ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// --- UTILS: Gaussian Blur ---
// We use a weighted loop to average pixels around the target.
// This turns "cliffs" in your depth map into "hills".
float getGaussianBlur(sampler2D tex, vec2 uv, vec2 resolution) {
    float color = 0.0;
    float totalWeight = 0.0;
    
    // Calculate size of one pixel based on the texture size (assuming 512x512)
    // or screen resolution. Let's use resolution for sharpness relative to screen.
    vec2 pixelSize = 1.0 / vec2(512.0, 512.0); 
    
    // A simplified Gaussian Kernel loop
    // We check 5x5 grid around the pixel
    for (float x = -2.0; x <= 2.0; x++) {
        for (float y = -2.0; y <= 2.0; y++) {
            // Determine coordinate offset
            vec2 offset = vec2(x, y) * BLUR_RADIUS * pixelSize;
            
            // Calculate Weight (Center is heavy, edges are light)
            // This 'Gaussian' bell curve formula ensures smooth gradients
            float weight = exp(-(x*x + y*y) / 4.0);
            
            color += texture2D(tex, uv + offset).r * weight;
            totalWeight += weight;
        }
    }
    
    return color / totalWeight;
}

void main() {
    // 1. Normalized Screen Coordinates
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 2. Aspect Ratio Correction (No Deformation)
    float screenAspect = u_resolution.x / u_resolution.y;
    vec2 depthUV = st;
    
    // Fix X-stretch (Keep circles circular)
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5; // Center
    
    // 3. Sample Depth (With Gaussian Blur)
    float d = 0.0;
    // Check bounds to avoid edge artifacts
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        d = getGaussianBlur(u_tex1, depthUV, u_resolution);
    }
    
    // 4. Parallax Shift
    float shift = d * STRENGTH;

    // 5. Tile the Surface
    vec2 tileUV = st;
    tileUV.x *= screenAspect; // Fix Pattern Aspect Ratio too
    tileUV.x *= REPEATS;
    tileUV.x -= shift * REPEATS; 
    tileUV = fract(tileUV);

    // 6. Sample Texture
    vec4 color = texture2D(u_tex0, tileUV);

    // 7. Trojan Noise Injection
    float noise = random(tileUV * 100.0);
    color.rgb = mix(color.rgb, vec3(noise), NOISE_AMT);

    gl_FragColor = color;
}