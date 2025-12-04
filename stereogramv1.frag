#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Camo
uniform sampler2D u_tex1; // Depth

// --- [黃金平衡參數] ---

// 水平重複：5.0 到 6.0 之間通常效果最好
const float REPEATS = 5.0;

// [修正 1] 強度：甜蜜點 (Sweet Spot)
// 0.03 太弱，0.1 太強(像浮水印)。
// 0.05 - 0.06 是讓肉眼看不見，但大腦能解碼的最佳區間。
const float STRENGTH = 0.055; 

// [修正 2] 邊緣處理：微導角
// 我們需要一點點模糊來消除 "切割感"，但不能糊到看不清字
const float BLUR_RADIUS = 1.5; 

// 深度圖層次
const float BRIGHTNESS = 1.0; 
const float GAMMA = 0.7;      

// --- 工具函式：微量模糊 ---
float getBlurredDepth(sampler2D tex, vec2 uv, vec2 resolution) {
    float total = 0.0;
    // 根據解析度計算極小的偏移量
    float offset = BLUR_RADIUS / resolution.x; 
    
    // 5點採樣 (十字形)
    total += texture2D(tex, uv).r; 
    total += texture2D(tex, uv + vec2(offset, 0.0)).r;
    total += texture2D(tex, uv - vec2(offset, 0.0)).r;
    total += texture2D(tex, uv + vec2(0.0, offset)).r;
    total += texture2D(tex, uv - vec2(0.0, offset)).r;
    
    return total / 5.0;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 修正比例 (視需求開啟)
    // float aspect = u_resolution.x / u_resolution.y;
    // st.x *= aspect;

    // 1. 讀取並微調深度 (Softened Reveal)
    float d = getBlurredDepth(u_tex1, st, u_resolution);

    // 2. 調整曲線 (Curve)
    // 讓文字主體保持平坦的高地，邊緣快速下降
    d = pow(d, GAMMA) * BRIGHTNESS;
    d = clamp(d, 0.0, 1.0);

    // 3. 計算位移
    vec2 uv = st;
    uv.x *= REPEATS;

    // 施加位移
    // 因為有微量模糊，這裡的位移不會造成圖案斷裂，而是 "擠壓"
    uv.x -= d * STRENGTH;

    // 4. 鏡像重複 (Mirrored Repeat) - 保持接縫平滑
    vec2 tileUV = uv;
    float tileIndex = floor(tileUV.x);
    if (mod(tileIndex, 2.0) > 0.5) {
        tileUV.x = 1.0 - fract(tileUV.x);
    } else {
        tileUV.x = fract(tileUV.x);
    }

    // 5. 採樣
    vec4 color = texture2D(u_tex0, tileUV);

    gl_FragColor = color;
}