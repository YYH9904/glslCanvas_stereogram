#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

// [紋理定義更新]
uniform sampler2D u_tex0; // 背景風景照 (Landscape BG)
uniform sampler2D u_tex1; // 手的深度圖 (Hand Depth)
uniform sampler2D u_tex2; // 扇葉貼圖 (Blade Texture)

// --- [參數調校區] ---
const float SCALE = 6.0;      // 風機大小
const float STRENGTH = 0.04;  // 深度強度
const float REPEATS = 5.0;    // Stereogram 重複次數

// [關鍵] 背景模糊程度
// 數值越大越模糊。試試 32.0, 64.0 甚至 128.0
const float BG_BLUR_RADIUS = 64.0; 

// 深度圖的模糊 (維持小一點即可)
const float DEPTH_BLUR_RADIUS = 8.0;

// --- 工具：隨機雜訊 (增加顆粒感) ---
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// --- 工具：2D UV 旋轉 ---
vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
}

// --- 通用高斯模糊函式 (可指定半徑) ---
// 我們用這個函式來模糊背景，也用來模糊深度圖
vec4 getGaussianBlur(sampler2D tex, vec2 uv, float radius) {
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    vec2 pixelSize = 1.0 / vec2(512.0, 512.0); // 假設貼圖尺寸
    
    // 採樣範圍隨半徑調整 (半徑越大，採樣點要越開)
    // 這裡為了效能，我們固定採樣點數量，但拉大間距
    float stepSize = radius / 4.0; 
    
    for (float x = -2.0; x <= 2.0; x+=1.0) {
        for (float y = -2.0; y <= 2.0; y+=1.0) {
            // 計算偏移量 (拉大間距以達到大模糊效果)
            vec2 offset = vec2(x, y) * stepSize * pixelSize;
            
            // 簡單的高斯權重 (距離中心越遠權重越小)
            float weight = exp(-(x*x + y*y) / 2.0);
            
            color += texture2D(tex, uv + offset) * weight;
            totalWeight += weight;
        }
    }
    return color / totalWeight;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float screenAspect = u_resolution.x / u_resolution.y;
    
    // --- 1. 準備背景 ---
    // 對背景圖 (u_tex0) 進行極致模糊
    // 我們使用 tileUV (已重複過的座標) 來取樣背景，這樣背景也會跟著重複
    // 鏡像邏輯在這裡依然適用，確保背景無縫
    vec2 bgUV = st;
    bgUV.x *= screenAspect;
    bgUV.x *= REPEATS;
    if (mod(floor(bgUV.x), 2.0) > 0.5) bgUV.x = 1.0 - fract(bgUV.x);
    else bgUV.x = fract(bgUV.x);
    
    // 採樣並模糊
    vec4 bgColor = getGaussianBlur(u_tex0, bgUV, BG_BLUR_RADIUS);
    
    // 加入一點雜訊顆粒，避免模糊後太過平滑導致無法對焦
    float noise = random(st * 100.0 + u_time); // 加入時間讓雜訊閃爍
    bgColor.rgb += (noise - 0.5) * 0.1;

    // --- 2. 處理隱藏深度 (手) ---
    vec2 depthUV = st;
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5;
    float d = 0.0;
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        // 深度圖只需輕微模糊
        d = smoothstep(0.1, 0.9, getGaussianBlur(u_tex1, depthUV, DEPTH_BLUR_RADIUS).r);
    }
    
    // --- 3. Stereogram 偏移與風機繪製 ---
    float shift = d * STRENGTH;
    vec2 tileUV = st;
    tileUV.x *= screenAspect;
    tileUV.x *= REPEATS; 
    tileUV.x -= shift * REPEATS; // 加入視差
    
    // 無限網格邏輯
    vec2 gridUV = tileUV * (SCALE / REPEATS); 
    float row = floor(gridUV.y);
    if(mod(row, 2.0) > 0.5) gridUV.x += 0.5; // 交錯排列
    vec2 cellID = floor(gridUV);
    vec2 cellUV = fract(gridUV);
    
    // 旋轉與採樣扇葉圖 (u_tex2)
    float angle = u_time * 1.5 + cellID.x + cellID.y; // 增加一點隨機性
    vec2 rotatedBladeUV = rotateUV(cellUV, angle);
    // 讀取扇葉圖的紅色通道作為遮罩
    float bladeMask = texture2D(u_tex2, rotatedBladeUV).r;
    
    // 簡單塔柱
    float poleMask = step(abs(cellUV.x - 0.5), 0.03) * step(cellUV.y, 0.5);
    float turbineShape = max(bladeMask, poleMask);
    
    // --- 4. 最終合成 ---
    // 風機顏色：選一個跟背景對比強烈的顏色 (例如亮白或青色)
    vec3 turbineColor = vec3(0.95, 1.0, 1.0); 
    
    // 使用風機形狀作為遮罩，混合背景色與風機色
    vec3 finalColor = mix(bgColor.rgb, turbineColor, turbineShape);

    gl_FragColor = vec4(finalColor, 1.0);
}