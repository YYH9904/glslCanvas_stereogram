#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Camo (紋理)
uniform sampler2D u_tex1; // Depth (深度圖)

// --- [使用者參數設定] ---
// 對應你的線上工具設定
const float REPEATS = 5.0;      // Repeats: 5 (水平重複次數)
const float STRENGTH = 0.2;     // Strength: 7 (對應到 Shader 約為 0.1~0.3)
const float BRIGHTNESS = 0.6;   // Brightness: 0.6
const float GAMMA = 0.7;        // Gamma: 0.7
const float SMOOTHING = 0.5;    // Smoothing (模擬線上工具的平滑效果)

void main() {
    // 1. 基礎座標
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 修正比例 (確保圖案是正的，不會被螢幕壓扁)
    float aspect = u_resolution.x / u_resolution.y;
    // st.x *= aspect; // 視情況開啟，如果你希望圖案維持正方形比例

    // 2. 處理深度圖 (Pre-processing Depth)
    // 我們不直接讀取，而是先套用你的 Brightness 和 Gamma 設定
    vec4 rawDepth = texture2D(u_tex1, st);
    float d = rawDepth.r;

    // [Gamma 校正]: 讓深淺變化更符合人眼或工具設定
    d = pow(d, GAMMA); 
    // [Brightness]: 調整整體強度
    d = d * BRIGHTNESS;

    // 3. 計算立體位移 (The Stereogram Logic)
    // 這裡我們模擬 "SIRD" 的邏輯：深度越深，圖案重複的相位(Phase)移動越多
    
    vec2 uv = st;
    
    // A. [Repeats]: 先放大座標，製造重複
    // 這對應你參考圖中那種密集的垂直條紋感
    uv.x *= REPEATS;

    // B. [Strength]: 施加位移
    // 為了讓效果更像 "生成" 的，我們讓位移只發生在 X 軸
    // 且位移量由處理過的深度值 (d) 決定
    float parallax = d * STRENGTH;
    
    // 關鍵修正：通常 Stereogram 是將圖案往"內"推
    uv.x -= parallax; 

    // 4. 採樣迷彩 (Sampling)
    // 使用 fract() 確保圖案無限循環
    vec2 finalUV = fract(uv);
    
    // [Smoothing]: 稍微模糊紋理邊緣，模擬 "Smoothing: 10" 的柔和感
    // 這是一個簡單的 Trick：如果想更平滑，可以輕微偏移採樣
    // 但為了效能，我們直接依賴 Linear Filtering (WebGL 預設)
    
    vec4 color = texture2D(u_tex0, finalUV);

    // 除錯模式：取消註解下面這行，可以看到你的深度圖現在長什麼樣子
    // gl_FragColor = vec4(vec3(d), 1.0); return;

    gl_FragColor = color;
}