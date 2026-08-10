import express from 'express';
import multer from 'multer';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入專案根目錄的 .env 檔案
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 設定 multer 記憶體儲存，以便直接傳遞 buffer 給各個解析器
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/feedback', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const pageTitle = String(req.body?.pageTitle || '').trim();
  const webhookUrl = String(process.env.GOOGLE_FEEDBACK_WEBHOOK_URL || '').trim();

  if (!message) return res.status(400).json({ success: false, error: '請輸入問題或建議。' });
  if (message.length > 4000) {
    return res.status(400).json({ success: false, error: '回報內容過長，請縮短後再送出。' });
  }
  if (!webhookUrl) {
    return res.status(503).json({ success: false, error: '問題回報尚未完成設定，請聯絡管理員。' });
  }

  try {
    await axios.post(webhookUrl, {
      message,
      pageTitle,
      submittedAt: new Date().toISOString(),
      token: process.env.GOOGLE_FEEDBACK_TOKEN || '',
    }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[Server] Feedback delivery failed:', error.message);
    return res.status(502).json({ success: false, error: '回報暫時無法送出，請稍後再試。' });
  }
});

// =========================================================
// 顏色名稱轉換輔助函式
// =========================================================
const colorMap = [
  { name: '紅色', hex: '#FF0000' }, { name: '深紅色', hex: '#8B0000' }, { name: '粉紅色', hex: '#FFC0CB' },
  { name: '橘色', hex: '#FFA500' }, { name: '黃色', hex: '#FFFF00' }, { name: '綠色', hex: '#008000' },
  { name: '淺綠色', hex: '#90EE90' }, { name: '深綠色', hex: '#006400' }, { name: '藍色', hex: '#0000FF' },
  { name: '淺藍色', hex: '#ADD8E6' }, { name: '深藍色', hex: '#00008B' }, { name: '靛色', hex: '#4B0082' },
  { name: '紫色', hex: '#800080' }, { name: '黑色', hex: '#000000' }, { name: '深灰色', hex: '#696969' },
  { name: '淺灰色', hex: '#D3D3D3' }, { name: '白色', hex: '#FFFFFF' }, { name: '棕色', hex: '#A52A2A' },
  { name: '金色', hex: '#FFD700' }, { name: '銀色', hex: '#C0C0C0' }, { name: '藏青色', hex: '#1a2332' },
  { name: '墨綠色', hex: '#2F4F4F' }, { name: '紫羅蘭', hex: '#EE82EE' }, { name: '藍綠色', hex: '#008080' }
];

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
}

function getNearestColorName(hex) {
  if (!hex || typeof hex !== 'string') return '預設顏色';
  const rgb = hexToRgb(hex);
  let minDistance = Infinity;
  let nearestName = '未知顏色';
  for (const color of colorMap) {
    const cRgb = hexToRgb(color.hex);
    const distance = Math.sqrt(Math.pow(rgb.r - cRgb.r, 2) + Math.pow(rgb.g - cRgb.g, 2) + Math.pow(rgb.b - cRgb.b, 2));
    if (distance < minDistance) {
      minDistance = distance;
      nearestName = color.name;
    }
  }
  return nearestName;
}

