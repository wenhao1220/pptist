# Google Sheet 問題回報設定

本功能會把右上角「問題回報」表單送到 Google Sheet。回報者不需要登入 Google。

## 1. 建立工作表與 Apps Script

1. 在自己的 Google Drive 建立一份 Google Sheet，例如「PPTist 問題回報」。
2. 在 Sheet 選擇「擴充功能」→「Apps Script」。
3. 將預設程式全部替換成以下內容：

```javascript
function doPost(e) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('FEEDBACK_TOKEN');
  const data = JSON.parse(e.postData.contents || '{}');

  if (!expectedToken || data.token !== expectedToken) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['時間', '問題或建議', '聯絡方式', '簡報名稱']);
  }
  sheet.appendRow([
    data.submittedAt || new Date().toISOString(),
    data.message || '',
    data.contact || '',
    data.pageTitle || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. 設定驗證 token

1. 左側選「專案設定」→「指令碼屬性」。
2. 新增 `FEEDBACK_TOKEN`，填入一串自行產生的長隨機文字。
3. 保留此 token，下一步要填進 Railway；不要放進 GitHub。

## 3. 部署 Web App

1. 點「部署」→「新增部署作業」→ 類型選「網頁應用程式」。
2. Execute as 選「我」。Who has access 選「Anyone」。
3. 授權後複製 Web app URL（結尾通常是 `/exec`）。

## 4. 在 Railway 設定

到服務的 Variables 新增：

```text
GOOGLE_FEEDBACK_WEBHOOK_URL=<第 3 步的 Web app URL>
GOOGLE_FEEDBACK_TOKEN=<第 2 步建立的同一串 token>
```

按 Deploy，之後網站右上角的「問題回報」即可送進該 Google Sheet。
