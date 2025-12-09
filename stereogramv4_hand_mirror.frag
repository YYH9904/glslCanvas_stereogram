#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Turbine Photo
uniform sampler2D u_tex1; // Hand Depth

// --- 參數調校 ---
const float STRENGTH = 0.04;
const float REPEATS = 4.0;      // 4.0 在正方形構圖中，風機大小會很剛好
const float BLUR_RADIUS = 12.0; // 柔化深度邊緣

// --- 高斯模糊函式 ---
float getGaussianBlur(sampler2D tex, vec2 uv) {
    float color = 0.0;
    float totalWeight = 0.0;
    // 使用 u_resolution 自動計算像素大小
    vec2 pixelSize = 1.0 / u_resolution.xy; 
    
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
    // 1. 標準化座標 (因為 HTML 強制正方形，所以不需要修正比例)
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 2. 處理深度圖 (手)
    // 稍微縮放一下深度圖 (1.1倍)，讓手不要貼到邊邊，構圖更完整
    vec2 depthUV = (st - 0.5) * 1.1 + 0.5;
    
    float d = 0.0;
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        float rawDepth = getGaussianBlur(u_tex1, depthUV);
        d = smoothstep(0.1, 0.9, rawDepth); 
    }
    
    // 3. Stereogram 核心計算
    float shift = d * STRENGTH;
    
    vec2 tileUV = st;
    tileUV.x *= REPEATS;
    tileUV.x -= shift * REPEATS; 
    
    // --- [關鍵] 鏡像邏輯 (消除照片接縫) ---
    float tileIndex = floor(tileUV.x);
    if (mod(tileIndex, 2.0) > 0.5) {
        tileUV.x = 1.0 - fract(tileUV.x); // 偶數格翻轉
    } else {
        tileUV.x = fract(tileUV.x);       // 奇數格正常
    }
    
    // 4. 輸出
    vec4 color = texture2D(u_tex0, tileUV);
    
    gl_FragColor = color;
}