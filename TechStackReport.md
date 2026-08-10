# 專案技術架構與功能開發報告

## 1. 專案總覽
本專案為基於開源 **PPTist** 專案為基底進行二次開發之線上簡報編輯器。本次開發成功將舊專案中的 AI 核心生成與編輯能力無縫移植，並升級為對接 AWS Bedrock (Claude 模型)。專案架構採用「純網頁前端 + Local Express 伺服器」的分離設計，確保了高效的 UI 互動渲染與安全的 API 金鑰控管。

## 2. 前端技術框架 (Frontend)
前端專注於高互動性的編輯器與畫布渲染。
*   **核心框架**：Vue 3 (Composition API)
*   **建置工具**：Vite（提供極速的熱更新與高效的模組打包）
*   **狀態與歷史管理**：Pinia（管理投影片核心資料 `slidesStore`、全域狀態 `mainStore` 以及利用 IndexedDB 的歷史復原機制 `snapshotStore`）
*   **樣式與排版**：SCSS / Vanilla CSS
*   **文字編輯器核心**：ProseMirror (提供投影片內進階的富文本編輯功能)
*   **拖曳與互動機制**：vuedraggable (用於圖層與左側幻燈片縮圖排序)

## 3. 後端技術框架 (Backend)
後端（`server/server.js`）作為前端與雲端 AI 服務之間的橋樑，負責處理大檔案解析與 Prompt 請求轉發。
*   **運行環境**：Node.js
*   **核心框架**：Express.js (提供輕量且快速的 RESTful API，包括 `/api/generate` 與 `/api/edit`)
*   **檔案上傳處理**：Multer (採記憶體緩衝區 `memoryStorage` 讀取，直接傳遞 Buffer，避免硬碟 I/O 瓶頸)
*   **文件解析引擎**：pdf-parse (負責將使用者上傳的 PDF 抽取為純文本，並經過字數截斷保護後傳遞給 AI 分析)
*   **AI 雲端服務串接**：
    *   `axios`：支援透過自訂的 Bearer Token 與自訂 Endpoint 呼叫企業內網代理伺服器 (AI Gateway)。
    *   亦保留了 `@aws-sdk/client-bedrock-runtime` 的底層擴充性。
*   **環境變數管理**：dotenv (負責隱碼安全隔離金鑰)

---

## 4. 關鍵技術實作亮點 (Skills & Scripts)

### 4.1. 穩定強健的 JSON 解析防護 (Robust JSON Parser)
在與大型語言模型溝通時，AI 回傳的資料經常附帶 Markdown 標記（如 ` ```json `）或多餘字元。我們在後端實作了專用的 `parseAIJSON` 函式，透過正則表達式 (RegEx) 強制清洗文字並智慧提取 `{}` 或 `[]` 結構。若 AI 回傳異常，系統亦會妥善拋出 HTTP 500 錯誤，確保前端不會因為 JSON `parse` 失敗而導致畫面卡死崩潰。

### 4.2. 結構化資料轉換轉接器 (Data Mapping Adapter)
為解決 Claude 生成的扁平化文字大綱與 PPTist 嚴格畫布結構（需包含絕對座標如 `width`, `height`, `left` 及元件 UUID）不相容的問題，在前端 `AIPPTDialog.vue` 中實作了專屬的資料轉接器。這項技術可將 AI 生成的大綱即時 Mapping 為具備預設排版佈局的 `Slide[]` 格式，讓 AI 生成完畢後能瞬間將 20 幾張投影片無縫寫入畫布。

### 4.3. 遞迴式 AI 畫布編輯器 (Recursive UI Copilot)
在全新的右側「AI Copilot 助理面板」中，實作了具備強烈約束條件的 System Prompt：
*   **安全鎖定**：嚴格限制 AI 僅能變更內容，絕對不可破壞座標與排版屬性，防止畫布跑版。
*   **遞迴遍歷修改**：賦予 AI 遞迴尋訪整個投影片巢狀 JSON 陣列的能力，完美達成如「將整份簡報的簡體字轉換為繁體字」、「統一把這頁的標題換成藍色」等複雜指令，實現了所說即所見的修改體驗。

### 4.4. 歷史紀錄防呆復原機制 (Undo Integration)
為避免 AI 編輯不如預期導致使用者心血白費，我們將 AI 寫入畫布的流程深度綁定至系統的快照引擎 (`snapshotStore.addSnapshot()`)。在接收到新資料並準備覆寫畫布的瞬間，系統會自動將當前狀態存入 IndexedDB 快照。使用者隨時可以使用 **`Ctrl + Z` (或 `Cmd + Z`)** 退回 AI 修改前的一秒鐘，提供了極高的容錯率與操作安全感。

---

## 5. LLM 生成 PPT 的技術路徑與調用流程

本專案將大語言模型 (LLM) 生成簡報的過程高度自動化與結構化，完整的技術路徑分為以下五個階段：

### 階段一：文本提取 (Text Extraction)
當使用者在前端 (`AIPPTDialog.vue`) 選擇 PDF 檔案後，前端透過 `FormData` 將檔案以 Multipart 形式發送至後端的 `POST /api/generate` 介面。後端使用 `multer` 以記憶體緩衝區 (Memory Buffer) 接收檔案，並交由 `pdf-parse` 套件提取純文字。為避免超出 LLM 的 Token 處理上限，系統內建了 40,000 字元的截斷保護機制。

### 階段二：結構化 Prompt 組裝 (Prompt Engineering)
提取出的文本會與一組嚴格定義的 **System Prompt** 組合。該 Prompt 規範 Claude 必須扮演簡報生成助手，並將內容濃縮為 5 種預先定義的投影片型態：
1. `cover` (封面頁)
2. `contents` (目錄頁)
3. `transition` (章節過場頁)
4. `content` (內文頁，包含標題與多個子主題項目)
5. `end` (結尾頁)
Prompt 強制要求模型僅能輸出純 JSON 陣列結構，不可包含任何口語解釋。

### 階段三：AWS Bedrock API 調用 (LLM Invocation)
後端透過 `callBedrock` 函式將組裝好的 Payload 傳送給 AWS Bedrock。透過 Axios 夾帶自訂的 `Bearer Token`，打向自訂的 Endpoint (企業內部 AI Gateway) 或標準 AWS 節點。此處選用 `Claude 3.5 Sonnet` 模型，發揮其強大的長文本歸納與 JSON 遵循能力。

### 階段四：防呆解析與格式轉接 (Parsing & Mapping)
當 LLM 回傳 JSON 後，後端經過 `parseAIJSON` (正則清洗與防護性解析) 確認無誤後，將大綱傳回前端。前端接收後，會觸發 **Data Mapping Adapter**，將扁平化的陣列轉換為 PPTist 排版引擎預期的巢狀物件格式（例如將回傳的 `subtitle` 對應到引擎所需的 `data.text`）。

### 階段五：智慧座標運算與渲染 (Layout Engine)
前端排版引擎 (`useAIPPT.ts`) 會載入一套隨機的內建美工樣板（樣板中已定義好文字方塊的絕對座標 `top/left/width/height`、顏色與字型）。引擎會根據 LLM 指定的投影片型態（如 `cover`），將文字一一「填入」對應的元素中。如果 LLM 生成的文字過長，引擎甚至會啟動 Auto-fitting 演算法自動縮小字級以防跑版。最後，引擎呼叫 Pinia 的 `slidesStore.setSlides()` 瞬間覆寫畫布，完成從「PDF 文件」到「精美排版簡報」的全自動轉換。
