#ifdef GL_ES
precision mediump float;
#endif

// 來自 HTML/GlslCanvas 的輸入變數
uniform vec2 u_resolution; // 畫布長寬
uniform vec2 u_mouse;      // 滑鼠位置 (暫時不用，但保留接口)
uniform float u_time;      // 時間 (可用於製作流動的風)
uniform sampler2D u_tex0;  // 你的迷彩圖 (The Lure / Camo)
uniform sampler2D u_tex1;  // 你的深度圖 (The Predator / Depth)

// --- 參數設定區 ---
// 這是你可以調整 "立體感" 與 "迷彩密度" 的地方
const float TILES = 8.0;      // 水平方向要重複幾次迷彩？ (越多越難看透，但也越細緻)
const float DEPTH_POWER = 0.15; // 立體感的強度 (數值越大，隱藏物件 "浮" 起來越高)

void main() {
    // 1. 歸一化座標 (Normalization)
    // 將像素座標 (例如 x:960, y:540) 轉換為 0.0 到 1.0 的 uv 座標
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // 2. 讀取深度資訊 (Reading the Hidden Truth)
    // 我們直接讀取深度圖的紅像色版 (r)。
    // 假設深度圖中：白色(1.0) = 靠近觀眾(凸起)，黑色(0.0) = 遠離觀眾(背景)。
    // 為了不讓深度圖本身變形，我們必須用原始的 uv 來讀取它。
    vec4 depthColor = texture2D(u_tex1, uv);
    float depth = depthColor.r; 

    // 3. 計算視差偏移 (Calculating Parallax)
    // Stereogram 的原理：越靠近眼睛的東西，左右眼的視差越大。
    // 在單張圖中，我們透過 "水平推移紋理" 來模擬這個視差。
    // 深度越深 (depth 數值大)，我們讓紋理偏移得越多。
    float parallaxShift = depth * DEPTH_POWER;

    // 4. 迷彩紋理處理 (The Camouflage Processing)
    // A. 建立重複紋理 (Tiling)：把 uv.x 乘以 TILES (比如 8)，讓迷彩在水平方向重複 8 次。
    vec2 tiledUv = uv;
    tiledUv.x *= TILES;

    // B. 注入資本結構 (Injecting the Hidden Structure)：
    // 這是最關鍵的一步。我們把剛剛算出來的 "偏移量 (parallaxShift)" 加到紋理座標上。
    // 這會導致迷彩圖案在有 "kWh/$" 的地方產生扭曲。
    // 這種扭曲單眼看是亂碼，但雙眼焦距對上時，大腦會將其解析為深度。
    tiledUv.x -= parallaxShift; 

    // C. 加上一點點風的流動 (Optional: Slight Wind)
    // 為了讓畫面不要死氣沉沉，我們讓迷彩本身有一點點緩慢的流動
    // 這樣更像 "自然/偽裝"。
    // tiledUv.x += u_time * 0.05; // (如果想要動態效果可打開這行)

    // 5. 採樣顏色 (Sampling Color)
    // 使用 fract() 取小數點，確保紋理座標在 0.0~1.0 之間循環，實現無縫拼接。
    vec4 color = texture2D(u_tex0, fract(tiledUv));

    // 6. 輸出最終像素
    gl_FragColor = color;
}