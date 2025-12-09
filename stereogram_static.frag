#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform sampler2D u_tex0; // Camo (主視覺)
uniform sampler2D u_tex1; // Depth (kWh 文字)
uniform sampler2D u_tex2; // Money (隱藏紋理)

// --- [關鍵參數] ---

// 水平重複次數：針對你的 kWh 文字，建議 6.0 到 8.0
// 次數越多，錯視點越密集，立體感越精細，但需要靠更近看
const float REPEATS = 6.0;

// 立體強度：
// 0.03 = 極隱密，肉眼完全看不出，適合高手
// 0.05 = 標準，肉眼稍微有感，容易對焦
// 0.08+ = 會產生明顯浮水印 (鬼影)
const float STRENGTH = 0.045; 

// 深度模糊半徑：消除浮水印的關鍵
// 數值越大，邊緣越柔和，越不容易穿幫
const float BLUR_RADIUS = 3.0; 

// 雜訊混合度：錢幣符號的能見度 (0.0 ~ 1.0)
const float NOISE_OPACITY = 0.15; 

// --- [工具函式：9點高斯模糊] ---
float getBlurredDepth(sampler2D tex, vec2 uv, vec2 resolution) {
    float total = 0.0;
    float offset = BLUR_RADIUS / resolution.x; 
    
    // 採樣周圍 9 個點並取平均
    total += texture2D(tex, uv).r; 
    total += texture2D(tex, uv + vec2(offset, 0.0)).r;
    total += texture2D(tex, uv - vec2(offset, 0.0)).r;
    total += texture2D(tex, uv + vec2(0.0, offset)).r;
    total += texture2D(tex, uv - vec2(0.0, offset)).r;
    total += texture2D(tex, uv + vec2(offset, offset)).r;
    total += texture2D(tex, uv + vec2(offset, -offset)).r;
    total += texture2D(tex, uv + vec2(-offset, offset)).r;
    total += texture2D(tex, uv + vec2(-offset, -offset)).r;
    
    return total / 9.0;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;

    // 1. 讀取並柔化深度 (Depth Smoothing)
    // 這是消除 "浮水印/鬼影" 的最重要步驟
    float d = getBlurredDepth(u_tex1, st, u_resolution);
    
    // 稍微增強對比，確保模糊後柱子還是挺的
    d = smoothstep(0.1, 0.9, d); 

    // 2. Stereogram 核心運算
    vec2 uv = st;
    
    // A. 水平重複 (Tiling)
    uv.x *= REPEATS;

    // B. 視差位移 (Displacement)
    // 根據柔化後的深度推移座標
    uv.x -= d * STRENGTH;

    // C. 鏡像處理 (Mirrored Repeat) & 防止拉伸 (Fract)
    // 這裡同時解決接縫和拉伸線條
    vec2 tileUV = uv;
    float tileIndex = floor(tileUV.x);
    
    // 偶數格翻轉，奇數格正常
    if (mod(tileIndex, 2.0) > 0.5) {
        tileUV.x = 1.0 - fract(tileUV.x);
    } else {
        tileUV.x = fract(tileUV.x);
    }

    // 3. 採樣材質 (Sampling)
    
    // A. 美好表象 (Camo)
    vec3 colorCamo = texture2D(u_tex0, tileUV).rgb;

    // B. 資本雜訊 (Money)
    // 放大 3 倍，讓它像紙張紋理
    vec3 colorMoney = texture2D(u_tex2, tileUV * 3.0).rgb;
    
    // 4. 混合 (The Final Look)
    // 讓錢幣雜訊像 "陰影" 一樣淡淡地疊在迷彩上
    // 使用 mix 和 multiply 的概念
    vec3 finalColor = colorCamo * mix(vec3(1.0), colorMoney, NOISE_OPACITY);

    gl_FragColor = vec4(finalColor, 1.0);
}