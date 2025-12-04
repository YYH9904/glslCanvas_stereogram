#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

uniform sampler2D u_tex0; // Camo (美景)
uniform sampler2D u_tex1; // Depth (骨架)
uniform sampler2D u_tex2; // Money (資本雜訊)

// 簡單雜訊函數 (Film Grain) - 增加真實感
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 修正比例 (視窗比例)
    // float aspect = u_resolution.x / u_resolution.y;
    // st.x *= aspect; 
    // (註：如果你的全螢幕貼圖覺得被拉寬了，可以把上面這兩行打開)

    // 1. 讀取深度 (骨架)
    vec4 depthMap = texture2D(u_tex1, st);
    float depth = depthMap.r; // 假設黑底白字，白色=柱子(1.0)

    // 2. 自動呼吸機制 (Auto Focus / Breathing)
    // 讓結構在「隱形」與「顯現」之間緩慢切換，像是在呼吸
    // 範圍控制在 0.5 ~ 1.0 之間，讓它永遠不會完全消失，保持壓迫感
    float autoFocus = 0.75 + 0.25 * sin(u_time * 0.8); 

    // 3. 資源攔截機制 (Flow Interception)
    // 這是物理隱喻的核心：柱子(depth高) 會產生極大阻力
    // pow(..., 4.0) 讓白的區域幾乎完全流不動，黑的區域流得快
    float flowBlock = pow(1.0 - depth * 0.9, 4.0); 

    // 4. 計算視差偏移 (Parallax Offset)
    // 深度越深，偏移越多 -> 產生立體錯覺
    float distortionStrength = 0.15; 
    vec2 offset = vec2(depth * distortionStrength * autoFocus, 0.0);

    // 5. 迷彩流動 (Flow)
    // 讓背景(風)向右流動，但受到 flowBlock 影響
    vec2 flow = vec2(u_time * 0.03, u_time * 0.01) * flowBlock;
    
    // 基礎 UV：加上流動與偏移
    // Tiling = 1.0 (使用無縫大圖)
    vec2 uv_deformed = fract(st * 1.0 + flow + offset);

    // --- 6. 雙重紋理採樣 (Texture Morphing) ---
    
    // A. 採樣美好迷彩 (環境)
    vec3 colorBeautiful = texture2D(u_tex0, uv_deformed).rgb;
    
    // B. 採樣資本雜訊 (獵物真面目)
    // 這裡讓雜訊重複多次 (st * 4.0)，讓 $ 符號變小、變密，像數據流
    vec2 uv_money = fract(uv_deformed * 4.0);
    vec3 colorCapital = texture2D(u_tex2, uv_money).rgb;
    
    // [美學] 幫黑白的資本雜訊上色
    // 讓它帶有一點 "數位/有毒" 的螢光綠或冷光藍
    colorCapital *= vec3(0.1, 0.9, 0.6); 

    // C. 混合 (The Reveal)
    // 根據深度 (depth) 決定顯示哪一張
    // 背景(黑) -> 顯示美好迷彩
    // 柱子(白) -> 顯示資本雜訊
    // smoothstep 控制過渡的銳利度
    float mixFactor = smoothstep(0.2, 0.7, depth); 
    
    vec3 finalColor = mix(colorBeautiful, colorCapital, mixFactor);

    // 7. 視覺增強
    // 加入動態雜訊 (Grain) 增加實體感，讓 Stereogram 更好對焦
    float grain = random(uv_deformed * 150.0);
    finalColor = mix(finalColor, vec3(grain), 0.1);

    // 壓暗整體氣氛 (Dystopian Tone)
    finalColor *= 0.9;
    
    // 邊緣光：讓結構邊緣微微發亮
    finalColor += vec3(depth * 0.08 * autoFocus);

    gl_FragColor = vec4(finalColor, 1.0);
}