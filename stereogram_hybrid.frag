#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

uniform sampler2D u_tex0; // Camo (美好的誘餌)
uniform sampler2D u_tex1; // DepthMap (隱藏的骨架)
uniform sampler2D u_tex2; // Money Noise (資本的毒藥)

// --- 核心參數調校 ---
const float REPEATS = 6.0;      // [關鍵] 必須重複！這是 Stereogram 的靈魂
const float STRENGTH = 0.04;    // [關鍵] 立體深度強度 (建議 0.03~0.06)

// 視覺風格
const float BRIGHTNESS = 1.1;   // 深度圖對比增強
const float GAMMA = 0.7;

// 雜訊混合強度：數值越高，柱子上的 $ 符號越明顯
const float NOISE_OPACITY = 0.8; 

void main() {
    // 1. 基礎座標歸一化
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 修正比例 (確保圖案不會被壓扁)
    float aspect = u_resolution.x / u_resolution.y;
    // st.x *= aspect; 

    // 2. 讀取深度 (The Skeleton)
    // 我們需要先讀取深度，才知道哪裡要位移
    float depth = texture2D(u_tex1, st).r;
    
    // 強化深度對比，讓柱子更立體
    depth = pow(depth, GAMMA) * BRIGHTNESS;

    // 3. 建立 Stereogram 座標系統 (The Grid)
    vec2 uv = st;

    // [關鍵步驟 A] 水平重複 (Tiling)
    // 這是之前版本缺失的，沒有它就沒有立體感
    uv.x *= REPEATS;

    // [關鍵步驟 B] 視差位移 (Parallax)
    // 根據深度推移紋理
    uv.x -= depth * STRENGTH;

    // [關鍵步驟 C] 鏡像無縫處理 (Mirroring)
    // 讓左右接縫完美融合
    vec2 tileUV = uv;
    if (mod(floor(tileUV.x), 2.0) > 0.5) {
        tileUV.x = 1.0 - fract(tileUV.x);
    } else {
        tileUV.x = fract(tileUV.x);
    }

    // 4. 雙重材質採樣 (The Texture Morphing)
    
    // A. 採樣美好迷彩 (Base Skin)
    // 讓它稍微流動 (Wind)
    vec2 camoUV = tileUV;
    camoUV.x += u_time * 0.02; 
    vec4 colorCamo = texture2D(u_tex0, camoUV);

    // B. 採樣資本雜訊 (Poison)
    // 讓雜訊密一點 (* 3.0)，像數據流
    vec2 moneyUV = tileUV * 3.0; 
    vec4 colorMoney = texture2D(u_tex2, fract(moneyUV));

    // 5. 混合邏輯 (The Infection)
    // 我們不能直接 mix，那樣會讓柱子直接現形(變黑白)。
    // 我們用 "Multiply" 乘法混合，讓 $ 符號 "染" 在紫色迷彩上。
    
    // 把黑白的錢幣雜訊轉成一種 "加深" 的濾鏡
    vec3 infectedColor = colorCamo.rgb * colorMoney.rgb * 1.5; 

    // 根據深度決定感染程度
    // 深度 0 (背景) -> 顯示原味迷彩
    // 深度 1 (柱子) -> 顯示被錢幣感染的迷彩
    float infectionFactor = smoothstep(0.1, 0.8, depth);
    
    // 最終混合
    vec3 finalColor = mix(colorCamo.rgb, infectedColor, infectionFactor * NOISE_OPACITY);

    gl_FragColor = vec4(finalColor, 1.0);
}