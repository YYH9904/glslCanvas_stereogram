#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Landscape (Visible only inside blades)
uniform sampler2D u_tex1; // Hand Depth (Hidden structure)
uniform sampler2D u_tex2; // Blade Texture (The Mask)

// --- [參數調校] ---
const float SCALE = 9.0;      // 風機密度 (網格大小)
const float STRENGTH = 0.04;  // 深度強度
const float REPEATS = 5.0;    // 重複次數
const float BLUR_RADIUS = 12.0;

// --- 工具函式 ---
vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
}

float getGaussianBlur(sampler2D tex, vec2 uv) {
    float color = 0.0;
    float totalWeight = 0.0;
    vec2 pixelSize = 1.0 / u_resolution.xy; // 自動適應實際解析度
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
    // [關鍵修正] 直接使用標準座標，不需要 Aspect Ratio 修正
    // 因為 HTML 已經保證 Canvas 是正方形，所以 st.x 和 st.y 比例是一樣的
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 1. 處理深度圖 (手) - 直接讀取，無需置中修正
    vec2 depthUV = st;
    float d = 0.0;
    
    // 這裡我們稍微縮放一下深度圖，讓手不要貼到邊邊
    // 把它縮小到 90% (uv * 1.1 - 0.05)
    vec2 centeredDepthUV = (depthUV - 0.5) * 1.1 + 0.5;
    
    if(centeredDepthUV.x > 0.0 && centeredDepthUV.x < 1.0 && centeredDepthUV.y > 0.0 && centeredDepthUV.y < 1.0) {
        float rawDepth = getGaussianBlur(u_tex1, centeredDepthUV);
        d = smoothstep(0.1, 0.9, rawDepth);
    }
    
    // 2. Stereogram 位移計算
    float shift = d * STRENGTH;
    
    vec2 tileUV = st;
    tileUV.x *= REPEATS; 
    tileUV.x -= shift * REPEATS; 
    
    // --- 3. 準備「風景照」 (鏡像邏輯) ---
    vec2 landscapeUV = tileUV;
    float tileIndex = floor(landscapeUV.x);
    if (mod(tileIndex, 2.0) > 0.5) {
        landscapeUV.x = 1.0 - fract(landscapeUV.x);
    } else {
        landscapeUV.x = fract(landscapeUV.x);
    }
    
    vec3 photoColor = texture2D(u_tex0, landscapeUV).rgb;


    // --- 4. 繪製旋轉風機 ---
    vec2 gridUV = tileUV * (SCALE / REPEATS); 

    // [新增] 垂直偏移修正
    // 往下移 0.3 格 (數值可以微調，試試 0.2 ~ 0.5)
    // 這樣可以把最上面被切斷的那排藏起來
    gridUV.y += 0.1; 

    float row = floor(gridUV.y);
    if(mod(row, 2.0) > 0.5) gridUV.x += 0.5; // 交錯排列
    
    vec2 cellID = floor(gridUV);
    vec2 cellUV = fract(gridUV);
    
    // 旋轉 UV
    float angle = u_time * 2.0 + cellID.x + cellID.y;
    vec2 rotatedBladeUV = rotateUV(cellUV, angle);
    
    // 讀取扇葉圖 (u_tex2)
    float bladeMask = texture2D(u_tex2, rotatedBladeUV).r;
    
    // 邊界清理
    if(rotatedBladeUV.x < 0.0 || rotatedBladeUV.x > 1.0 || rotatedBladeUV.y < 0.0 || rotatedBladeUV.y > 1.0) {
        bladeMask = 0.0;
    }
    
    // 簡單塔柱
    float poleMask = step(abs(cellUV.x - 0.5), 0.02) * step(cellUV.y, 0.5);
    float fullMask = max(bladeMask, poleMask); 
    
    // --- 5. 最終合成 ---
    // 黑色背景 + 透過遮罩顯示風景
    vec3 finalColor = photoColor * fullMask;

    gl_FragColor = vec4(finalColor, 1.0);
}