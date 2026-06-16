# 九州・本州・四國 — JR 自由行規劃 App 🗾

一個「像手機軟體」的高端旅遊規劃 Web App，為 **2026/06/17 – 06/24** 的九州・本州（廣島・下關）・四國 8 日 JR 自由行打造。

> 福岡（博多）進出 → 熊本 → 阿蘇 → 廣島 → 宮島 → 下關（馬關條約）→ 博多

## ✨ 功能

- **今日**：依手機「時間 + 位置」自動顯示你「現在該做什麼、下一站是哪裡」，含到下一站距離與一鍵 Google 導航。出發前則顯示倒數。
- **行程**：8 天逐日時間軸，每段交通含車種、參考時刻、票價、是否吃券，並可直接開 Google 即時班次/導航。
- **路線・地圖**：
  - 互動地圖（涵蓋 **本州・四國・九州**），各景點/車站標記可導航。
  - **JR 路線示意圖**（山陽・九州新幹線、豐肥本線、宮島支線、在來線）。
  - **所有跨城班次**一覽。
  - **車票方案**：推薦 JR West 山陽・山陰・北九州周遊券（含のぞみ・みずほ）與比較表。
- **天氣**：六城市（福岡/熊本/阿蘇/廣島/宮島/下關）即時 + 逐時 + 行程期間每日預報（Open-Meteo，免金鑰）。
- **伴手禮**：四城必買清單、購買地點與保冷建議。
- **AI 旅伴（Gemini Flash 3.0）**：即時問答；開啟**代理模式**後可自動「切換分頁、在地圖標點、開 Google 導航、查天氣」等操控頁面。

## 🧱 技術

- 純靜態前端（**零相依套件、無建置步驟、無 lock 檔**）＋ Cloudflare Pages Functions（Gemini 代理）。
- 地圖：Leaflet + OpenStreetMap/CARTO（免金鑰）。天氣：Open-Meteo（免金鑰）。導航：Google Maps 深連結（免金鑰）。
- PWA：可加到主畫面、離線開啟。

---

## 🚀 一次部署到 Cloudflare Pages

因為**沒有任何相依套件、沒有 lock 檔、不需建置**，部署最單純：

### 方法 A：Git 連動（推薦）
1. 推到 GitHub（見下）。
2. Cloudflare 後台 → **Workers & Pages → Create → Pages → Connect to Git** → 選此 repo。
3. Build 設定：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`（根目錄）
4. **Settings → Environment variables** 新增：
   - `GEMINI_API_KEY` = 你的 Google AI Studio 金鑰（建議設為 **Secret**）
   - `GEMINI_MODEL` = `gemini-flash-latest`（即 Gemini Flash 3.0；亦可填 `gemini-3.5-flash`）
5. Deploy。`functions/api/gemini.js` 會自動成為 `/api/gemini`。

### 方法 B：Wrangler CLI
```bash
npx wrangler pages deploy . --project-name=kyushu-plan
npx wrangler pages secret put GEMINI_API_KEY --project-name=kyushu-plan
# GEMINI_MODEL 可在後台設為一般變數，或：
# npx wrangler pages secret put GEMINI_MODEL --project-name=kyushu-plan
```

### Gemini 模型（你的需求：Gemini Flash 3.0）
Google API 中對應 Gemini 3 Flash 世代的字串為 `gemini-flash-latest`（永遠指向最新 Flash）或穩定版 `gemini-3.5-flash`。本專案預設 `gemini-flash-latest`，可用 `GEMINI_MODEL` 覆寫。

> 不想動後台也能用：開啟 App → 右上「設定」→ 貼上你的 Gemini 金鑰，App 會改為瀏覽器直連（適合本機測試）。

---

## 🔧 本機預覽

任一靜態伺服器即可（ES modules 需透過 http）：
```bash
npx wrangler pages dev .      # 含 /api/gemini 函式（需設 .dev.vars 的 GEMINI_API_KEY）
# 或
python -m http.server 8080    # 純前端（AI 用「設定」貼金鑰直連）
```

`.dev.vars`（本機用，勿提交）：
```
GEMINI_API_KEY=你的金鑰
GEMINI_MODEL=gemini-flash-latest
```

---

## ⚠️ 重要說明
- **車次與票價為參考值**（依官方/權威來源整理），出發前請以即時 **Google Maps / JR 官方**為準 — App 內每段交通都已內建即時連結。
- 六月中旬為**梅雨季**，請帶雨具；部分景點（如熊本城部分區域、廣島城天守閣 2026 整修）狀態請現場確認。
- 阿蘇中岳火口能否進入視**火山噴火警戒等級**，當日查詢。
- 四國已顯示於地圖；若要加跑四國需另購 All Shikoku Pass 與本四連絡線（與周遊券不互通）。

## 📁 結構
```
index.html
manifest.webmanifest   sw.js   _headers   .gitignore
assets/css/styles.css
assets/js/{main,data,util,weather,map,gemini}.js
assets/icons/favicon.svg
functions/api/gemini.js      # Cloudflare Pages Function (/api/gemini)
```
