# 九州・瀨戶內・關西 — JR 單程自由行規劃 App 🗾

一個「像手機軟體」的高端旅遊規劃 Web App，為 **2026/06/17 – 06/24**、**熊本機場(KMJ)進・關西機場(KIX)出** 的 8 日 JR 單程自由行打造。

> 熊本 → 博多 → 下關（馬關條約）→ 廣島 → 宮島 → 高松（四國）→ 倉敷/岡山 → 大阪 → 京都 → 奈良 → KIX

## ✨ 功能

- **今日・指揮中心**：依手機「時間 + 位置」顯示「現在該做什麼、下一站」、**今日進度環 + 倒數 + 進度條**、到下一站距離與一鍵 Google 導航；出發前顯示倒數。
- **行程**：8 天逐日時間軸，每段交通含車種、參考時刻、票價、是否吃券，並可直接開 Google 即時班次/導航。
- **路線・地圖**：
  - 互動地圖（涵蓋 **本州・四國・九州**），各景點/車站標記可導航。
  - **JR 路線示意圖**（九州・山陽新幹線、瀨戶大橋四國線、宮島渡輪、關西在來線）。
  - **所有跨城班次**一覽（10 段，含 Google 即時連結）。
  - **車票方案**：推薦 JR West **瀨戶內地區周遊券（Setouchi Area Pass）**（含のぞみ・みずほ・四國・關西・KIX）與比較表。
- **天氣**：十城市（熊本/福岡/下關/廣島/宮島/高松/岡山/大阪/京都/奈良）即時 + 逐時 + 行程期間每日預報（Open-Meteo，免金鑰）。
- **伴手禮**：九城必買清單、購買地點與保冷建議。
- **附近飯店**：點任一景點/車站（詳情頁或地圖標記）即可查附近飯店與即時房價（Google 地圖 / Booking.com），方便沿途找住宿。
- **AI 旅伴（Gemini Flash 3.0）**：即時問答；開啟**代理模式**後可自動「切換分頁、在地圖標點、開 Google 導航、查天氣、找飯店」等操控頁面。
- **旅遊錦囊（右上工具鈕）**：實用日語會話（6 情境・可發音）、緊急電話與台灣駐處一鍵撥打、日幣⇄台幣換算、車票/IC 卡/免稅指南、行李打包清單、我的預訂、景點收藏、禮儀與上網/行李宅配。
- **市售級體感**：啟動 splash、Material 風頁面轉場與點擊漣漪動效、進度環/晶片微動畫，整體更貼近 Google App 高級質感。

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
- **熊本→博多（九州新幹線）不含於 Setouchi 周遊券**，約 ¥5,310 於熊本站另購；周遊券建議 **6/19 在博多啟用**，涵蓋之後到關西全程。
- 六月中旬為**梅雨季**，請帶雨具；部分景點（如熊本城部分區域、廣島城天守閣 2026 整修、興福寺五重塔修復中）狀態請現場確認。
- 最後一天奈良半日視班機時間；若為上午班機，請略過奈良直接前往 KIX。

## 📁 結構
```
index.html
manifest.webmanifest   sw.js   _headers   .gitignore
assets/css/styles.css
assets/js/{main,data,util,weather,map,gemini}.js
assets/icons/favicon.svg
functions/api/gemini.js      # Cloudflare Pages Function (/api/gemini)
```