// =========================================================
// LLM (Bedrock) 呼叫函式
// =========================================================
async function callBedrock(messages, systemPrompt = null, maxTokens = 8192) {
  const bedrockApiKey = process.env.BEDROCK_API_KEY;
  const bedrockRegion = process.env.BEDROCK_REGION || 'us-east-1';
  const configuredModelId = String(process.env.BEDROCK_MODEL_ID || '').trim();
  // Railway users may enter the human-friendly model label. Bedrock endpoints
  // require the fully qualified model ID, so keep that common value usable.
  const modelId = /^(?:claude\s*)?3\.5\s*sonnet$/i.test(configuredModelId)
    ? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
    : (configuredModelId || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0');

  if (!bedrockApiKey) throw new Error('BEDROCK_API_KEY is not configured.');

  const endpoint = process.env.BEDROCK_ENDPOINT || `https://bedrock-runtime.${bedrockRegion}.amazonaws.com/model/${modelId}/invoke`;

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages,
  };

  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  try {
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${bedrockApiKey}`,
      },
    });

    return response.data?.content?.[0]?.text || '';
  } catch (error) {
    console.error('[Bedrock Axios Error]', error?.response?.data || error.message);
    throw new Error('呼叫 Bedrock API 失敗，請檢查金鑰或網路連線');
  }
}

// =========================================================
// 防護機制：強健的 JSON 解析與清洗
// =========================================================
function parseAIJSON(rawText) {
  let cleanedText = rawText.trim();
  cleanedText = cleanedText.replace(/^```(json)?/, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(cleanedText);
  } catch (err) {
    const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
    const objectMatch = cleanedText.match(/\{[\s\S]*\}/);

    try {
      if (arrayMatch && arrayMatch[0].length >= (objectMatch ? objectMatch[0].length : 0)) {
        return JSON.parse(arrayMatch[0]);
      } else if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
    } catch (regexErr) {
      throw new Error('AI 未能輸出有效的 JSON 格式，解析失敗');
    }
    throw new Error('AI 回傳內容不包含有效的 JSON 結構');
  }
}

// =========================================================
// 根據上傳的檔案類型，提取純文字內容
// =========================================================
async function extractTextFromFile(file) {
  const mimetype = file.mimetype || '';
  const originalname = (file.originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
    const pdfData = await pdfParse(file.buffer);
    return pdfData.text || '';
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    originalname.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }

  if (
    mimetype === 'text/plain' ||
    mimetype === 'text/markdown' ||
    originalname.endsWith('.txt') ||
    originalname.endsWith('.md')
  ) {
    return file.buffer.toString('utf-8');
  }

  console.warn(`[Server] 未知的檔案類型 ${mimetype}，嘗試以純文字讀取`);
  return file.buffer.toString('utf-8');
}

// =========================================================
// LLM 藍圖生成的 System Prompt
// 輔助函式：將 Navigator 的結構化問題轉為純文字（前端零改動）
// =========================================================
function formatQuestionsAsText(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return '請問您能提供更多關於這份簡報的資訊嗎？';
  }

  const lines = ['為了幫您生成最符合需求的簡報，請回答以下幾個問題：\n'];

  questions.forEach((q, idx) => {
    lines.push(`${idx + 1}. ${q.question}`);
    if (q.type === 'free_text' || !Array.isArray(q.options)) {
      lines.push('（請直接回答）');
    } else {
      q.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, D
        lines.push(`  ${letter}. ${opt}`);
      });
    }
    lines.push('');
  });

  lines.push('您可以直接回答，或在答案前標記選項字母（如「A」、「B」）。');
  return lines.join('\n');
}

/** Enforce the human-in-the-loop fields for every new deck request. */
function getMandatoryRequirementQuestions(prompt, isRequirementFollowup) {
  if (isRequirementFollowup) return [];

  const text = String(prompt || '').replace(/\s+/g, '');
  const delegated = /(?:直接做|直接生成|直接製作|你決定|自行決定|自由發揮|隨意|都可以|whatever|surpriseme)/i.test(text);
  if (delegated) return [];

  const questions = [];
  const hasGoal = /(?:目的|目標|用途|用於|目的是|要讓|希望(?:讓|協助)|提案|說服|教學|教育|報告|決策|募資|發布|分享)/.test(text);
  const hasAudience = /(?:受眾|聽眾|觀眾|讀者|對象|面向|給(?:誰|董事會|高階主管|主管|管理層|客戶|投資人|員工|同仁|學生)|董事會|高階主管|管理層|客戶|投資人|員工|同仁|學生)/.test(text);
  const hasPageCount = /(?:\d+\s*(?:頁|page)|[一二三四五六七八九十]+\s*頁|短版|長版|深入版)/i.test(text);
  // Do not treat a topic such as “科技趨勢” as a visual style. Generic
  // technology only counts when it is explicitly framed as a visual direction.
  const hasStyle = /(?:國泰|DataEco|國泰金控|科技藍圖|紫灰敘事|金棕高階|簡約鼠尾草|自由生成|自由設計|不要模板|不使用模板|簡約|極簡|留白|清爽|金融風格|科技風格|科技感|高階(?:感|風格)?|品牌風格|敘事風格|鼠尾草)/i.test(text);

  if (!hasGoal) {
    questions.push({
      id: 'goal',
      question: '這份簡報希望達成什麼目的？',
      type: 'single_select',
      options: ['協助主管決策（建議）', '向客戶／外部對象提案', '內部進度或策略報告', '教育與知識分享'],
    });
  }
  if (!hasAudience) {
    questions.push({
      id: 'audience',
      question: '這份簡報的主要受眾是誰？',
      type: 'single_select',
      options: ['高階主管與決策者（建議）', '部門同仁', '客戶或合作夥伴', '投資人或外部大眾'],
    });
  }
  if (!hasStyle) {
    questions.push({
      id: 'tone',
      question: '這份簡報希望採用哪一種視覺風格？',
      type: 'single_select',
      options: ['簡約', '科技', '金棕高階', '紫灰敘事', '沒想法'],
    });
  }
  if (!hasPageCount) {
    questions.push({
      id: 'pageCount',
      question: '這份簡報預計需要幾頁？',
      type: 'single_select',
      options: ['1～5 頁（精簡）', '6～10 頁（標準）', '11 頁以上（深入）', '沒想法，請 AI 決定'],
    });
  }
  return questions;
}

