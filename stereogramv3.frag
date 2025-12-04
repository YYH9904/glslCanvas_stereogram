#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Camo (只用來吸色，不畫出來)
uniform sampler2D u_tex1; // Depth (骨架 - kWh)
uniform sampler2D u_tex2; // Money (唯一的皮膚)

// --- 參數設定 ---
// 重複次數：解決拉伸後，這裡設 4.0 到 6.0 都可以
const float REPEATS = 5.0; 

// 立體強度：
// 這是 "隱藏" 與 "顯現" 的關鍵。
// 0.02 = 非常隱密，需要很強的鬥雞眼技巧
// 0.05 = 標準 Stereogram，容易對焦
// > 0.1 = 會出現鬼影/浮水印 (因為位移太大導致紋理撕裂)
// 建議先設 0.04 測試
const float STRENGTH = 0.04; 

void main() {
    // 1. 座標歸一化
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 修正視窗比例 (視需要開啟，避免圖案被壓扁)
    // float aspect = u_resolution.x / u_resolution.y;
    // st.x *= aspect;

    // 2. 讀取深度 (The Ghost)
    // 直接讀取原本的文字深度圖
    float depth = texture2D(u_tex1, st).r;

    // 3. Stereogram 核心運算
    vec2 uv = st;
    
    // A. 水平重複 (Tiling)
    uv.x *= REPEATS;

    // B. 視差位移 (Displacement)
    // 這是唯一的深度介入點！
    // 我們根據深度，把紋理往左推
    uv.x -= depth * STRENGTH;

    // C. [絕對修正] 鏡像循環 (Seamless Mirror)
    // 這段代碼保證了：
    // 1. 絕對不會有拉伸線條 (因為用了 fract)
    // 2. 絕對不會有接縫 (因為偶數格左右翻轉)
    if (mod(floor(uv.x), 2.0) > 0.5) {
        uv.x = 1.0 - fract(uv.x);
    } else {
        uv.x = fract(uv.x);
    }

    // 4. 採樣 (The Skin)
    // 我們只採樣 money_noise (u_tex2)
    // 這裡我們把紋理放大 2 倍 (* 2.0)，讓錢幣符號更清楚一點
    vec3 textureVal = texture2D(u_tex2, uv * 2.0).rgb;
    float noise = textureVal.r; // 取黑白值

    // 5. 偽裝上色 (The Dye)
    // 這一步是為了解決 "沒有美好表象" 的問題。
    // 我們不直接顯示黑白的錢，而是把它染成迷彩的顏色。

    // 定義色票 (取自 camo_v4)
    vec3 colorDark = vec3(0.15, 0.10, 0.35); // 深紫靛
    vec3 colorMid  = vec3(0.10, 0.60, 0.55); // 藍綠
    vec3 colorLite = vec3(0.80, 0.70, 0.85); // 霧粉白

    // 根據錢幣雜訊的黑白值進行染色
    // 黑色的錢 -> 變成深紫
    // 灰色的錢 -> 變成藍綠
    // 白色的錢 -> 變成粉白
    vec3 finalColor = mix(colorDark, colorMid, noise);
    finalColor = mix(finalColor, colorLite, noise * noise); // 二次曲線提亮高光

    gl_FragColor = vec4(finalColor, 1.0);
}