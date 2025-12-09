#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // [新用途] 這是你的扇葉圖 (Blade Texture)
uniform sampler2D u_tex1; // 這是手的深度圖 (Hand Depth)

// --- [參數調校區] ---
const float SCALE = 6.0;      // 風機大小 (數值越小風機越大)
const float STRENGTH = 0.04;  // 深度強度
const float REPEATS = 5.0;    // 重複次數 (決定視差寬度)
const float BLUR_RADIUS = 12.0;

// --- 工具：隨機雜訊 (背景質感) ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// --- 工具：2D 旋轉 ---
// 用來旋轉 UV 座標
vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
}

// --- 高斯模糊深度 ---
float getGaussianBlur(sampler2D tex, vec2 uv) {
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
    float screenAspect = u_resolution.x / u_resolution.y;
    
    // 1. 處理隱藏深度 (手)
    vec2 depthUV = st;
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5;
    
    float d = 0.0;
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        float rawDepth = getGaussianBlur(u_tex1, depthUV);
        d = smoothstep(0.1, 0.9, rawDepth);
    }
    
    // 2. Stereogram 偏移計算
    float shift = d * STRENGTH;
    
    vec2 tileUV = st;
    tileUV.x *= screenAspect;
    tileUV.x *= REPEATS; 
    tileUV.x -= shift * REPEATS; // 加入視差
    
    // --- [核心邏輯] 無限陣列 + 圖片旋轉 ---
    
    // 建立網格
    vec2 gridUV = tileUV * (SCALE / REPEATS); 
    
    // 交錯排列 (讓每一行錯開，更有自然感)
    float row = floor(gridUV.y);
    if(mod(row, 2.0) > 0.5) {
        gridUV.x += 0.5;
    }
    
    vec2 cellID = floor(gridUV);      // 每一格的編號
    vec2 cellUV = fract(gridUV);      // 每一格內部的 UV (0.0 ~ 1.0)
    
    // 計算旋轉
    // cellID.x 讓不同行的風機轉動相位不同 (不要全部同步，太假)
    float angle = u_time * 2.0 + cellID.x; 
    
    // 旋轉 UV
    // 這裡我們只旋轉 UV，不旋轉圖片本身，效果是一樣的
    vec2 rotatedBladeUV = rotateUV(cellUV, angle);
    
    // 讀取你的扇葉圖 (u_tex0)
    // 這裡讀取紅色通道 (.r) 作為遮罩，因為你的圖是黑白的
    float bladeMask = texture2D(u_tex0, rotatedBladeUV).r;
    
    // 修整邊緣：如果旋轉後超出範圍，裁切掉 (避免看到鄰居的圖)
    // 或是因為你的圖背景是黑的，這步可能不需要，視情況而定
    if(rotatedBladeUV.x < 0.0 || rotatedBladeUV.x > 1.0 || rotatedBladeUV.y < 0.0 || rotatedBladeUV.y > 1.0) {
        bladeMask = 0.0;
    }

    // 繪製塔柱 (Pole) - 塔柱不需要旋轉，所以用原本的 cellUV
    // 簡單畫一條垂直線在下方
    float poleMask = step(abs(cellUV.x - 0.5), 0.02) * step(cellUV.y, 0.5);
    
    // 合併形狀
    float shape = max(bladeMask, poleMask);

    // --- 3. 上色與合成 (Aesthetic) ---
    
    // 背景雜訊 (Stereogram 必需)
    float noise = random(tileUV * 100.0);
    
    // 背景色：夢幻的漸層 (洋紅 -> 深藍)
    vec3 skyColor = vec3(0.7, 0.5, 0.6); 
    vec3 seaColor = vec3(0.1, 0.25, 0.4);
    vec3 bgColor = mix(seaColor, skyColor, st.y + noise*0.15);
    
    // 風機顏色 (白/青光)
    vec3 turbineColor = vec3(0.9, 0.95, 1.0);
    
    // 混合
    vec3 finalColor = mix(bgColor, turbineColor, shape);
    
    // 疊加雜訊質感
    finalColor += (noise - 0.5) * 0.12;

    gl_FragColor = vec4(finalColor, 1.0);
}