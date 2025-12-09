#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_depthTex; // The Hidden Hand

// --- [TUNING BOARD] ---
const float STRENGTH = 0.06;      // 深度的強度 (手的立體感)
const float REPEATS = 6.0;        // 風機重複的次數 (Eye separation factor)
const float TURBINE_SCALE = 4.0;  // 每個重複單元內有多少個風機 (密度)

// --- UTILS: SDF Shapes ---
// 旋轉函數 (用於葉片旋轉)
vec2 rotate(vec2 uv, float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c) * uv;
}

// 畫一根棍子 (風機塔身)
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

// 畫單個葉片 (水滴狀)
float sdBlade(vec2 p) {
    p.x = abs(p.x);
    // 簡單的葉片形狀模擬
    if(p.y < 0.0) return length(p); 
    return max(abs(p.x) - 0.1 * (1.0 - p.y*0.8), p.y - 1.2); 
}

// --- PROCEDURAL TEXTURE GENERATION ---
// 這裡生成 "表象"：整齊排列的風機陣列
vec3 getTurbinePattern(vec2 uv) {
    // 1. Grid Tiling
    vec2 gridUV = uv * TURBINE_SCALE;
    vec2 id = floor(gridUV);
    gridUV = fract(gridUV) - 0.5;
    
    // 錯位排列 (Hexagonal offset feel)
    if (mod(id.y, 2.0) > 0.5) {
        gridUV.x += 0.5; // 偶數行錯開
        if(gridUV.x > 0.5) gridUV.x -= 1.0;
    }

    // 2. Draw Turbine
    float color = 0.0;
    
    // 塔身 (Pole)
    float pole = sdBox(gridUV - vec2(0.0, -0.5), vec2(0.02, 0.5));
    
    // 葉片 (Rotor) - 中心點在 (0, 0.1)
    vec2 bladeUV = gridUV - vec2(0.0, 0.1);
    
    // 讓不同行的風機旋轉速度略有不同，打破完全的同步感
    float rotSpeed = u_time * 2.0 + id.x + id.y; 
    
    float blades = 1.0;
    for(int i=0; i<3; i++) {
        float angle = float(i) * 2.0944; // 120 degrees
        vec2 rotatedUV = rotate(bladeUV, rotSpeed + angle);
        // 葉片縮放
        float b = sdBlade(rotatedUV * 2.5); 
        blades = min(blades, b);
    }
    
    // 合併形狀 (SDF rendering)
    float shape = min(pole, blades);
    
    // Anti-aliasing / Soft edge
    float alpha = smoothstep(0.05, 0.01, shape);
    
    // 3. Coloring (Blueprint / Industrial Style)
    vec3 bg = vec3(0.1, 0.35, 0.5); // Deep Sea Blue / Blueprint Blue
    vec3 fg = vec3(0.9, 0.95, 1.0); // White/Cyan Turbines
    
    // 加入一點雜訊紋理 (Noise) 以增強 Stereogram 的對焦能力
    float noise = fract(sin(dot(uv.xy, vec2(12.9898,78.233))) * 43758.5453);
    bg += (noise - 0.5) * 0.1;

    return mix(bg, fg, alpha);
}

// --- GAUSSIAN BLUR (For Depth) ---
// 為了避免銳利的深度邊緣導致圖案撕裂 (Tearing)
float getSmoothedDepth(sampler2D tex, vec2 uv) {
    float d = 0.0;
    float total = 0.0;
    vec2 pixel = 1.0 / vec2(512.0); // 假設貼圖解析度
    float radius = 4.0;
    
    for(float x=-2.0; x<=2.0; x++) {
        for(float y=-2.0; y<=2.0; y++) {
            float w = exp(-(x*x + y*y)/4.0);
            d += texture2D(tex, uv + vec2(x,y)*pixel*radius).r * w;
            total += w;
        }
    }
    return d / total;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    
    // 1. Depth UV Correction
    vec2 depthUV = st;
    depthUV.x *= aspect;
    depthUV.x -= (aspect - 1.0) * 0.5; // Center
    
    // 2. Sample Depth Map (Hidden Truth)
    float d = 0.0;
    // 邊界檢查，避免重複邊緣
    if(depthUV.x > 0.0 && depthUV.x < 1.0) {
        d = getSmoothedDepth(u_depthTex, depthUV);
    }
    
    // 3. Parallax Calculation
    // 深度越深 (d大)，偏移量越大
    float shift = d * STRENGTH;
    
    // 4. Pattern Tiling Logic
    vec2 tileUV = st;
    tileUV.x *= aspect; // Correct aspect
    tileUV.x *= REPEATS; // Repeat pattern
    
    // [CRITICAL] Stereogram Logic
    // Shift the pattern lookup based on depth
    tileUV.x -= shift * REPEATS; 
    
    // 5. Generate Visuals
    // 這裡我們不讀取貼圖，而是直接計算風機圖案
    // 這樣可以確保解析度無限大，且可以動態控制
    vec3 color = getTurbinePattern(tileUV);
    
    // Vignette (Optional: 暗角讓畫面更壓抑)
    float vign = length(st - 0.5);
    color *= 1.0 - vign * 0.5;

    gl_FragColor = vec4(color, 1.0);
}