#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex1; // 只需讀取深度圖 (手)

// --- [參數調校區] ---

// 1. 陣列密度：數字越大，風機越多、越小
const float SCALE = 8.0; 

// 2. 深度強度：控制手凸出的程度
const float STRENGTH = 0.04;

// 3. 重複次數：控制雙眼視差的寬度 (Stereogram 難度)
const float REPEATS = 5.0;

// 4. 深度模糊：讓手的邊緣圓潤，避免破圖
const float BLUR_RADIUS = 12.0;

// --- 工具函式 ---

// 亂數雜訊 (這是 Stereogram 成像的關鍵，提供眼睛對焦的錨點)
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 2D 旋轉矩陣
mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

// 畫風機的函式 (SDF)
float turbineShape(vec2 p, float seed) {
    // 塔柱 (Pole)
    float pole = step(abs(p.x), 0.02) * step(p.y, 0.0) * step(-1.0, p.y);
    
    // 葉片 (Blades)
    vec2 bladeUV = p - vec2(0.0, 0.0); // 中心點
    float angle = u_time * 2.0 + seed; // 轉動速度 + 隨機相位
    
    float blades = 0.0;
    for(int i=0; i<3; i++) {
        // 旋轉每個葉片
        vec2 rotated = rotate2d(angle + float(i)*2.094) * bladeUV;
        // 簡單的葉片形狀 (長橢圓)
        float b = 1.0 - smoothstep(0.03, 0.04, abs(rotated.x)); // 寬度
        b *= step(0.0, rotated.y) * step(rotated.y, 0.45); // 長度
        blades = max(blades, b);
    }
    
    return max(pole, blades);
}

// 高斯模糊深度圖
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
    
    // 1. 處理深度圖
    vec2 depthUV = st;
    depthUV.x *= screenAspect;
    depthUV.x -= (screenAspect - 1.0) * 0.5;
    
    float d = 0.0;
    if(depthUV.x > 0.0 && depthUV.x < 1.0 && depthUV.y > 0.0 && depthUV.y < 1.0) {
        float rawDepth = getGaussianBlur(u_tex1, depthUV);
        d = smoothstep(0.1, 0.9, rawDepth);
    }
    
    // 2. Stereogram 偏移
    float shift = d * STRENGTH;
    
    vec2 tileUV = st;
    tileUV.x *= screenAspect;
    tileUV.x *= REPEATS; // 重複視窗
    tileUV.x -= shift * REPEATS; // 加入深度位移
    
    // --- [關鍵]：程式碼生成的無限風機網格 ---
    
    // 建立網格座標
    vec2 gridUV = tileUV * (SCALE / REPEATS); // 調整風機相對於視窗的大小
    
    // 交錯排列 (Staggered Grid) - 讓它像真的海上陣列，而不是棋盤
    // 偶數行往右移 0.5
    float row = floor(gridUV.y);
    if(mod(row, 2.0) > 0.5) {
        gridUV.x += 0.5;
    }
    
    vec2 cellID = floor(gridUV);
    vec2 cellUV = fract(gridUV) - 0.5; // 每個格子的中心
    
    // 繪製風機
    // 傳入 cellID.x 作為種子，讓不同行的風機旋轉角度略有不同 (更自然)
    float shape = turbineShape(cellUV * 1.5, cellID.x); 
    
    // 3. 上色與氛圍 (Aesthetic)
    
    // 背景：模擬夕陽海面的雜訊漸層
    // 這是 Stereogram 成功的關鍵：必須有高頻雜訊
    float noise = random(tileUV * 100.0); // 高頻顆粒
    
    // 漸層色：從上面的洋紅(天空) 到 下面的深藍(海)
    vec3 skyColor = vec3(0.6, 0.4, 0.5); // 濁洋紅
    vec3 seaColor = vec3(0.1, 0.2, 0.35); // 深海藍
    vec3 bgColor = mix(seaColor, skyColor, st.y + noise*0.1);
    
    // 風機顏色 (亮白/青色)
    vec3 turbineColor = vec3(0.9, 0.95, 1.0);
    
    // 混合
    vec3 finalColor = mix(bgColor, turbineColor, shape);
    
    // 疊加更多雜訊以確保立體感 (Grain)
    finalColor += (noise - 0.5) * 0.15;

    gl_FragColor = vec4(finalColor, 1.0);
}