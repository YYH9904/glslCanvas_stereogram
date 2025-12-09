#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time; // 必須確保 HTML 有傳入 u_time
uniform sampler2D u_tex0; // Camo (Wind Texture)
uniform sampler2D u_tex1; // Depth (Hidden Hand/Blade)

// --- [AESTHETIC TUNING] ---
const float STRENGTH = 0.045;   // Depth Strength
const float REPEATS = 5.0;      // 稍微降低重複數，讓色塊看起來大一點
const float BLUR_RADIUS = 8.0;  // 保持你覺得不錯的模糊度

// 流動參數 (讓畫面像風一樣動)
const float FLOW_SPEED = 0.05;  // 流動速度
const float WAVE_AMP = 0.02;    // 波浪幅度

// --- UTILS ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 保持你的高斯模糊邏輯
float getGaussianBlur(sampler2D tex, vec2 uv, vec2 resolution) {
    float color = 0.0;
    float totalWeight = 0.0;
    vec2 pixelSize = 1.0 / vec2(512.0, 512.0); 
    for (float x = -2.0; x <= 2.0; x++) {
        for (float y = -2.0; y <= 2.0; y++) {
            vec2 offset = vec2(x, y) * BLUR_RADIUS * pixelSize;
            float weight = exp(-(x*x + y*y) / 4.0);
            color += texture2D(tex, uv + offset).r * weight;
            totalWeight += weight;
        }
    }
    return color / totalWeight;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 1. Aspect Ratio Correction
    float screenAspect = u_resolution.x / u_resolution.y;
    vec2 depthUV = st;
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5;
    
    // 2. Sample Depth (Blurred)
    float d = 0.0;
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        d = getGaussianBlur(u_tex1, depthUV, u_resolution);
    }
    
    // 3. Parallax Shift
    float shift = d * STRENGTH;

    // 4. Tiling & FLOW CALCULATION
    vec2 tileUV = st;
    tileUV.x *= screenAspect; 
    tileUV.x *= REPEATS;
    tileUV.x -= shift * REPEATS; // Apply Depth Shift
    
    // [關鍵修改]：在 Tiling 之前加入流動
    // 這不會影響立體感，因為它是對「底圖」的取樣做偏移
    vec2 flowUV = tileUV;
    
    // 讓紋理水平緩慢漂移 (Wind Drift)
    flowUV.x += u_time * FLOW_SPEED; 
    
    // 加入一點點垂直波浪 (Liquid feel)
    flowUV.y += sin(tileUV.x * 2.0 + u_time) * WAVE_AMP;

    // 鏡像重複 (Mirroring) 或是 直接重複 (Fract)
    // 為了讓水彩接縫不明顯，我們這裡嘗試用 fract
    // 如果你的貼圖是 seamless 的，這樣會很漂亮
    vec2 finalUV = fract(flowUV);

    // 5. Sample Texture
    vec4 color = texture2D(u_tex0, finalUV);

    // 6. Aesthetic Noise (Paper Grain)
    // 我們不直接 mix，而是用類似 Overlay 的算法
    // 讓它看起來像紙張的紋理，而不是電視雜訊
    float grain = random(finalUV * 400.0); // 高頻顆粒
    
    // 讓雜訊稍微偏暖或偏冷 (可選)，這裡我們只改變明度
    // 0.05 的強度非常低，只有質感，沒有雜訊感
    color.rgb += (grain - 0.5) * 0.08; 

    // 7. 增強夢幻感 (Dreamy Contrast)
    // 稍微提高對比度讓水彩暈染更明顯
    color.rgb = smoothstep(0.0, 1.0, color.rgb);

    gl_FragColor = color;
}