/** Once a length has been confirmed, downstream agents must preserve it exactly. */
function lockConfirmedPageCount(brief) {
  const pageCount = Number.parseInt(String(brief?.pageCount || ''), 10);
  if (!Number.isFinite(pageCount) || pageCount < 1) return;

  brief.pageCount = pageCount;
  const strictFields = Array.isArray(brief.strictFields) ? brief.strictFields : [];
  if (!strictFields.includes('pageCount')) strictFields.push('pageCount');
  brief.strictFields = strictFields;
}

/**
 * A requirement follow-up can be as short as "A" / "B" / "C". Do not
 * rely on the model to reconnect that letter to the page-count question in
 * chat history: normalize its answer before the downstream agents see it.
 */
function constrainPageCountFromReply(brief, reply) {
  const answer = String(reply || '').trim();
  let range = null;

  if (/^(?:A|選項\s*A|1\s*[～~\-]\s*5\s*頁?)/i.test(answer)) range = [1, 5];
  else if (/^(?:B|選項\s*B|6\s*[～~\-]\s*10\s*頁?)/i.test(answer)) range = [6, 10];
  else if (/^(?:C|選項\s*C|11\s*頁?以上)/i.test(answer)) range = [11, Infinity];

  if (!range) return;

  const requested = Number.parseInt(String(brief?.pageCount || ''), 10);
  const fallback = range[0] === 1 ? 5 : range[0] === 6 ? 8 : 11;
  const resolved = Number.isFinite(requested) ? requested : fallback;
  brief.pageCount = Math.min(range[1], Math.max(range[0], resolved));
  lockConfirmedPageCount(brief);
}

function detectNativeTemplateProfile(prompt) {
  const text = String(prompt || '');
  if (/(?:科技藍圖)/i.test(text)) return 'pptist-tech-blue';
  if (/(?:紫灰敘事)/i.test(text)) return 'pptist-plum-editorial';
  if (/(?:金棕高階)/i.test(text)) return 'pptist-gold-executive';
  if (/(?:簡約鼠尾草)/i.test(text)) return 'pptist-sage-minimal';
  return null;
}

function recommendNativeTemplateProfile(prompt) {
  const text = String(prompt || '').replace(/\s+/g, '');
  // Explicit visual directions take precedence over the subject matter.
  // For example, “簡約的科技趨勢簡報” must not be captured by 科技.
  if (/(?:簡約|極簡|留白|清爽|內部報告|教育)/.test(text)) return 'pptist-sage-minimal';
  if (/(?:董事會|高階|策略|投資|金融|年度|正式)/.test(text)) return 'pptist-gold-executive';
  if (/(?:品牌|研究|故事|敘事|行銷|提案)/.test(text)) return 'pptist-plum-editorial';
  if (/(?:AI|人工智慧|科技|數位|資安|資料|資訊|產品)/i.test(text)) return 'pptist-tech-blue';
  return null;
}

