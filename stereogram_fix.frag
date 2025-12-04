#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

uniform sampler2D u_tex0; // Camo (只用來取色，不參與結構)
uniform sampler2D u_tex1; // Depth (骨架)
uniform sampler2D u_tex2; // Money Noise (這是我們唯一的皮膚)

// --- [調校參數] ---
// Stereogram 核心
const float REPEATS = 5.0;      // 重複次數
const float STRENGTH = 0.04;    // 立體強度 (甜蜜點)

// 深度圖處理
const float BRIGHTNESS = 1.0;   
const float GAMMA = 0.7;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 1. 讀取深度 (The Ghost)
    // 這裡讀取的 depth 只會用來 "推移" 像素，絕對不會用來 "上色"
    float d = texture2D(u_tex1, st).r;
    d = pow(d, GAMMA) * BRIGHTNESS;

    // 2. 建立 Stereogram 座標
    vec2 uv = st;
    
    // A. 水平重複 (Tiling)
    uv.x *= REPEATS;

    // B. 視差位移 (Parallax) -> 這是唯一的 "深度介入"
    // 根據深度把紋理往左推
    uv.x -= d * STRENGTH;

    // C. 鏡像處理 (Seamless)
    // 讓錢幣雜訊左右無縫對接
    vec2 tileUV = uv;
    if (mod(floor(tileUV.x), 2.0) > 0.5) {
        tileUV.x = 1.0 - fract(tileUV.x);
    } else {
        tileUV.x = fract(tileUV.x);
    }

    // 3. 採樣 "資本雜訊" (Sampling the Money)
    // 我們使用 tileUV 來抓取 money_noise.jpg
    // 這樣整個畫面都是由這張圖構成的，所以不會有邊緣穿幫
    vec3 moneyTexture = texture2D(u_tex2, tileUV).rgb;

    // 4. 施加偽裝色 (The Tint)
    // 原本的 moneyTexture 是黑白的。
    // 我們要讓它看起來像 camo_v4 的風格。
    
    // 定義我們想要的夢幻顏色 (參考自你的 camo 圖片)
    // 暗部：深紫靛色
    vec3 colorDark = vec3(0.2, 0.1, 0.4); 
    // 亮部：薄荷綠/淡粉
    vec3 colorLight = vec3(0.1, 0.8, 0.7); 

    // 使用 moneyTexture 的黑白值來混合這兩種顏色
    // 黑色的錢 -> 變成深紫色
    // 白色的錢 -> 變成薄荷綠
    vec3 finalColor = mix(colorDark, colorLight, moneyTexture.r);

    // 5. 視覺微調
    // 加一點點原本迷彩圖的顏色進去，讓它更豐富 (Overlay)
    // 注意：這裡是拿 "沒被深度扭曲" 的大圖來疊色，增加環境感
    vec3 envColor = texture2D(u_tex0, st).rgb;
    finalColor = mix(finalColor, envColor, 0.3); // 30% 環境色 + 70% 錢幣紋理

    gl_FragColor = vec4(finalColor, 1.0);
}