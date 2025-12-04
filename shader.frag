#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_tex0; // Camo (迷彩)
uniform sampler2D u_tex1; // Depth (深度)

// 調整這些數值來改變效果
const float TILES = 6.0;        // 減少重複次數，讓圖案大一點比較好確認
const float DEPTH_POWER = 0.05; // 稍微降低強度，避免圖案破裂太嚴重

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // 除錯區塊：如果貼圖讀不到，我們會看到純色
    // 請確保瀏覽器沒有報 "Texture not found" 錯誤

    // 1. 讀取深度 (The Predator)
    // 注意：如果你的深度圖是黑底白字，r 通道就有數值
    vec4 depthMap = texture2D(u_tex1, st);
    float depth = depthMap.r; 

    // 2. 製作 Stereogram 偏移
    vec2 uv = st;
    
    // 水平重複 (Tiling)
    uv.x *= TILES;
    
    // 施加視差偏移 (Parallax)
    // 這裡我們把深度值加進 X 軸
    uv.x -= depth * DEPTH_POWER;

    // 3. 讀取迷彩 (The Lure)
    vec4 color = texture2D(u_tex0, fract(uv));

    // --- 除錯模式 (Debug) ---
    // 如果你覺得深度圖沒作用，取消下面這一行的註解(//)，畫面應該會顯示出你的 kWh 文字
    // gl_FragColor = vec4(vec3(depth), 1.0); return;
    
    // 正常輸出
    gl_FragColor = color;
}