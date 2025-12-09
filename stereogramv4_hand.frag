#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Texture (Wind Turbines)
uniform sampler2D u_tex1; // Depth (The Hand)

// --- 參數調校區 ---
// 1. 深度強度：因為手很大，設太大眼睛會無法對焦。
// 如果覺得立體感不夠，可以改為 0.05；如果眼睛痛，改為 0.03。
const float STRENGTH = 0.04; 

// 2. 重複次數：這決定了「兩眼視差」的距離。
// 針對 1:1 的圖，6.0 是一個通常比較舒適的數值。
const float REPEATS = 4.0;

// 3. 深度模糊：這是防止照片產生「撕裂」的關鍵。
// 數值越高，手的邊緣越圓潤，照片越不會破圖。
const float BLUR_RADIUS = 12.0; 

// --- 高斯模糊函式 ---
float getGaussianBlur(sampler2D tex, vec2 uv) {
    float color = 0.0;
    float totalWeight = 0.0;
    vec2 pixelSize = 1.0 / vec2(512.0, 512.0); // 假設貼圖解析度
    
    // 採樣 5x5 區域
    for (float x = -2.0; x <= 2.0; x++) {
        for (float y = -2.0; y <= 2.0; y++) {
            vec2 offset = vec2(x, y) * BLUR_RADIUS * pixelSize;
            // 高斯權重分佈
            float weight = exp(-(x*x + y*y) / 4.0);
            color += texture2D(tex, uv + offset).r * weight;
            totalWeight += weight;
        }
    }
    return color / totalWeight;
}

void main() {
    // 1. 取得螢幕座標 (0.0 ~ 1.0)
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 2. 修正長寬比 (保持圓形是圓的)
    float screenAspect = u_resolution.x / u_resolution.y;
    
    // --- 處理深度圖 (隱藏資訊) ---
    vec2 depthUV = st;
    // 讓深度圖保持置中，不隨視窗變形
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5;
    
    float d = 0.0;
    // 邊界檢查：只在畫面中間讀取深度
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        // 讀取模糊後的深度，並增強對比 (讓手更凸出)
        float rawDepth = getGaussianBlur(u_tex1, depthUV);
        d = smoothstep(0.1, 0.9, rawDepth); // 增加深度圖的對比度
    }
    
    // --- Stereogram 核心算法 ---
    // 計算偏移量：深度越深，像素往右移越多
    float shift = d * STRENGTH;
    
    // 處理紋理鋪貼 (Tiling)
    vec2 tileUV = st;
    tileUV.x *= screenAspect; // 修正紋理比例
    tileUV.x *= REPEATS;      // 重複紋理
    
    // [關鍵] 加入視差偏移
    tileUV.x -= shift * REPEATS; 
    
    // 取小數點 (形成循環圖樣)
    tileUV = fract(tileUV);
    
    // --- 輸出顏色 ---
    vec4 color = texture2D(u_tex0, tileUV);
    
    // 可選：加入一點微弱的雜訊，幫助眼睛在平滑區域對焦
    // float noise = fract(sin(dot(tileUV, vec2(12.9898, 78.233))) * 43758.5453);
    // color.rgb += (noise - 0.5) * 0.05; 
    
    gl_FragColor = color;
}