function isFreeformTemplateRequest(prompt) {
  return /(?:自由生成|自由設計|自由發揮|不使用模板|不要模板|無模板|從零設計)/.test(String(prompt || '').replace(/\s+/g, ''));
}

function detectTemplateColorOverride(prompt) {
  const text = String(prompt || '');
  const hex = text.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hex) return hex[0];

  if (!/(?:主色|顏色|色彩|配色|改成|改為|改用)/.test(text)) return null;
  const namedColors = {
    '深藍色': '#163A70', '藍色': '#2B6CB0', '靛藍色': '#3F51B5',
    '深紫色': '#5B3A8C', '紫色': '#7C5AA6', '酒紅色': '#7A2048',
    '紅色': '#C83E4D', '橘色': '#D97706', '金色': '#B8860B',
    '墨綠色': '#166534', '綠色': '#2F855A', '青綠色': '#168A8A',
    '黑色': '#1A202C', '灰色': '#5B6470',
  };
  return Object.entries(namedColors).find(([name]) => text.includes(name))?.[1] || null;
}

// =========================================================
// 路由：POST /api/edit — 意圖偵測與編輯（維持純 JSON 回傳）
// =========================================================
app.post('/api/edit', upload.single('file'), async (req, res) => {
  try {
    let prompt = req.body.prompt;
    let requirementPrompt = req.body.requirementPrompt;
    let slideData = req.body.slideData;
    let chatHistory = req.body.chatHistory;
    let forceIntent = req.body.forceIntent;
    const isRequirementFollowup = req.body.requirementFollowup === true || req.body.requirementFollowup === 'true';
    const isBlueprintFeedback = req.body.blueprintFeedback === true || req.body.blueprintFeedback === 'true';

    if (typeof slideData === 'string') {
      try { slideData = JSON.parse(slideData); } catch (_) {}
    }
    if (typeof chatHistory === 'string') {
      try { chatHistory = JSON.parse(chatHistory); } catch (_) { chatHistory = []; }
    }

    if (!prompt) {
      return res.status(400).json({ success: false, error: '未提供指令' });
    }
    requirementPrompt = String(requirementPrompt || prompt);

    // 若有附件，提取文字並附加到 prompt
    if (req.file) {
      console.log(`[Server] 偵測到附件：${req.file.originalname}，開始提取文字...`);
      try {
        const fileText = await extractTextFromFile(req.file);
        const MAX_CHARS = 40000;
        const truncated = fileText.length > MAX_CHARS
          ? fileText.substring(0, MAX_CHARS) + '\n\n[文件內容因長度限制已截斷]'
          : fileText;
        prompt = `${prompt}\n\n【附件內容 (${req.file.originalname})】：\n${truncated}`;
        console.log(`[Server] 附件文字提取完成：${fileText.length} 字元`);
      } catch (fileErr) {
        console.error('[Server] 附件解析失敗:', fileErr.message);
      }
    }

    console.log(`[Server] 收到指令：${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

    const filteredHistory = (chatHistory || []).filter(msg => msg && msg.content && msg.content.trim().length > 0);

    // --- 整合 Intent Classification 與 Edit 的 Edit_Skill ---
    let intent = forceIntent;
    let resultJSON = null;

    if (intent === 'generate') {
      console.log(`[Server] forceIntent 為 generate，跳過 Edit_Skill 分類，直接進入生成管線`);
    } else {
      let editSkillPrompt = '';
      try {
        editSkillPrompt = fs.readFileSync(join(__dirname, '../skills/Edit_Skill.md'), 'utf-8');
      } catch (e) {
        console.error('[Server] 讀取 Edit_Skill.md 失敗:', e);
        return res.status(500).json({ success: false, error: '系統設定檔遺失，無法啟動 AI 代理' });
      }

      const requestPayload = {
        prompt: prompt,
        slideData: slideData || {},
        chatHistory: filteredHistory
      };
      if (forceIntent) {
        requestPayload.forceIntent = forceIntent;
      }

      console.log(`[Server] 呼叫 Edit_Skill...`);
      const aiReply = await callBedrock([{ role: 'user', content: JSON.stringify(requestPayload, null, 2) }], editSkillPrompt, 8192);

      try {
        resultJSON = parseAIJSON(aiReply);
      } catch (e) {
        console.log('[Server] Edit_Skill 解析失敗，預設回退至 generate', e);
        resultJSON = { intent: 'generate' };
      }

      intent = resultJSON.intent;
      console.log(`[Server] Edit_Skill 回傳意圖：${intent}`);
    }

    // 除了 generate 以外，其他意圖 (chat, edit, edit_specific_page, batch_edit, ask_for_clarification)
    // 都可以直接回傳給前端，因為 Edit_Skill 已經完全照著前端需要的 schema 輸出
    if (intent !== 'generate') {
      if (intent === 'ask_for_clarification') {
        resultJSON.flow = 'edit';
      }
      return res.json(resultJSON);
    }

    // --- 三階段 Multi-Agent 架構 ---
    if (intent === 'generate') {

      // 讀取三個 Skill 檔案
      let requirementNavigatorPrompt = '';
      let contentStrategistPrompt = '';
      let layoutDesignerPrompt = '';
      try {
        requirementNavigatorPrompt = fs.readFileSync(join(__dirname, '../skills/requirement_navigator.md'), 'utf-8');
        contentStrategistPrompt    = fs.readFileSync(join(__dirname, '../skills/Content_Strategist.md'), 'utf-8');
        layoutDesignerPrompt       = fs.readFileSync(join(__dirname, '../skills/Layout_Designer.md'), 'utf-8');
      } catch (e) {
        console.error('[Server] 讀取 Agent Skills 失敗:', e);
        return res.status(500).json({ success: false, error: '系統設定檔遺失，無法啟動 AI 代理' });
      }

      // ───────────────────────────────────────────────
      // Agent 0：Requirement Navigator（需求引導）
      // ───────────────────────────────────────────────
      console.log('[Server] [Agent 0] 啟動需求引導 (Requirement Navigator)...');

      // 每次新的生成需求都不沿用上一份簡報的需求答案；只有回答本輪
      // Requirement Navigator 問卷時才帶入對話，讓它整合原始需求與回答。
      const isNavigatorFollowup = isRequirementFollowup || isBlueprintFeedback;
      const navigatorHistory = isNavigatorFollowup ? filteredHistory : [];
      const navigatorUserMessage = `【對話歷史】：\n${JSON.stringify(navigatorHistory)}\n\n【最新指令】：${requirementPrompt}\n\n請根據上述輸入，決定輸出 need_clarification 或 ready JSON：`;

      let navigatorResult = null;
      try {
        const navigatorReply = await callBedrock(
          [{ role: 'user', content: navigatorUserMessage }],
          requirementNavigatorPrompt
        );
        navigatorResult = parseAIJSON(navigatorReply);
      } catch (e) {
        // Navigator 解析失敗時，預設視為資訊充足，直接往下走，避免流程卡住
        console.warn('[Server] [Agent 0] Navigator 解析失敗，預設視為 ready：', e.message);
        navigatorResult = { status: 'ready', brief: { topic: prompt, pageCount: 8, mustInclude: [], dataNeeds: 'AI may fabricate plausible data', language: 'zh-TW' } };
      }

      // 即使模型推論了目的或受眾，新需求也必須先經過一次明確確認。
      const mandatoryQuestions = getMandatoryRequirementQuestions(requirementPrompt, isNavigatorFollowup);
      if (mandatoryQuestions.length > 0) {
        console.log('[Server] [Agent 0] 缺少目標或受眾，向使用者追問...');
        const questionText = formatQuestionsAsText(mandatoryQuestions);
        return res.json({
          success: true,
          intent: 'ask_for_clarification',
          questions: [questionText],
          flow: 'requirement_navigator'
        });
      }

      // 資訊不足：把結構化問題轉為純文字，直接回傳給前端
      if (navigatorResult.status === 'need_clarification') {
        console.log('[Server] [Agent 0] 資訊不足，向使用者追問...');
        const questionText = formatQuestionsAsText(navigatorResult.questions);
        return res.json({
          success: true,
          intent: 'ask_for_clarification',
          questions: [questionText],
          flow: 'requirement_navigator'
        });
      }

      // 資訊充足：提取 brief
      const brief = navigatorResult.brief || {};
      if (isNavigatorFollowup) {
        constrainPageCountFromReply(brief, requirementPrompt);
      }
      lockConfirmedPageCount(brief);
      const templateSelectionText = isNavigatorFollowup
        ? `${requirementPrompt}\n${filteredHistory.map(message => message.content).join('\n')}`
        : requirementPrompt;
      const explicitTemplateProfile = detectNativeTemplateProfile(templateSelectionText);
      // Only the newest answer may request freeform. Earlier assistant
      // questions contain the option “沒想法”, so they must not trigger it.
      const freeformTemplateRequest = isFreeformTemplateRequest(requirementPrompt);
      if (explicitTemplateProfile) {
        brief.templateProfile = explicitTemplateProfile;
        brief.brandProfile = null;
        brief.templateProfileSource = 'explicit';
      } else if (freeformTemplateRequest) {
        brief.templateProfile = null;
        brief.brandProfile = null;
        brief.templateProfileSource = 'freeform';
      } else if (!brief.brandProfile && !/(?:國泰|DataEco|國泰金控)/i.test(templateSelectionText)) {
        const recommendedTemplateProfile = recommendNativeTemplateProfile(templateSelectionText);
        brief.templateProfile = recommendedTemplateProfile;
        brief.templateProfileSource = recommendedTemplateProfile ? 'recommended' : 'freeform';
      }
      if (brief.templateProfile && !brief.brandProfile) {
        brief.templateColorOverride = detectTemplateColorOverride(templateSelectionText);
      }
      console.log(`[Server] [Agent 0] 需求確認完成，topic: ${brief.topic || '(未指定)'}，pageCount: ${brief.pageCount || '(未指定)'}`);

      // ───────────────────────────────────────────────
      // Agent 1：Content Strategist（帶 Brief）
      // ───────────────────────────────────────────────
      console.log('[Server] [Agent 1] 啟動企劃大腦 (Content Strategist)...');

      // 組合 Brief 摘要段落（只有有值的欄位才附上）
      const briefLines = ['【需求摘要 Brief（由 Requirement Navigator 確認）】：'];
      if (brief.topic)       briefLines.push(`- 主題：${brief.topic}`);
      if (brief.goal)        briefLines.push(`- 目標：${brief.goal}`);
      if (brief.audience)    briefLines.push(`- 受眾：${brief.audience}`);
      if (brief.occasion)    briefLines.push(`- 場合：${brief.occasion}`);
      if (brief.tone)        briefLines.push(`- 風格基調：${brief.tone}`);
      if (brief.pageCount)   briefLines.push(`- 頁數：${brief.pageCount} 頁`);
      if (brief.mustInclude && Array.isArray(brief.mustInclude) && brief.mustInclude.length > 0) {
        briefLines.push(`- 必須包含：${brief.mustInclude.join('、')}`);
      }
      if (brief.dataNeeds)   briefLines.push(`- 數據來源：${brief.dataNeeds}`);
      if (brief.brandColor)  briefLines.push(`- 品牌色：${brief.brandColor}`);
      if (brief.brandProfile) briefLines.push(`- 品牌模式：${brief.brandProfile}（此為固定設計系統，請完整保留）`);
      if (brief.templateProfile) briefLines.push(`- 原生模板模式：${brief.templateProfile}（固定使用其色彩、留白與頁型系統）`);
      if (brief.templateColorOverride) briefLines.push(`- 模板自訂主色：${brief.templateColorOverride}（保留版型，將此色延伸為完整配色）`);
      if (brief.language)    briefLines.push(`- 語言：${brief.language}`);
      if (brief.assumptions && Array.isArray(brief.assumptions) && brief.assumptions.length > 0) {
        briefLines.push(`- 推斷假設：${brief.assumptions.join('；')}`);
      }
      // ★ 修改 1：加入 strictFields — 這是 Requirement Navigator 最重要的輸出訊號，
      //    用來告知 Content Strategist 哪些欄位是使用者的硬性鎖定值（不可修改），
      //    若不傳遞，AI 可能靜默覆蓋使用者明確指定的品牌色、頁數、必包內容等。
      if (brief.strictFields && Array.isArray(brief.strictFields) && brief.strictFields.length > 0) {
        briefLines.push(`- ⚠️ 嚴格約束欄位（這些欄位的值是使用者的硬性要求，絕對不可更動）：${brief.strictFields.join('、')}`);
      }
      const briefSummary = briefLines.join('\n');

      const stage1UserMessage = [
        briefSummary,
        '',
        `【對話歷史】：\n${JSON.stringify(filteredHistory)}`,
        '',
        `【使用者原始指令】：${prompt}`,
        '',
        '請嚴格依照上方 Brief 的要求（尤其是頁數、主題、必要內容、strictFields 欄位），生成符合規範的 Semantic JSON 大綱：',
      ].join('\n');

      let semanticBlueprint = null;
      try {
        const stage1Reply = await callBedrock(
          [{ role: 'user', content: stage1UserMessage }],
          contentStrategistPrompt
        );
        semanticBlueprint = parseAIJSON(stage1Reply);
        console.log(`[Server] [Agent 1] 企劃完成，共規劃了 ${semanticBlueprint?.slides?.length || 0} 頁`);
      } catch (e) {
        console.error('[Server] [Agent 1] 企劃解析失敗:', e);
        return res.status(500).json({ success: false, error: '企劃大腦生成簡報大綱失敗，請重試' });
      }

      // ───────────────────────────────────────────────
      // Agent 2：Layout Designer（分批排版，每批最多 5 頁）
      // ───────────────────────────────────────────────
      console.log('[Server] [Agent 2] 啟動視覺排版引擎 (Layout Designer)...');
      const BATCH_SIZE = 5;
      const allSlides = semanticBlueprint.slides || [];
      const allLayoutSlides = [];
      let layoutBlueprint = null;

      try {
        for (let i = 0; i < allSlides.length; i += BATCH_SIZE) {
          const batchSlides = allSlides.slice(i, i + BATCH_SIZE);
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allSlides.length / BATCH_SIZE);
          console.log(`[Server] [Agent 2] 正在處理第 ${batchIndex}/${totalBatches} 批（第 ${i + 1}～${Math.min(i + BATCH_SIZE, allSlides.length)} 頁）...`);

          const batchBlueprint = { ...semanticBlueprint, slides: batchSlides };

          const batchHint = totalBatches > 1
            ? `（注意：這是第 ${batchIndex}/${totalBatches} 批，總計 ${allSlides.length} 頁，請確保此批內版型有變化，且與前一批不重複。）`
            : '';

          const stage2UserMessage = `【企劃大綱 (Semantic JSON)】${batchHint}：\n${JSON.stringify(batchBlueprint, null, 2)}\n\n請根據上述大綱，計算座標並輸出最終的排版指令 JSON：`;

          const stage2Reply = await callBedrock(
            [{ role: 'user', content: stage2UserMessage }],
            layoutDesignerPrompt,
            8192
          );

          const batchResult = parseAIJSON(stage2Reply);

          if (i === 0) {
            layoutBlueprint = { ...batchResult, slides: [] };
          }

          if (batchResult.slides && Array.isArray(batchResult.slides)) {
            allLayoutSlides.push(...batchResult.slides);
          }
        }

        layoutBlueprint.slides = allLayoutSlides;
        console.log(`[Server] [Agent 2] 排版計算完成！共 ${allLayoutSlides.length} 頁`);

        // 為了相容前端現有邏輯，把 final result 當作 blueprint 回傳給前端預覽
        layoutBlueprint.title = brief.topic || semanticBlueprint.title || 'AI 生成簡報';

        // 將 Agent 1 企劃出來的每頁細節，塞回 Agent 2 排版出來的 slide 中（前端藍圖預覽用）
        if (layoutBlueprint.slides && semanticBlueprint.slides) {
          layoutBlueprint.slides.forEach((slide, idx) => {
            const semanticSlide = semanticBlueprint.slides[idx];
            if (semanticSlide) {
              slide.title = semanticSlide.title;
              if (semanticSlide.subtitle) slide.subtitle = semanticSlide.subtitle;
              // DataEco 模板 ID 是前端固定版型的選擇器，不能因 Agent 2 漏輸出而遺失。
              if (semanticSlide.templateId) slide.templateId = semanticSlide.templateId;
              if (semanticSlide.templateRole) slide.templateRole = semanticSlide.templateRole;

              // ★ 修改 2：傳遞 pacing 欄位（anchor / dense / breathing）給前端藍圖預覽，
              //    讓 UI 可以顯示每頁的節奏標籤，也為未來前端可依此決定渲染風格預留鉤子。
              if (semanticSlide.pacing) slide.pacing = semanticSlide.pacing;

              const points = [];
              if (semanticSlide.text) points.push(semanticSlide.text);
              if (semanticSlide.bullets && Array.isArray(semanticSlide.bullets)) {
                points.push(...semanticSlide.bullets);
              }
              if (semanticSlide.cards && Array.isArray(semanticSlide.cards)) {
                semanticSlide.cards.forEach(card => {
                  if (card.title) points.push(`${card.title}${card.text ? '：' + card.text : ''}`);
                });
              }
              if (points.length > 0) slide.content_points = points;

              const descs = [];
              if (semanticSlide.chart) descs.push(`📊 包含 ${semanticSlide.chart.chartType || ''} 圖表`);
              if (semanticSlide.table) descs.push(`📋 包含表格資料`);
              if (semanticSlide.cards) descs.push(`🃏 包含 ${semanticSlide.cards.length} 個卡片`);
              if (descs.length > 0) slide.visual_or_chart_desc = descs.join('、');

              if (semanticBlueprint.theme && semanticBlueprint.theme.primary) {
                slide.color_theme = `主色：${getNearestColorName(semanticBlueprint.theme.primary)}`;
              }
            }
            // ★ 修改 3：移除「版型」中文前綴，直接使用 layout 代號（A-F）
            //    藍圖 UI 已設計為隱藏此欄位，但若未來要顯示，代號本身更簡潔。
            if (slide.layout) slide.layout_type = slide.layout;
            slide.page_number = idx + 1;
          });
        }

        // 將 Agent 1 產生的整個 theme 物件保留並交接給前端
        if (semanticBlueprint.theme) {
          layoutBlueprint.theme = semanticBlueprint.theme;
        }
        // 品牌模式是跨 Agent 的結構化契約，不能依賴 Layout Designer 是否重複輸出它。
        // 前端渲染器據此套用固定識別帶、漸層背景與字體。
        layoutBlueprint.brandProfile = semanticBlueprint.brandProfile || brief.brandProfile || null;
        // Native PPTist template profile follows the same root-level contract as DataEco.
        layoutBlueprint.templateProfile = brief.templateProfileSource === 'freeform'
          ? null
          : (brief.templateProfile || semanticBlueprint.templateProfile || null);
        layoutBlueprint.templateProfileSource = brief.templateProfileSource || (layoutBlueprint.templateProfile ? 'recommended' : 'freeform');
        layoutBlueprint.templateColorOverride = brief.templateColorOverride || semanticBlueprint.templateColorOverride || null;

        try {
          fs.writeFileSync(join(__dirname, 'last_blueprint.json'), JSON.stringify(layoutBlueprint, null, 2));
        } catch (e) {}

        return res.json({ success: true, intent: 'generate', blueprint: layoutBlueprint });
      } catch (e) {
        console.error('[Server] [Agent 2] 排版解析失敗:', e);
        return res.status(500).json({ success: false, error: `排版引擎計算座標失敗：${e.message}，請重試` });
      }
    }

    // (原本的 fallback 編輯區塊已經被 Edit_Skill 整合，這裡可以直接刪除，上面遇到 generate 以外的 intent 已提早 return res.json)

  } catch (error) {
    console.error('[Server] /api/edit error:', error);
    if (error.response) {
      console.error('[Server] API Response Data:', error.response.data);
    }
    res.status(500).json({
      success: false,
      error: error?.response?.data?.message || error.message || 'API 請求失敗',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Production uses one origin: Express serves the built Vue app and the API.
// This keeps Bedrock credentials on the server and avoids exposing a localhost
// address or a secret in the browser bundle.
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.listen(port, () => {
  console.log(`[Server] API 伺服器正在執行，監聽埠號 ${port}`);
});
