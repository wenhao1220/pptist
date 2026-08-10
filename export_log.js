
const fs = require('fs');
const logPath = 'C:/Users/leeys/.gemini/antigravity-ide/brain/b6c6e0c0-288e-4b61-a00e-6c0b250e227a/.system_generated/logs/transcript.jsonl';
const outPath = 'C:/Users/leeys/Desktop/PPTist-master/對話紀錄.md';

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
let md = '# 今日對話紀錄\n\n';

for (const line of lines) {
  try {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT' && data.content) {
      let content = data.content;
      const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
      if (match) content = match[1].trim();
      md += '## ?? User (' + new Date(data.created_at).toLocaleString() + ')\n\n' + content + '\n\n';
    } else if (data.type === 'PLANNER_RESPONSE' && data.content) {
      md += '## ?? AI 助理 (' + new Date(data.created_at).toLocaleString() + ')\n\n' + data.content + '\n\n';
    }
  } catch(e) {}
}

fs.writeFileSync(outPath, md, 'utf8');
console.log('Done!');

