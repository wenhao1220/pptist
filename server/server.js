import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
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

const isProduction = process.env.NODE_ENV === 'production';
// Keep the short-term production PoC private by default. It is accessed through
// an SSH/SSM tunnel; an internal reverse proxy can set HOST explicitly later.
const listenHost = process.env.HOST || (isProduction ? '127.0.0.1' : undefined);
const parseBoundedInteger = (value, fallback, max) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const configuredOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins.length
  ? configuredOrigins
  : (isProduction ? [] : ['http://127.0.0.1:5173', 'http://localhost:5173']));
const maxUploadBytes = parseBoundedInteger(process.env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024, 25 * 1024 * 1024);
const apiRequestLimit = parseBoundedInteger(process.env.API_RATE_LIMIT_MAX, 60, 300);
const allowedUploadExtensions = new Set(['.pdf', '.docx', '.txt', '.md']);

// Behind an ALB/reverse proxy, opt in explicitly so rate limiting uses the
// original client IP. Do not trust forwarded headers on a directly exposed VM.
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({
  // The Vue app contains inline styles and may render user-selected remote
  // images. Keep CSP rollout separate rather than shipping a broken editor.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
// CORS only applies to API calls. Applying it globally also blocks static
// frontend files when the browser sends a same-origin Origin header.
// Support both the original root API and the shared-ALB /ppt/api prefix.
const apiRoutePrefixes = ['/api', '/ppt/api'];
app.use(apiRoutePrefixes, cors({
  origin(origin, callback) {
    // Same-origin server rendering and non-browser health checks have no
    // Origin header. Cross-origin browser requests must be explicitly listed.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('This origin is not allowed by the CORS policy.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));
app.use(apiRoutePrefixes, express.json({ limit: '5mb' }));
app.use(apiRoutePrefixes, rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: apiRequestLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: '請求過於頻繁，請稍後再試。' },
}));

// Only document formats that the application can parse are accepted. File
// size is capped before buffering so a public endpoint cannot exhaust memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const fileName = String(file.originalname || '').toLowerCase();
    const extension = fileName.slice(fileName.lastIndexOf('.'));
    if (!allowedUploadExtensions.has(extension)) {
      return callback(new Error('只支援 PDF、DOCX、TXT 或 MD 檔案。'));
    }
    return callback(null, true);
  },
});

app.post(['/api/feedback', '/ppt/api/feedback'], async (req, res) => {
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

// The WHY/HOW/WHAT DataEco page is a specialised explanatory framework, not a
// decorative three-column layout.  Reject accidental assignments such as
// "three mechanisms" or "three findings" before the layout agent sees them.
function slideIsExplicitWhyHowWhat(slide, requestText = '') {
  const fields = [
    slide?.title, slide?.subtitle, slide?.text,
    ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
    requestText,
  ].filter(Boolean).join(' ');
  const englishFramework = /\bwhy\b/i.test(fields) && /\bhow\b/i.test(fields) && /\bwhat\b/i.test(fields);
  const chineseFramework = /(?:為何|為什麼)/.test(fields)
    && /(?:如何|怎麼)/.test(fields)
    && /(?:做什麼|是什麼|什麼)/.test(fields);
  return englishFramework || chineseFramework;
}

function enforceDataEcoFrameworkTemplates(blueprint, requestText = '') {
  // A specialised layout is an editorial decision, not a recoverable-error
  // fallback.  Keep it selected and let the targeted single-slide repair
  // complete its semantic slots; silently converting it to a generic page is
  // precisely what makes a deck visually repetitive.
  void blueprint;
  void requestText;
}

const DATAECO_SPECIALIZED_TEMPLATE_ROLES = {
  'dataeco-process': 'process',
  'dataeco-timeline': 'timeline',
  'dataeco-pyramid': 'content_rail',
  'dataeco-alternating-steps': 'process',
  'dataeco-orbit-image': 'image_split',
  'dataeco-project-hub': 'content_rail',
  'dataeco-milestone-bar': 'timeline',
  'dataeco-why-how-what': 'content_rail',
};

/**
 * Make specialised DataEco layouts reachable without rotating a fixed list.
 * This only promotes a generic content slide when its actual semantic shape
 * has enough source-backed items to fill the target diagram.
 */
function assignCompatibleDataEcoTemplates(blueprint) {
  const slides = Array.isArray(blueprint?.slides) ? blueprint.slides : [];
  for (const slide of slides) {
    if (!slide || !['dataeco-content', 'content', undefined, null].includes(slide.templateId)) continue;
    if (slide.chart || slide.table) continue;

    const cards = Array.isArray(slide.cards) ? slide.cards : [];
    const items = [
      ...(Array.isArray(slide.bullets) ? slide.bullets : []),
      ...cards.map(card => card?.title || card?.label || card?.text || ''),
    ].map(item => String(item || '').trim()).filter(Boolean);
    const fields = [slide.title, slide.subtitle, slide.text, ...items].filter(Boolean).join(' ');
    const count = items.length;
    let templateId = null;

    // WHY/HOW/WHAT is deliberately strict: it is never inferred from an
    // arbitrary three-item list.
    if (count === 3 && /(?:\bwhy\b|\bhow\b|\bwhat\b|為何|為什麼|如何|怎麼|做什麼|是什麼)/i.test(fields)
      && /(?:\bwhy\b|為何|為什麼)/i.test(fields)
      && /(?:\bhow\b|如何|怎麼)/i.test(fields)
      && /(?:\bwhat\b|做什麼|是什麼)/i.test(fields)) {
      templateId = 'dataeco-why-how-what';
    } else if (count >= 5 && /(?:時程|時間|階段|里程碑|演進|roadmap|timeline)/i.test(fields)) {
      templateId = 'dataeco-milestone-bar';
    } else if (count >= 5 && /(?:專案|工作流|workstream|治理架構|推動架構)/i.test(fields)) {
      templateId = 'dataeco-project-hub';
    } else if (count >= 5 && /(?:層級|優先|成熟度|架構|hierarchy|priority)/i.test(fields)) {
      templateId = 'dataeco-pyramid';
    } else if (count >= 4 && /(?:流程|步驟|程序|機制|method|process)/i.test(fields)) {
      templateId = 'dataeco-alternating-steps';
    } else if (count >= 4 && /(?:核心|構面|面向|要點|因素|關鍵)/i.test(fields)) {
      templateId = 'dataeco-orbit-image';
    } else if (count >= 3 && /(?:流程|步驟|程序|方法|method|process)/i.test(fields)) {
      templateId = 'dataeco-process';
    } else if (count >= 3 && /(?:時程|時間|階段|演進|timeline)/i.test(fields)) {
      templateId = 'dataeco-timeline';
    }

    if (templateId) {
      slide.templateId = templateId;
      slide.templateRole = DATAECO_SPECIALIZED_TEMPLATE_ROLES[templateId];
    }
  }
}

// The model occasionally returns one or two extra outline pages despite a
// strict count.  This must not make the whole request fail.  Preserve the
// opening sequence and the final conclusion/closing page, and trim only the
// surplus middle pages.  We never manufacture new facts to fill a deck.
function trimBlueprintToPageCount(blueprint, targetCount) {
  if (!Array.isArray(blueprint?.slides) || !Number.isInteger(targetCount) || targetCount < 1) return false;
  if (blueprint.slides.length <= targetCount) return false;

  const slides = blueprint.slides;
  blueprint.slides = targetCount === 1
    ? [slides[0]]
    : [...slides.slice(0, targetCount - 1), slides[slides.length - 1]];
  return true;
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

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axios.post(endpoint, requestBody, {
        timeout: 90000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${bedrockApiKey}`,
        },
      });
      return response.data?.content?.[0]?.text || '';
    } catch (error) {
      const status = error?.response?.status;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500) || error?.code === 'ECONNABORTED';
      if (retryable && attempt < 2) {
        const delay = 800 * (attempt + 1);
        console.warn(`[Bedrock] 暫時失敗（${status || error.code}），${delay}ms 後重試 ${attempt + 1}/2`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error('[Bedrock Axios Error]', error?.response?.data || error.message);
      throw new Error('呼叫 Bedrock API 失敗，請檢查金鑰、模型額度或網路連線');
    }
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

/**
 * A deck must never silently switch to a generic subject just because an
 * uploaded source was unreadable or too large for the model context. Keep a
 * generous, explicit limit and fail closed instead of producing a deck from a
 * partial document.
 */
const MAX_SOURCE_TEXT_CHARS = 100000;

function buildUploadedSourceContext(fileName, text) {
  const sourceTitle = extractUploadedSourceTitle(text);
  return [
    `【使用者上傳文件：${fileName}】`,
    sourceTitle ? `【文件主標題：${sourceTitle}】` : '',
    '這是本次簡報的第一優先事實來源。簡報主題、章節、人物、時間、數字與結論都必須以此文件及使用者 Prompt 為準。',
    '不得以一般常識改寫成其他主題；文件未提及的事實、數字、案例或結論不得自行補造。若文件與 Prompt 有衝突，以使用者最新 Prompt 為準，並保留文件可支持的內容。',
    '【文件全文開始】',
    text,
    '【文件全文結束】',
  ].join('\n');
}

function extractUploadedSourceTitle(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const markdownTitle = lines.find(line => /^#\s+\S/.test(line));
  if (markdownTitle) return markdownTitle.replace(/^#+\s*/, '').trim().slice(0, 300);
  const labelledTitle = lines.find(line => /^(?:title|題目|標題)\s*[:：]/i.test(line));
  if (labelledTitle) return labelledTitle.replace(/^(?:title|題目|標題)\s*[:：]\s*/i, '').trim().slice(0, 300);
  return '';
}

/**
 * Find an actual presentation plan in an uploaded document.  This deliberately
 * ignores prose references such as "the report has 20 pages": only an
 * explicitly labelled brief or a numbered slide plan can decide deck length.
 */
function extractUploadedPagePlan(text) {
  const source = String(text || '');
  if (!source.trim()) return null;

  const explicit = source.match(/(?:簡報)?(?:頁數|投影片數|簡報頁數|預計頁數|總頁數)\s*(?:為|是|：|:)\s*(\d{1,2})\s*(?:頁|page|slides?)?/i);
  if (explicit) {
    const pageCount = Number.parseInt(explicit[1], 10);
    if (pageCount >= 1 && pageCount <= 30) return { pageCount, source: 'explicit' };
  }

  // A heading makes this unambiguous: ordinary numbered report sections must
  // not accidentally become a requested slide count.
  const planHeading = /(?:簡報|投影片|ppt|presentation).{0,12}(?:頁數)?(?:規劃|大綱|架構)|(?:頁數|投影片)規劃/i.test(source);
  if (!planHeading) return null;

  const pageNumbers = new Set();
  for (const line of source.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*•]\s*)?(?:第\s*)?(\d{1,2})\s*(?:頁|page|slide)\s*[:：.、\-]/i);
    if (match) pageNumbers.add(Number.parseInt(match[1], 10));
  }
  if (pageNumbers.size >= 2) {
    const sorted = [...pageNumbers].sort((a, b) => a - b);
    const isSequential = sorted.every((page, index) => page === index + 1);
    if (isSequential && sorted.length <= 30) return { pageCount: sorted.length, source: 'numbered_plan' };
  }
  return null;
}

/**
 * Lightweight, keyless research fallback. The returned dossier is evidence
 * for the content agent, not a license to make up missing figures. The agent
 * must only make factual claims that are supported by these sources or the
 * user-provided material.
 */
async function collectVerifiedResearch(topic) {
  const query = String(topic || '').trim();
  if (!query || process.env.WEB_RESEARCH_ENABLED === 'false') {
    return { status: 'disabled', sources: [] };
  }

  const timeout = 8000;
  const sources = [];
  const addSource = (title, url, excerpt) => {
    const cleanTitle = String(title || '').trim();
    const cleanUrl = String(url || '').trim();
    const cleanExcerpt = String(excerpt || '').replace(/\s+/g, ' ').trim();
    if (!cleanTitle || !cleanUrl || !cleanExcerpt) return;
    if (sources.some(source => source.url === cleanUrl)) return;
    sources.push({ title: cleanTitle, url: cleanUrl, excerpt: cleanExcerpt.slice(0, 1200) });
  };

  const [duckResult, wikiResult, duckHtmlResult] = await Promise.allSettled([
    axios.get('https://api.duckduckgo.com/', {
      params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
      timeout,
    }),
    axios.get('https://zh.wikipedia.org/w/api.php', {
      params: { action: 'query', list: 'search', srsearch: query, srlimit: 3, format: 'json', utf8: 1 },
      timeout,
    }),
    // The Instant Answer API often has no result for a current business or
    // technology topic.  Use DuckDuckGo's normal result page as a keyless
    // fallback so chart requests can still reach primary report sources.
    axios.get('https://html.duckduckgo.com/html/', {
      params: { q: `${query} statistics report` },
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }),
  ]);

  if (duckResult.status === 'fulfilled') {
    const data = duckResult.value?.data || {};
    addSource(data.Heading || query, data.AbstractURL, data.AbstractText);
    for (const item of Array.isArray(data.RelatedTopics) ? data.RelatedTopics : []) {
      if (sources.length >= 3) break;
      addSource(item.Text?.slice(0, 100) || query, item.FirstURL, item.Text);
    }
  }
  if (wikiResult.status === 'fulfilled') {
    const results = wikiResult.value?.data?.query?.search || [];
    for (const item of results) {
      if (sources.length >= 4) break;
      const title = String(item.title || '').trim();
      addSource(title, `https://zh.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, item.snippet?.replace(/<[^>]+>/g, ''));
    }
  }

  if (duckHtmlResult.status === 'fulfilled') {
    const html = String(duckHtmlResult.value?.data || '');
    const resultRegex = /result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?result__snippet[^>]*>([\s\S]*?)<\//gi;
    let match;
    while (sources.length < 6 && (match = resultRegex.exec(html))) {
      let url = String(match[1] || '').replace(/&amp;/g, '&');
      const uddg = url.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try { url = decodeURIComponent(uddg[1]); } catch { /* keep original URL */ }
      }
      const strip = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      addSource(strip(match[2]), url, strip(match[3]));
    }
  }

  // Search snippets identify a source but rarely contain enough numbers for a
  // chart. Read a small set of source documents and retain only numerical
  // sentences, so the strategist can build a chart from evidence rather than
  // falling back to an empty placeholder.
  await Promise.all(sources.slice(0, 3).map(async (source) => {
    try {
      const response = await axios.get(source.url, {
        timeout: 12000,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
      let text = '';
      if (contentType.includes('pdf') || /\.pdf(?:$|[?#])/i.test(source.url)) {
        const parsed = await pdfParse(Buffer.from(response.data));
        text = parsed.text || '';
      } else {
        text = Buffer.from(response.data).toString('utf8')
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;|&#160;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ');
      }
      const numericLines = text.split(/(?<=[.!?。！？])\s+|[\r\n]+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length >= 25 && line.length <= 420 && /\d/.test(line) && /(?:%|percent|million|billion|trillion|202[0-9]|倍|萬|億|兆)/i.test(line))
        .slice(0, 8);
      if (numericLines.length) source.excerpt = numericLines.join('\n');
    } catch (error) {
      // A source may block automated requests. Keep its search snippet; it is
      // still useful context, but it will not be treated as numeric evidence.
      console.warn('[Server] Research source read skipped:', source.url, error.message);
    }
  }));

  return { status: sources.length ? 'available' : 'unavailable', sources };
}

function formatResearchDossier(research) {
  if (!research?.sources?.length) {
    return '【外部查證結果】\n本次未取得可引用的公開來源。不得自行補造資料、數字、案例或時間點；若使用者資料不足，改以明確標示「待補資料」的文字說明，或要求使用者提供來源。';
  }
  const lines = ['【外部查證結果（只可使用下列來源支持事實）】'];
  research.sources.forEach((source, index) => {
    lines.push(`${index + 1}. ${source.title}\n   來源：${source.url}\n   摘要：${source.excerpt}`);
  });
  lines.push('只可採用上述來源或使用者提供資料可直接支持的事實；不可將摘要延伸為未被支持的數字、預測或結論。若使用者要求圖表，且上述摘要含可直接引用的數字，必須以那些數字建立 dataClass: "real" 的圖表並在頁面附來源；不可因圖表需求而改為空白 placeholder。');
  return lines.join('\n');
}

function getEvidencePolicyViolation(blueprint) {
  const slides = Array.isArray(blueprint?.slides) ? blueprint.slides : [];
  for (const [index, slide] of slides.entries()) {
    for (const visualType of ['chart', 'table']) {
      const visual = slide?.[visualType];
      if (!visual) continue;
      if (!['real', 'pending'].includes(visual.dataClass)) {
        return `第 ${index + 1} 頁的 ${visualType} 沒有標示為 dataClass: real 或 pending，可能含未查證或虛構資料`;
      }
      if (visual.dataClass === 'pending' && Array.isArray(visual.values) && visual.values.length > 0) {
        return `第 ${index + 1} 頁的 ${visualType} 標示為 pending 卻含有數值，可能把未查證資料畫成圖表`;
      }
      if (visual.dataClass === 'pending' && Array.isArray(visual.rows) && visual.rows.length > 0) {
        return `第 ${index + 1} 頁的 table 標示為 pending 卻含有資料列，可能把未查證資料畫成表格`;
      }
    }
  }
  return null;
}

function getPresentationQualityViolation(blueprint) {
  const slides = Array.isArray(blueprint?.slides) ? blueprint.slides : [];
  const placeholder = /請(?:填入|說明)(?:重點)?|第\s*[1-9一二三四五六七八九十]+\s*個(?:執行)?步驟|(?:第[一二三四五六七八九十0-9]+階段|現在)\s*的關鍵里程碑|(?:層級|重點)\s*[1-4]|^PROJECT$/m;
  for (const [index, slide] of slides.entries()) {
    const serialised = JSON.stringify(slide || {});
    if (placeholder.test(serialised)) {
      return `第 ${index + 1} 頁含有未完成的版型佔位文字，必須改為附件／來源支持的實際內容`;
    }
    if (slide?.templateId === 'dataeco-why-how-what') {
      const items = Array.isArray(slide.bullets) ? slide.bullets
        : (Array.isArray(slide.content_points) ? slide.content_points : []);
      const slotLabels = [
        /^(?:WHY|為何|為什麼|原因|動機)\s*[:：|｜-]/i,
        /^(?:HOW|如何|方法|做法|機制)\s*[:：|｜-]/i,
        /^(?:WHAT|什麼|產出|成果|行動)\s*[:：|｜-]/i,
      ];
      if (items.length !== 3 || items.some(item => !String(item || '').trim() || placeholder.test(String(item)))
        || items.some((item, itemIndex) => !slotLabels[itemIndex].test(String(item || '').trim()))) {
        return `第 ${index + 1} 頁使用 WHY/HOW/WHAT，但沒有依 WHY、HOW、WHAT 順序提供三項實際內容`;
      }
    }
    const slotRequirements = {
      'dataeco-pyramid': 5,
      'dataeco-alternating-steps': 4,
      'dataeco-orbit-image': 4,
      'dataeco-project-hub': 5,
      'dataeco-milestone-bar': 5,
    };
    const neededSlots = slotRequirements[slide?.templateId];
    if (neededSlots) {
      const items = [
        ...(Array.isArray(slide.bullets) ? slide.bullets : []),
        // A pyramid's fifth slot is commonly the slide's separate insight;
        // the renderer reads it after the four level bullets.
        ...(String(slide.text || '').trim() ? [slide.text] : []),
        ...(Array.isArray(slide.cards) ? slide.cards.flatMap(card => [card?.title, card?.text]) : []),
        ...(Array.isArray(slide.items) ? slide.items : []),
        ...(Array.isArray(slide.steps) ? slide.steps : []),
        ...(Array.isArray(slide.milestones) ? slide.milestones : []),
        ...(Array.isArray(slide.levels) ? slide.levels : []),
      ].map(item => typeof item === 'object' ? (item?.title || item?.label || item?.text || '') : item)
        .map(item => String(item || '').trim()).filter(Boolean);
      if (items.length < neededSlots || items.some(item => placeholder.test(item))) {
        return `第 ${index + 1} 頁的 ${slide.templateId} 缺少 ${neededSlots} 項可填入版型的實際內容`;
      }
    }
  }

  if (blueprint?.brandProfile === 'dataeco' && slides.length >= 8) {
    const ids = slides.map(slide => slide?.templateId).filter(Boolean);
    const genericCount = ids.filter(id => id === 'dataeco-content').length;
    const consecutiveGeneric = ids.some((id, index) => id === 'dataeco-content'
      && ids[index + 1] === id && ids[index + 2] === id);
    const minimumDistinct = slides.length >= 12 ? 5 : 4;
    if (genericCount > Math.ceil(slides.length * 0.45) || consecutiveGeneric || new Set(ids).size < minimumDistinct) {
      return `DataEco 版型分配過度單調；請依內容結構重選至少 ${minimumDistinct} 種相容版型，且一般內容頁不可連續三頁或佔多數`;
    }
  }
  return null;
}

// A source-backed four-level pyramid is structurally complete except for its
// concluding insight.  Preserve the selected diagram and derive that one
// connective sentence from the actual four levels instead of rejecting the
// whole deck because an LLM omitted a non-data slot.
function completeFourLevelPyramidInsight(slide) {
  if (slide?.templateId !== 'dataeco-pyramid') return;
  const bullets = Array.isArray(slide.bullets)
    ? slide.bullets.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  if (bullets.length !== 4 || String(slide.text || '').trim()) return;
  slide.text = `關鍵洞察：${bullets[0]}、${bullets[1]}、${bullets[2]}與${bullets[3]}必須連動推進，才能形成可規模化的整體能力。`;
}

// A targeted LLM repair may return only the fields it changed.  Preserve the
// source-grounded material already present on that slide and canonicalise it
// into the slots required by a selected fixed diagram.  This prevents an
// otherwise useful pyramid from aborting a 20+ page deck merely because the
// repair response omitted an unchanged bullet array.
function mergeAndCompleteSpecializedSlide(originalSlide, repairedSlide) {
  const mergeArray = (field) => {
    const repaired = Array.isArray(repairedSlide?.[field]) ? repairedSlide[field].filter(Boolean) : [];
    const original = Array.isArray(originalSlide?.[field]) ? originalSlide[field].filter(Boolean) : [];
    // Repair replies are often partial. Retain both sets, with the repaired
    // copy first, and de-duplicate primitive values.
    return [...repaired, ...original].filter((item, index, items) => {
      const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
      return items.findIndex(candidate => (typeof candidate === 'object' ? JSON.stringify(candidate) : String(candidate)) === key) === index;
    });
  };
  const merged = {
    ...(originalSlide || {}),
    ...(repairedSlide || {}),
    bullets: mergeArray('bullets'),
    cards: mergeArray('cards'),
    items: mergeArray('items'),
    steps: mergeArray('steps'),
    milestones: mergeArray('milestones'),
    levels: mergeArray('levels'),
  };
  merged.text = String(repairedSlide?.text || originalSlide?.text || '').trim();

  const flatten = (value) => {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value && typeof value === 'object') return flatten(value.title || value.label || value.text || value.description || '');
    return String(value || '').trim() ? [String(value).trim()] : [];
  };
  const rawCandidates = [
    merged.bullets, merged.levels, merged.items, merged.steps, merged.cards,
    // A repair sometimes returns the four ideas in a prose field. Split only
    // on natural clause boundaries; every result is still user/source text.
    String(repairedSlide?.text || ''), String(originalSlide?.text || ''),
  ].flatMap(flatten).flatMap(item => item.split(/[。；;、，,\n]+/));
  const candidates = [...new Set(rawCandidates.map(item => item.trim()).filter(item => item.length >= 4))];
  const requiredSlots = {
    'dataeco-pyramid': 4,
    'dataeco-alternating-steps': 4,
    'dataeco-orbit-image': 4,
    'dataeco-project-hub': 5,
    'dataeco-milestone-bar': 5,
  }[merged.templateId];
  if (requiredSlots && merged.bullets.length < requiredSlots && candidates.length >= requiredSlots) {
    merged.bullets = candidates.slice(0, requiredSlots);
  }

  if (merged.templateId === 'dataeco-why-how-what' && merged.bullets.length >= 3) {
    const labels = ['WHY', 'HOW', 'WHAT'];
    merged.bullets = merged.bullets.slice(0, 3).map((item, index) => {
      const copy = String(item || '').replace(/^(?:WHY|HOW|WHAT|為何|為什麼|原因|動機|如何|方法|做法|機制|什麼|產出|成果|行動)\s*[:：|｜-]\s*/i, '').trim();
      return `${labels[index]}：${copy}`;
    });
  }
  if (merged.templateId === 'dataeco-pyramid') completeFourLevelPyramidInsight(merged);
  return merged;
}

function applyUploadedSourceTitle(blueprint, sourceTitle) {
  if (!sourceTitle || !blueprint || typeof blueprint !== 'object') return;
  blueprint.title = sourceTitle;
  const slides = Array.isArray(blueprint.slides) ? blueprint.slides : [];
  const cover = slides.find(slide => slide?.type === 'cover') || slides[0];
  if (cover && typeof cover === 'object') cover.title = sourceTitle;
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
function getMandatoryRequirementQuestions(prompt, isRequirementFollowup, sourceText = '') {
  if (isRequirementFollowup) return [];

  const text = String(prompt || '').replace(/\s+/g, '');
  // Only regard explicit presentation-brief fields in an attachment as
  // answers. A research paper mentioning "eight pages" in prose must not
  // accidentally become the requested deck length.
  const sourceBrief = String(sourceText || '').slice(0, 8000);
  const delegated = /(?:直接做|直接生成|直接製作|你決定|自行決定|自由發揮|隨意|都可以|whatever|surpriseme)/i.test(text);

  const questions = [];
  const hasGoal = /(?:目的|目標|用途|用於|目的是|要讓|希望(?:讓|協助)|提案|說服|教學|教育|報告|決策|募資|發布|分享)/.test(text)
    || /(?:簡報)?(?:目的|目標|用途)\s*[:：]/.test(sourceBrief);
  const hasAudience = /(?:受眾|聽眾|觀眾|讀者|對象|面向|給(?:誰|董事會|高階主管|主管|管理層|客戶|投資人|員工|同仁|學生)|董事會|高階主管|管理層|客戶|投資人|員工|同仁|學生)/.test(text)
    || /(?:簡報)?(?:受眾|聽眾|對象)\s*[:：]/.test(sourceBrief);
  const sourcePagePlan = extractUploadedPagePlan(sourceBrief);
  const hasPageCount = /(?:\d+\s*(?:頁|page)|[一二三四五六七八九十]+\s*頁|短版|長版|深入版)/i.test(text)
    || !!sourcePagePlan
    || /(?:(?:頁數|投影片數|簡報頁數|slides?)\s*[:：]\s*\d+|(?:製作|生成|簡報).{0,12}\d+\s*(?:頁|page))/i.test(sourceBrief);
  const hasTone = /(?:國泰|dataeco|模板|簡約(?:風格|版)?|科技(?:風格|感)|金棕|紫灰|自由(?:生成|設計)|不要模板|金融風格|商務風格)/i.test(text)
    || /(?:簡報)?(?:風格|版型|模板)\s*[:：]/i.test(sourceBrief);
  // Do not treat a topic such as “科技趨勢” as a visual style. Generic
  // technology only counts when it is explicitly framed as a visual direction.

  if (!hasGoal && !delegated) {
    questions.push({
      id: 'goal',
      question: '這份簡報希望達成什麼目的？',
      type: 'single_select',
      options: ['協助主管決策', '向客戶／外部對象提案', '內部進度或策略報告', '教育與知識分享'],
    });
  }
  if (!hasAudience && !delegated) {
    questions.push({
      id: 'audience',
      question: '這份簡報的主要受眾是誰？',
      type: 'single_select',
      options: [
        '同事（協作細節、具體做法與分工）',
        '主管（進度回報、問題解決方案、成效、風險與待決策事項）',
        '協理／高階主管（策略影響、商業價值、取捨與回報）',
        '外部演講（故事性、易懂與互動）',
      ],
    });
  }
  if (!hasPageCount) {
    questions.push({
      id: 'pageCount',
      question: '這份簡報需要幾頁？請選擇範圍或明確頁數。',
      type: 'single_select',
      options: ['1～5 頁', '6～10 頁', '11 頁以上', '沒想法，請 AI 決定'],
    });
  }
  if (!hasTone && !delegated) {
    questions.push({
      id: 'tone',
      question: '這份簡報希望採用哪一種視覺風格？',
      type: 'single_select',
      options: ['簡約', '科技', '金棕高階', '紫灰敘事', '沒想法'],
    });
  }
  return questions;
}

/**
 * The Navigator can still ask a generic question even when the user stated
 * the answer in natural language.  Filter that model output against the
 * actual request before showing it, so "聽眾是教授、國泰風格" is never asked
 * again merely because it did not use the word "受眾" or "視覺風格".
 */
function filterAlreadyAnsweredNavigatorQuestions(questions, prompt, sourceText = '') {
  const request = String(prompt || '').replace(/\s+/g, '');
  const source = String(sourceText || '').slice(0, 8000);
  const sourcePlan = extractUploadedPagePlan(source);
  const hasAudience = /(?:受眾|聽眾|觀眾|讀者|對象|面向|教授|老師|指導教授|學生|同事|主管|管理層|客戶|投資人|員工|同仁|董事會)/i.test(request)
    || /(?:簡報)?(?:受眾|聽眾|對象)\s*[:：]/i.test(source);
  const hasTone = /(?:國泰|dataeco|國泰金控|模板|簡約(?:風格|版)?|科技(?:風格|感)|金棕|紫灰|自由(?:生成|設計)|不要模板|金融風格|商務風格)/i.test(request)
    || /(?:簡報)?(?:風格|版型|模板)\s*[:：]/i.test(source);
  const hasPageCount = /(?:\d+\s*(?:頁|page)|[一二三四五六七八九十]+\s*頁|短版|長版|深入版)/i.test(request) || !!sourcePlan;
  const isAudienceQuestion = (question) => /(?:受眾|聽眾|觀眾|讀者|對象|誰來看|溝通方式)/i.test(String(question?.question || ''));
  const isToneQuestion = (question) => /(?:風格|版型|模板|視覺|配色)/i.test(String(question?.question || ''));
  const isPageCountQuestion = (question) => /(?:幾頁|頁數|投影片數|長度)/i.test(String(question?.question || ''));

  return (Array.isArray(questions) ? questions : []).filter((question) =>
    !(hasAudience && isAudienceQuestion(question))
    && !(hasTone && isToneQuestion(question))
    && !(hasPageCount && isPageCountQuestion(question))
  );
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

/** Recover an exact page count from the user's own messages, never from the
 * assistant's range options. This remains reliable after a clarification turn
 * whose newest message is only "A" / "B" / "C". */
function getExplicitUserPageCount(currentPrompt, chatHistory = []) {
  const userMessages = (Array.isArray(chatHistory) ? chatHistory : [])
    .filter(message => message?.role === 'user')
    .map(message => String(message.content || ''));
  const candidates = [String(currentPrompt || ''), ...userMessages.reverse()];
  for (const text of candidates) {
    const match = text.match(/(?:共計?|約|大約|預計|需要|製作|生成|簡報[^。\n]{0,24}?)(\d{1,2})\s*(?:頁|page)/i)
      || text.match(/(\d{1,2})\s*(?:頁|page)/i);
    if (!match) continue;
    const pageCount = Number.parseInt(match[1], 10);
    if (Number.isFinite(pageCount) && pageCount >= 1 && pageCount <= 30) return pageCount;
  }
  return null;
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

/** Prefer the existing canvas whenever a concrete change is requested. */
function shouldForceCurrentSlideEdit(prompt, slideData, options = {}) {
  if (options.isRequirementFollowup || options.isBlueprintFeedback) return false;
  if (!slideData || !Array.isArray(slideData.elements)) return false;

  const text = String(prompt || '').replace(/\s+/g, '');
  const newDeck = /(?:製作|建立|生成|產生|做)一(?:份|個|套)?.{0,16}(?:簡報|投影片)|(?:從頭|全新).{0,12}(?:簡報|投影片)/i.test(text);
  const addSlides = /(?:新增|加入|多加|插入).{0,12}(?:一頁|投影片|目錄|封面|封底)/i.test(text);
  const deckWide = /(?:每一頁|每頁|整份|全部投影片|全簡報|所有頁)/i.test(text);
  const editAction = /(?:修正|調整|改成|改為|替換|刪除|移動|放大|縮小|對齊|變更|換成|加上|加一個)/i.test(text);
  const editTarget = /(?:標題|內文|文字|字體|顏色|色條|圖表|表格|圖片|元件|版面|位置|大小|背景)/i.test(text);
  return editAction && editTarget && !newDeck && !addSlides && !deckWide;
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

// Users often paste a complete chat reply that contains a ready-to-use prompt
// inside a Markdown code fence.  The explanatory prose before the fence is
// not a presentation request and can make the Navigator classify it as an
// edit/follow-up.  Prefer the longest fenced block that actually asks for a
// deck, while keeping ordinary user text unchanged.
function extractDeckPromptFromPaste(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  const fenced = [...text.matchAll(/```[^\n]*\n?([\s\S]*?)```/g)]
    .map(match => String(match[1] || '').trim())
    .filter(block => /(?:簡報|投影片|投影|slides?|ppt)/i.test(block));
  if (fenced.length) return fenced.sort((a, b) => b.length - a.length)[0];
  // Also handle a copied opening fence whose closing fence was omitted.
  const openingFence = text.search(/```(?:text|markdown|plaintext)?\s*/i);
  if (openingFence >= 0) {
    const afterFence = text.slice(openingFence).replace(/^```[^\n]*\n?/, '').trim();
    if (/(?:簡報|投影片|投影|slides?|ppt)/i.test(afterFence)) return afterFence;
  }
  return text;
}

// =========================================================
// 路由：POST /api/edit — 意圖偵測與編輯（維持純 JSON 回傳）
// =========================================================
app.post(['/api/edit', '/ppt/api/edit'], upload.single('file'), async (req, res) => {
  try {
    let prompt = req.body.prompt;
    let requirementPrompt = req.body.requirementPrompt;
    let slideData = req.body.slideData;
    let deckContext = req.body.deckContext;
    let chatHistory = req.body.chatHistory;
    let forceIntent = req.body.forceIntent;
    let isInsertionMode = req.body.insertionMode === true || req.body.insertionMode === 'true';
    const requestedInsertCountRaw = Number.parseInt(String(req.body.requestedInsertCount || '1'), 10);
    const requestedInsertCount = Number.isFinite(requestedInsertCountRaw)
      ? Math.min(10, Math.max(1, requestedInsertCountRaw))
      : 1;
    const isRequirementFollowup = req.body.requirementFollowup === true || req.body.requirementFollowup === 'true';
    const isBlueprintFeedback = req.body.blueprintFeedback === true || req.body.blueprintFeedback === 'true';

    if (typeof slideData === 'string') {
      try { slideData = JSON.parse(slideData); } catch (_) {}
    }
    if (typeof chatHistory === 'string') {
      try { chatHistory = JSON.parse(chatHistory); } catch (_) { chatHistory = []; }
    }
    // Client sends a plain-text digest of current slides. It is intentionally
    // capped: follow-up insertions need the report's facts and terminology,
    // not a second copy of the entire presentation payload.
    deckContext = typeof deckContext === 'string' ? deckContext.trim().slice(0, 30000) : '';

    if (!prompt) {
      return res.status(400).json({ success: false, error: '未提供指令' });
    }
    prompt = extractDeckPromptFromPaste(prompt);
    const rawRequirementPrompt = typeof requirementPrompt === 'string' ? extractDeckPromptFromPaste(requirementPrompt) : '';
    requirementPrompt = String(rawRequirementPrompt || prompt);
    // Server-side guard for old browser bundles or stale UI state: an explicit
    // request to create a numbered full deck must never be downgraded to the
    // front-end's default one-page insertion request.
    const explicitDeckGeneration = /(?:請)?(?:幫我)?(?:製作|生成|建立|設計|做)(?:一份|一個)?.{0,24}(?:\d+|[一二三四五六七八九十]+)\s*頁.{0,24}(?:簡報|投影片)/.test(prompt)
      || /(?:\d+|[一二三四五六七八九十]+)\s*頁.{0,16}(?:簡報|投影片)/.test(prompt);
    if (isInsertionMode && explicitDeckGeneration) {
      isInsertionMode = false;
      console.warn('[Server] 偵測到明確整份簡報頁數，忽略錯誤的 insertionMode=1 頁設定');
    }
    // Keep the user's own request separate from extracted source text. A
    // document mentioning "8 頁" is evidence, not an instruction to skip the
    // mandatory page-count question.
    const userRequirementPrompt = rawRequirementPrompt;

    // 若有附件，提取文字並讓它同時進入需求確認、內容規劃與後續
    // 排版流程；先前只附加到 prompt，Navigator 看不到來源而會把
    // 上傳文件錯判成一般主題。
    let uploadedSourceContext = '';
    let uploadedSourceTitle = '';
    let uploadedSourceCharacterCount = 0;
    let uploadedSourceText = '';
    let uploadedSourcePagePlan = null;
    if (req.file) {
      console.log(`[Server] 偵測到附件：${req.file.originalname}，開始提取文字...`);
      try {
        const fileText = await extractTextFromFile(req.file);
        if (!fileText.trim()) {
          return res.status(422).json({ success: false, error: '附件未擷取到可用文字，請確認檔案不是掃描影像或受密碼保護後再上傳。' });
        }
        if (fileText.length > MAX_SOURCE_TEXT_CHARS) {
          return res.status(413).json({ success: false, error: `附件文字共 ${fileText.length.toLocaleString()} 字，超過單次可完整處理的 ${MAX_SOURCE_TEXT_CHARS.toLocaleString()} 字上限。請拆分文件後重新上傳；系統不會使用截斷內容生成。` });
        }
        uploadedSourceTitle = extractUploadedSourceTitle(fileText);
        uploadedSourceCharacterCount = fileText.length;
        uploadedSourceText = fileText;
        uploadedSourcePagePlan = extractUploadedPagePlan(fileText);
        uploadedSourceContext = buildUploadedSourceContext(req.file.originalname, fileText);
        requirementPrompt = `${requirementPrompt}\n\n${uploadedSourceContext}`;
        // An attachment in the copilot is a request to create a deck from
        // that material. Do not let the edit-intent classifier route it to a
        // generic chat/edit path before the source-aware generation pipeline.
        if (!forceIntent && !isRequirementFollowup) forceIntent = 'generate';
        console.log(`[Server] 附件文字提取完成：${fileText.length} 字元`);
        if (uploadedSourcePagePlan) {
          console.log(`[Server] 偵測到附件頁數規劃：${uploadedSourcePagePlan.pageCount} 頁（${uploadedSourcePagePlan.source}）`);
        }
      } catch (fileErr) {
        console.error('[Server] 附件解析失敗:', fileErr.message);
        return res.status(422).json({ success: false, error: '附件解析失敗，系統已停止生成以避免忽略文件內容。請改用可選取文字的 PDF、DOCX、TXT 或 MD 檔。' });
      }
    }

    const existingDeckContext = isInsertionMode && deckContext
      ? `【既有簡報內容（新增頁的事實與用語來源）】\n${deckContext}\n【新增頁規則】只能根據上述既有內容與使用者要求撰寫。請提煉相關事實、術語、結果或脈絡，不得以「第一階段／關鍵里程碑」等通用預設字代替實際內容。\n`
      : '';

    console.log(`[Server] 收到指令：${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

    const filteredHistory = (chatHistory || []).filter(msg => msg && msg.content && msg.content.trim().length > 0);

    // --- 整合 Intent Classification 與 Edit 的 Edit_Skill ---
    // A current slide plus an actionable single-slide instruction is stronger
    // evidence than a probabilistic intent classification. This prevents an
    // ordinary edit from accidentally starting a brand-new generation flow.
    if (!forceIntent && shouldForceCurrentSlideEdit(prompt, slideData, { isRequirementFollowup, isBlueprintFeedback })) {
      forceIntent = 'edit';
      console.log('[Server] 偵測到目前投影片的具體修改指令，固定使用 edit 意圖');
    }
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
      const navigatorUserMessage = `【對話歷史】：\n${JSON.stringify(navigatorHistory)}\n\n【最新指令】：${requirementPrompt}\n\n${isNavigatorFollowup ? '【本輪回答規則】使用者正在回答上一輪的整組問題。請依題號解讀如「1A 2B 3C 4D」的回答，並直接輸出 ready JSON；不得重複詢問已列出的問題。\n\n' : ''}${uploadedSourceContext ? '【附件規則】上傳文件是本次簡報的第一優先來源；請從文件擷取主題與必含內容，不能改成無關主題。\n\n' : ''}請根據上述輸入，決定輸出 need_clarification 或 ready JSON：`;

      let navigatorResult = null;
      try {
        const navigatorReply = await callBedrock(
          [{ role: 'user', content: navigatorUserMessage }],
          requirementNavigatorPrompt
        );
        navigatorResult = parseAIJSON(navigatorReply);
      } catch (e) {
        // 需求確認解析失敗時必須 fail closed。不能以預設八頁和虛構
        // 資料繼續生成，否則既會忽略附件也會違反資料正確性規則。
        console.warn('[Server] [Agent 0] Navigator 解析失敗，要求使用者重新確認：', e.message);
        navigatorResult = {
          status: 'need_clarification',
          questions: [{ question: '需求確認暫時無法解析。請重新提供簡報主題、頁數與資料來源；系統不會自行猜測或虛構內容。', type: 'free_text' }],
        };
      }

      // An insertion is a bounded edit to an existing deck. Do not run the
      // new-deck requirements interview again: it loses the requested page
      // count and turns "add one page" into a regenerated 9-page deck.
      if (isInsertionMode) {
        const currentTitle = slideData?.elements?.find?.(element => element?.type === 'title')?.content || '';
        const deckTitle = String(deckContext).match(/投影片\s*1[：:]\s*([^；\n]+)/)?.[1] || '';
        navigatorResult = {
          status: 'ready',
          brief: {
            topic: uploadedSourceTitle || deckTitle || currentTitle || '既有簡報補充內容',
            goal: '補充既有簡報指定內容',
            audience: '沿用既有簡報受眾',
            tone: '沿用既有簡報風格',
            pageCount: requestedInsertCount,
            mustInclude: [String(prompt || '')],
            language: 'zh-TW',
            strictFields: ['pageCount'],
          },
        };
      }

      if (navigatorResult?.status === 'need_clarification') {
        const originalQuestionCount = Array.isArray(navigatorResult.questions) ? navigatorResult.questions.length : 0;
        navigatorResult.questions = filterAlreadyAnsweredNavigatorQuestions(
          navigatorResult.questions,
          userRequirementPrompt,
          uploadedSourceText
        );
        if (navigatorResult.questions.length !== originalQuestionCount) {
          console.log(`[Server] [Agent 0] 已移除 ${originalQuestionCount - navigatorResult.questions.length} 個使用者已回答的追問`);
        }
      }

      // 即使模型推論了目的或受眾，新需求也必須先經過一次明確確認。
      const mandatoryQuestions = isInsertionMode
        ? []
        : getMandatoryRequirementQuestions(userRequirementPrompt, isNavigatorFollowup, uploadedSourceText);
      if (mandatoryQuestions.length > 0) {
        console.log('[Server] [Agent 0] 缺少目標或受眾，向使用者追問...');
        const questionText = formatQuestionsAsText(mandatoryQuestions);
        return res.json({
          success: true,
          intent: 'ask_for_clarification',
          questions: [questionText],
          flow: 'requirement_navigator',
          sourceMeta: uploadedSourceContext ? { fileName: req.file.originalname, title: uploadedSourceTitle, characters: uploadedSourceCharacterCount } : null,
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
          flow: 'requirement_navigator',
          sourceMeta: uploadedSourceContext ? { fileName: req.file.originalname, title: uploadedSourceTitle, characters: uploadedSourceCharacterCount } : null,
        });
      }

      // 資訊充足：提取 brief
      const brief = navigatorResult.brief || {};
      if (isInsertionMode) {
        brief.pageCount = requestedInsertCount;
        lockConfirmedPageCount(brief);
      } else if (isNavigatorFollowup) {
        constrainPageCountFromReply(brief, requirementPrompt);
      }
      // A literal request such as "8 頁" always wins over the navigator's
      // estimate, including after the user later answers requirement choices.
      if (!isInsertionMode) {
        const explicitUserPageCount = getExplicitUserPageCount(userRequirementPrompt, filteredHistory);
        if (explicitUserPageCount) brief.pageCount = explicitUserPageCount;
        // A user may answer the follow-up with「頁數請參照附件」rather than
        // repeating a number.  In that case the attachment plan is an
        // explicit instruction, not merely background evidence.
        if (uploadedSourcePagePlan && !explicitUserPageCount) {
          brief.pageCount = uploadedSourcePagePlan.pageCount;
          brief.pagePlanSource = 'uploaded_attachment';
        }
        lockConfirmedPageCount(brief);
      }
      if (uploadedSourceContext) {
        brief.sourceMode = 'uploaded_file';
        brief.sourceOfTruth = req.file.originalname;
        brief.sourceTitle = uploadedSourceTitle || null;
        brief.dataPolicy = 'source_or_verified_research_only';
        // A document's declared title is deterministic metadata, not an LLM
        // inference. Lock it into the Brief so a generic classifier cannot
        // replace a research paper with an unrelated industry topic.
        if (uploadedSourceTitle) brief.topic = uploadedSourceTitle;
        const strictFields = Array.isArray(brief.strictFields) ? brief.strictFields : [];
        for (const field of ['topic', 'mustInclude', 'dataNeeds']) {
          if (!strictFields.includes(field)) strictFields.push(field);
        }
        brief.strictFields = strictFields;
      }
      const templateSelectionText = isNavigatorFollowup
        ? `${requirementPrompt}\n${filteredHistory.map(message => message.content).join('\n')}`
        : requirementPrompt;
      // "國泰" / "DataEco" is an explicit request for the fixed DataEco
      // design system. It must take priority over a previously recommended
      // native template (or a theme guessed by an earlier agent), otherwise
      // the two palettes can be mixed on the same slide.
      const explicitDataEcoProfile = /(?:國泰|DataEco|國泰金控)/i.test(templateSelectionText);
      const explicitTemplateProfile = detectNativeTemplateProfile(templateSelectionText);
      // Only the newest answer may request freeform. Earlier assistant
      // questions contain the option “沒想法”, so they must not trigger it.
      const freeformTemplateRequest = isFreeformTemplateRequest(requirementPrompt);
      if (explicitDataEcoProfile) {
        brief.brandProfile = 'dataeco';
        brief.templateProfile = null;
        brief.templateColorOverride = null;
        brief.templateProfileSource = 'dataeco';
      } else if (explicitTemplateProfile) {
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
      if (brief.presentationStyle) briefLines.push(`- 表達策略：${brief.presentationStyle}`);
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
      if (brief.sourceOfTruth) briefLines.push(`- 第一優先資料來源：${brief.sourceOfTruth}（內容不可偏離此來源）`);
      if (brief.sourceTitle) briefLines.push(`- 文件主標題（固定）：${brief.sourceTitle}。封面與大綱必須明確呈現此研究／文件主題，不可改成相鄰領域。`);
      briefLines.push('- 資料正確性規則：僅可使用使用者提供資料或可追溯的網路查證來源；禁止虛構任何事實、數字、案例、人物、日期或引用。資料不足時必須明確標示待補資料或要求來源。');
      // ★ 修改 1：加入 strictFields — 這是 Requirement Navigator 最重要的輸出訊號，
      //    用來告知 Content Strategist 哪些欄位是使用者的硬性鎖定值（不可修改），
      //    若不傳遞，AI 可能靜默覆蓋使用者明確指定的品牌色、頁數、必包內容等。
      if (brief.strictFields && Array.isArray(brief.strictFields) && brief.strictFields.length > 0) {
        briefLines.push(`- ⚠️ 嚴格約束欄位（這些欄位的值是使用者的硬性要求，絕對不可更動）：${brief.strictFields.join('、')}`);
      }
      const briefSummary = briefLines.join('\n');

      let researchDossier = '';
      try {
        // Include the user's requested visuals in the query.  A topic-only
        // query (for example "2026 technology trends") can miss the public
        // report/statistics pages needed to populate an explicitly requested
        // chart or comparison table.
        const researchQuery = `${brief.topic || requirementPrompt} ${/圖表|折線圖|長條圖|圓餅圖|chart|table/i.test(String(prompt || '')) ? 'statistics report data' : ''}`.trim();
        const research = await collectVerifiedResearch(researchQuery);
        researchDossier = formatResearchDossier(research);
        console.log(`[Server] [Research] 查證來源：${research.sources.length} 筆 (${research.status})`);
      } catch (researchError) {
        console.warn('[Server] [Research] 查證服務暫時不可用：', researchError.message);
        researchDossier = formatResearchDossier({ status: 'unavailable', sources: [] });
      }

      const stage1UserMessage = [
        briefSummary,
        '',
        uploadedSourceContext,
        uploadedSourceContext ? '' : null,
        existingDeckContext,
        existingDeckContext ? '' : null,
        researchDossier,
        '',
        `【對話歷史】：\n${JSON.stringify(filteredHistory)}`,
        '',
        `【使用者原始指令】：${prompt}`,
        '',
        '請嚴格依照上方 Brief 的要求（尤其是頁數、主題、必要內容、strictFields 欄位），生成符合規範的 Semantic JSON 大綱：',
      ].join('\n');

      let semanticBlueprint = null;
      try {
        const requestedSemanticPageCount = Number.parseInt(String(brief.pageCount || ''), 10);
        // Long decks used to ask one model response to carry every slide's
        // JSON.  Around 20 pages that is prone to output-token truncation,
        // which then looks like a generic generation failure.  Keep the
        // semantic narrative in bounded batches; the existing layout stage
        // already uses the same strategy.
        if (Number.isFinite(requestedSemanticPageCount) && requestedSemanticPageCount > 12) {
          const semanticBatchSize = 5;
          const batchTotal = Math.ceil(requestedSemanticPageCount / semanticBatchSize);
          const batchRequests = [];
          for (let offset = 0; offset < requestedSemanticPageCount; offset += semanticBatchSize) {
            const batchCount = Math.min(semanticBatchSize, requestedSemanticPageCount - offset);
            const batchNumber = Math.floor(offset / semanticBatchSize) + 1;
            const firstPage = offset + 1;
            const lastPage = offset + batchCount;
            const batchInstruction = [
              `【長篇簡報分批企劃】這是第 ${batchNumber}/${batchTotal} 批，只輸出全簡報第 ${firstPage}～${lastPage} 頁，共 ${batchCount} 頁。`,
              `slides 陣列必須剛好 ${batchCount} 筆；不要輸出其他頁、不要以摘要取代頁面、不要輸出說明文字。`,
              firstPage === 1 ? '第 1 頁必須是有具體鉤子的 cover。' : '這一批不可再產生 cover 或目錄；直接延續簡報敘事。',
              lastPage === requestedSemanticPageCount ? `第 ${lastPage} 頁必須是有具體結論或下一步的 closing。` : `第 ${lastPage} 頁不可產生 closing／感謝頁，請留下可自然銜接下一批的實質內容。`,
              '每頁聚焦不同面向、標題不可重複；有完整可驗證數值才使用 chart/table，並依資料結構選擇 bar、line 或 pie。',
              '本批五頁必須依資訊結構使用至少三種相容的 DataEco 版型；不得連續使用一般內容頁，也不可為了湊版型而填入預設字或虛構內容。',
            ].join('\n');
            batchRequests.push({ batchNumber, batchCount, firstPage, lastPage, batchInstruction });
          }
          // Batches are independent sections of the same fixed brief, so run
          // them concurrently. This keeps the HTTP request within the ALB
          // timeout budget instead of making a 20-page deck wait for every
          // model call serially.
          const batchBlueprints = await Promise.all(batchRequests.map(async (batch) => {
            console.log(`[Server] [Agent 1] 正在處理第 ${batch.batchNumber}/${batchTotal} 批企劃（第 ${batch.firstPage}～${batch.lastPage} 頁）...`);
            const batchReply = await callBedrock(
              [{ role: 'user', content: `${stage1UserMessage}\n\n${batch.batchInstruction}` }],
              contentStrategistPrompt,
              8192
            );
            const batchBlueprint = parseAIJSON(batchReply);
            if (!Array.isArray(batchBlueprint?.slides) || batchBlueprint.slides.length !== batch.batchCount) {
              throw new Error(`第 ${batch.batchNumber} 批企劃頁數不符：要求 ${batch.batchCount} 頁，實際 ${batchBlueprint?.slides?.length || 0} 頁`);
            }
            return batchBlueprint;
          }));
          semanticBlueprint = {
            ...batchBlueprints[0],
            slides: batchBlueprints.flatMap(batch => batch.slides),
          };
          semanticBlueprint.slides.forEach((slide, index) => { slide.id = `slide-${index + 1}`; });
        } else {
          const stage1Reply = await callBedrock(
            [{ role: 'user', content: stage1UserMessage }],
            contentStrategistPrompt
          );
          semanticBlueprint = parseAIJSON(stage1Reply);
        }
        applyUploadedSourceTitle(semanticBlueprint, uploadedSourceTitle);
        if (brief.brandProfile === 'dataeco') {
          semanticBlueprint.brandProfile = 'dataeco';
          semanticBlueprint.templateProfile = null;
          semanticBlueprint.templateColorOverride = null;
          semanticBlueprint.theme = {
            ...(semanticBlueprint.theme || {}),
            brandProfile: 'dataeco',
            primary: '#01A964', secondary: '#3ABA8D', accent: '#008A45',
            bg: '#FFFFFF', background: '#FFFFFF', surfaceColor: '#DDF4E9',
            textDark: '#101828', textLight: '#FFFFFF',
            accentPalette: ['#01A964', '#3ABA8D', '#76D7A8', '#008A45'],
          };
        }
        const requiredPageCount = Number.parseInt(String(brief.pageCount || ''), 10);
        // Select diagrams from the actual semantic structure before validating
        // their slots.  This ordering is important: a newly promoted pyramid
        // must be completed/repaired as a pyramid, never validated as generic
        // content and converted afterwards.
        if (brief.brandProfile === 'dataeco') {
          assignCompatibleDataEcoTemplates(semanticBlueprint);
          enforceDataEcoFrameworkTemplates(
            semanticBlueprint,
            Array.isArray(brief.mustInclude) ? brief.mustInclude.join(' ') : String(prompt || '')
          );
          semanticBlueprint.slides?.forEach(completeFourLevelPyramidInsight);
        }
        // In insertion mode the requested count is a hard output cap.  Do not
        // ask the strategist to rebuild a whole deck merely because it returned
        // more slides than were requested; the final guard below keeps only the
        // exact number of new slides.
        const initialSlideCount = Array.isArray(semanticBlueprint?.slides)
          ? semanticBlueprint.slides.length
          : 0;
        // Repair only an incomplete specialised page.  A 20-page deck is
        // intentionally batched; asking the model to rewrite the entire deck
        // because one pyramid lacks its insight is slow and can time out.
        if (brief.brandProfile === 'dataeco' && Array.isArray(semanticBlueprint?.slides)) {
          for (const [slideIndex, slide] of semanticBlueprint.slides.entries()) {
            const slotViolation = getPresentationQualityViolation({ slides: [slide] });
            const isSpecializedSlotViolation = slotViolation
              && /(?:WHY\/HOW\/WHAT|缺少\s*\d+\s*項)/.test(slotViolation)
              && String(slide?.templateId || '').startsWith('dataeco-');
            if (!isSpecializedSlotViolation) continue;

            const pageSpecificViolation = String(slotViolation).replace(/^第\s*1\s*頁/, `第 ${slideIndex + 1} 頁`);
            console.warn(`[Server] [Agent 1] ${pageSpecificViolation}；正在定向補齊第 ${slideIndex + 1} 頁內容。`);
            const repairInstruction = [
              stage1UserMessage,
              '',
              `【單頁版型內容修復】只輸出一頁 Semantic JSON，slides 陣列必須剛好 1 筆。`,
              `這是全簡報第 ${slideIndex + 1} 頁，必須保留 templateId: "${slide.templateId}" 與標題主題，不可換成一般內容頁。`,
              `目前不完整的頁面：${JSON.stringify(slide)}`,
              `修復原因：${slotViolation}。請從使用者資料與來源補足該版型的每一個內容槽位；不得使用佔位文字、不得虛構數字。`,
              `金字塔必須有四個層級 bullets 與一段關鍵洞察 text；四步驟版型必須有四個實際步驟；環狀圖必須有四項真實要點；專案放射圖必須有核心專案說明加四條工作流；五節點里程碑必須有五個真實時間節點；WHY/HOW/WHAT 必須剛好三個 bullets，並分別以「WHY：」「HOW：」「WHAT：」開頭，依序填入原因、方法、產出。`,
            ].join('\n');
            const repairedReply = await callBedrock(
              [{ role: 'user', content: repairInstruction }],
              contentStrategistPrompt,
              8192
            );
            const repairedBlueprint = parseAIJSON(repairedReply);
            const repairedSlideResponse = Array.isArray(repairedBlueprint?.slides) ? repairedBlueprint.slides[0] : null;
            if (!repairedSlideResponse) throw new Error(`第 ${slideIndex + 1} 頁定向修復未回傳投影片`);
            repairedSlideResponse.id = slide.id || `slide-${slideIndex + 1}`;
            repairedSlideResponse.templateId = slide.templateId;
            repairedSlideResponse.templateRole = slide.templateRole;
            const repairedSlide = mergeAndCompleteSpecializedSlide(slide, repairedSlideResponse);
            const repairedViolation = getPresentationQualityViolation({ slides: [repairedSlide] });
            if (repairedViolation) throw new Error(`第 ${slideIndex + 1} 頁定向修復仍不完整：${repairedViolation}`);
            semanticBlueprint.slides[slideIndex] = repairedSlide;
          }
        }
        // Apply the same bounded repair strategy to an invalid chart/table.
        // A single pending visual with numbers must never cause a full-deck
        // retry; retain its page and repair its evidence classification only.
        if (Array.isArray(semanticBlueprint?.slides)) {
          for (const [slideIndex, slide] of semanticBlueprint.slides.entries()) {
            const evidenceViolationForSlide = getEvidencePolicyViolation({ slides: [slide] });
            if (!evidenceViolationForSlide) continue;
            const pageSpecificViolation = String(evidenceViolationForSlide).replace(/^第\s*1\s*頁/, `第 ${slideIndex + 1} 頁`);
            console.warn(`[Server] [Agent 1] ${pageSpecificViolation}；正在定向修復圖表／表格資料。`);
            const visualRepairInstruction = [
              stage1UserMessage,
              '',
              `【單頁資料修復】只輸出一頁 Semantic JSON，slides 陣列必須剛好 1 筆。`,
              `這是全簡報第 ${slideIndex + 1} 頁；保留原本主題與 templateId: "${slide.templateId || 'dataeco-content'}"。`,
              `目前不合格的頁面：${JSON.stringify(slide)}`,
              `修復原因：${pageSpecificViolation}。若數值能由上方使用者資料或外部查證結果直接支持，使用 dataClass: "real" 並保留完整 labels/values；否則使用 dataClass: "pending" 且刪除所有 values 或 table rows，並以文字說明缺少哪份來源。禁止虛構資料。`,
            ].join('\n');
            const repairedReply = await callBedrock(
              [{ role: 'user', content: visualRepairInstruction }],
              contentStrategistPrompt,
              8192
            );
            const repairedBlueprint = parseAIJSON(repairedReply);
            const repairedSlide = Array.isArray(repairedBlueprint?.slides) ? repairedBlueprint.slides[0] : null;
            if (!repairedSlide) throw new Error(`第 ${slideIndex + 1} 頁資料修復未回傳投影片`);
            repairedSlide.id = slide.id || `slide-${slideIndex + 1}`;
            repairedSlide.templateId = slide.templateId || repairedSlide.templateId;
            repairedSlide.templateRole = slide.templateRole || repairedSlide.templateRole;
            const repairedEvidenceViolation = getEvidencePolicyViolation({ slides: [repairedSlide] });
            if (repairedEvidenceViolation) throw new Error(`第 ${slideIndex + 1} 頁資料修復仍不符合規則：${repairedEvidenceViolation}`);
            semanticBlueprint.slides[slideIndex] = repairedSlide;
          }
        }
        // An over-complete but valid outline can be safely trimmed by the
        // server-side guard below. Only an under-complete outline needs an AI
        // repair; asking the model to rewrite a valid 20+ page JSON increases
        // the chance of a non-JSON response and makes long-form generation
        // fail unnecessarily.
        const initialPageMismatch = !isInsertionMode
          && Number.isFinite(requiredPageCount)
          && requiredPageCount > 0
          && initialSlideCount < requiredPageCount;
        const initialEvidenceViolation = getEvidencePolicyViolation(semanticBlueprint);
        const initialQualityViolation = getPresentationQualityViolation(semanticBlueprint);
        const isLongBatchedDeck = Number.isFinite(requestedSemanticPageCount) && requestedSemanticPageCount > 12;
        const isDiversityOnlyViolation = !!initialQualityViolation && /版型分配過度單調/.test(initialQualityViolation);
        // A long deck is already generated in bounded batches. Never follow
        // it with one giant 20–30 page repair response: that is exactly the
        // output shape that can exceed the provider timeout. The per-batch
        // instruction above fixes diversity on the next generation instead.
        const shouldRepairWithSingleResponse = !isLongBatchedDeck && (initialPageMismatch || initialEvidenceViolation || initialQualityViolation);
        if (shouldRepairWithSingleResponse) {
          console.warn(`[Server] [Agent 1] ${initialPageMismatch ? `頁數不足：要求 ${requiredPageCount} 頁，收到 ${initialSlideCount} 頁。` : ''}${initialEvidenceViolation ? `資料規則不符：${initialEvidenceViolation}。` : ''}${initialQualityViolation ? `版型品質不符：${initialQualityViolation}。` : ''} 正在自動重新規劃…`);
          const repairReply = await callBedrock(
            [{ role: 'user', content: `${stage1UserMessage}\n\n【強制修正】請完整重新輸出 Semantic JSON。slides 必須剛好有 ${requiredPageCount} 頁；不可少頁、不可以摘要取代頁面、不可輸出說明文字。可查證資料的 chart/table 必須標示 dataClass: "real"。若使用者要求圖表但尚缺資料，保留 chart/table 的視覺位置，標示 dataClass: "pending"，且不可填入任何數值或資料列；不得使用 scenario 或虛構數據。DataEco 版型必須依內容結構選擇，不可讓 dataeco-content 連續三頁或佔多數；不可用固定頁序套版。絕對不可輸出「請填入重點說明」、「層級 1」、「第 2 個執行步驟」、「第二階段的關鍵里程碑」、「核心主題」或 PROJECT 等佔位字。選 WHY/HOW/WHAT 時，bullets 必須恰好三項，依序為真實的 WHY（原因／動機）、HOW（方法／機制）、WHAT（產出／行動），且三項都要來自來源資料。` }],
            contentStrategistPrompt
          );
          semanticBlueprint = parseAIJSON(repairReply);
          applyUploadedSourceTitle(semanticBlueprint, uploadedSourceTitle);
          if (brief.brandProfile === 'dataeco') {
            semanticBlueprint.brandProfile = 'dataeco';
            semanticBlueprint.templateProfile = null;
            semanticBlueprint.templateColorOverride = null;
            semanticBlueprint.theme = {
              ...(semanticBlueprint.theme || {}),
              brandProfile: 'dataeco',
              primary: '#01A964', secondary: '#3ABA8D', accent: '#008A45',
              bg: '#FFFFFF', background: '#FFFFFF', surfaceColor: '#DDF4E9',
              textDark: '#101828', textLight: '#FFFFFF',
              accentPalette: ['#01A964', '#3ABA8D', '#76D7A8', '#008A45'],
            };
          }
        } else if (initialQualityViolation || initialEvidenceViolation) {
          console.warn(`[Server] [Agent 1] ${initialQualityViolation || initialEvidenceViolation}；長篇分批結果不進行整份重寫，以避免逾時。`);
        }
        // This is the server-side final guard for an insertion. Even if an
        // upstream agent ignores the brief and returns a full deck, only the
        // requested new slides are allowed to leave this endpoint.
        if (isInsertionMode && Array.isArray(semanticBlueprint?.slides)) {
          semanticBlueprint.slides = semanticBlueprint.slides.slice(0, requestedInsertCount);
        }
        if (!isInsertionMode && Number.isFinite(requiredPageCount) && requiredPageCount > 0
          && trimBlueprintToPageCount(semanticBlueprint, requiredPageCount)) {
          console.warn(`[Server] [Agent 1] 模型回傳頁數超出要求，已保留封面與結尾並裁切為 ${requiredPageCount} 頁。`);
        }
        if (Number.isFinite(requiredPageCount) && requiredPageCount > 0 && semanticBlueprint?.slides?.length !== requiredPageCount) {
          throw new Error(`企劃大綱頁數不符：要求 ${requiredPageCount} 頁，實際 ${semanticBlueprint?.slides?.length || 0} 頁`);
        }
        const evidenceViolation = getEvidencePolicyViolation(semanticBlueprint);
        if (evidenceViolation) {
          throw new Error(`企劃大綱資料不符：${evidenceViolation}`);
        }
        const qualityViolation = getPresentationQualityViolation(semanticBlueprint);
        if (qualityViolation && !(isLongBatchedDeck && /版型分配過度單調/.test(qualityViolation))) {
          throw new Error(`企劃大綱版型品質不符：${qualityViolation}`);
        }
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
        const layoutRequests = [];
        for (let i = 0; i < allSlides.length; i += BATCH_SIZE) {
          const batchSlides = allSlides.slice(i, i + BATCH_SIZE);
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(allSlides.length / BATCH_SIZE);
          const batchBlueprint = { ...semanticBlueprint, slides: batchSlides };
          const batchHint = totalBatches > 1
            ? `（注意：這是第 ${batchIndex}/${totalBatches} 批，總計 ${allSlides.length} 頁，請確保此批內版型有變化，且與前一批不重複。）`
            : '';
          const stage2UserMessage = `【企劃大綱 (Semantic JSON)】${batchHint}：\n${JSON.stringify(batchBlueprint, null, 2)}\n\n請根據上述大綱，計算座標並輸出最終的排版指令 JSON：`;
          layoutRequests.push({ batchIndex, totalBatches, start: i + 1, batchSlides, batchBlueprint, batchHint });
        }
        // Like semantic batches, layout batches share no mutable state. Run
        // them together so long decks do not exceed a reverse proxy timeout.
        const layoutResults = await Promise.all(layoutRequests.map(async (batch) => {
          console.log(`[Server] [Agent 2] 正在處理第 ${batch.batchIndex}/${batch.totalBatches} 批（第 ${batch.start}～${batch.start + batch.batchSlides.length - 1} 頁）...`);
          const stage2UserMessage = `【企劃大綱 (Semantic JSON)】${batch.batchHint}：\n${JSON.stringify(batch.batchBlueprint, null, 2)}\n\n請根據上述大綱，計算座標並輸出最終的排版指令 JSON：`;
          const stage2Reply = await callBedrock(
            [{ role: 'user', content: stage2UserMessage }],
            layoutDesignerPrompt,
            8192
          );
          const batchResult = parseAIJSON(stage2Reply);
          if (!Array.isArray(batchResult?.slides) || batchResult.slides.length !== batch.batchSlides.length) {
            throw new Error(`第 ${batch.batchIndex} 批排版頁數不符：要求 ${batch.batchSlides.length} 頁，實際 ${batchResult?.slides?.length || 0} 頁`);
          }
          return batchResult;
        }));
        layoutBlueprint = { ...layoutResults[0], slides: [] };
        layoutResults.forEach(result => allLayoutSlides.push(...result.slides));

        layoutBlueprint.slides = allLayoutSlides;
        if (allLayoutSlides.length !== allSlides.length) {
          throw new Error(`排版結果頁數不符：要求 ${allSlides.length} 頁，實際 ${allLayoutSlides.length} 頁`);
        }
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
                  // Different strategist/layout responses use title, label,
                  // name, description, or detail for the same card contract.
                  // Keep both the short heading and its explanatory copy so
                  // fixed diagrams (orbit, hub, pyramid) do not lose slots.
                  const cardTitle = String(card?.title || card?.label || card?.name || card?.heading || '').trim();
                  const cardText = String(card?.text || card?.description || card?.detail || card?.content || '').trim();
                  if (cardTitle) points.push(`${cardTitle}${cardText ? '：' + cardText : ''}`);
                  else if (cardText) points.push(cardText);
                });
              }
              // Some specialised templates return their slots in a dedicated
              // semantic array instead of bullets/cards. Forward every one
              // of these fields to the renderer in a stable, readable form.
              const flattenPoint = (value) => {
                if (Array.isArray(value)) return value.flatMap(flattenPoint);
                if (value && typeof value === 'object') {
                  const label = String(value.title || value.label || value.name || value.heading || '').trim();
                  const detail = String(value.text || value.description || value.detail || value.content || '').trim();
                  return label ? [`${label}${detail ? '：' + detail : ''}`] : (detail ? [detail] : []);
                }
                const copy = String(value || '').trim();
                return copy ? [copy] : [];
              };
              ['levels', 'items', 'steps', 'milestones', 'keyPoints', 'key_points'].forEach(field => {
                points.push(...flattenPoint(semanticSlide[field]));
              });
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

        // The UI must not infer this from its previous state.  A full-deck
        // request can arrive with a stale insertion flag from an earlier chat
        // turn, so make the authoritative server decision explicit.
        return res.json({
          success: true,
          intent: 'generate',
          generationMode: isInsertionMode ? 'insert' : 'replace',
          blueprint: layoutBlueprint,
        });
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

app.use((error, _req, res, next) => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? `附件超過 ${Math.floor(maxUploadBytes / 1024 / 1024)}MB 限制。`
      : '附件上傳格式不正確。';
    return res.status(413).json({ success: false, error: message });
  }
  if (error.message === 'This origin is not allowed by the CORS policy.') {
    return res.status(403).json({ success: false, error: '此網域未獲准使用服務。' });
  }
  if (error.message === '只支援 PDF、DOCX、TXT 或 MD 檔案。') {
    return res.status(415).json({ success: false, error: error.message });
  }
  return next(error);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Production uses one origin: Express serves the built Vue app and the API.
// This keeps Bedrock credentials on the server and avoids exposing a localhost
// address or a secret in the browser bundle.
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../dist');
  // The shared ALB forwards the single /ppt* path to this service. Mounting
  // static files at /ppt strips that prefix before resolving files in dist.
  app.use('/ppt', express.static(clientDist));
  app.use('/ppt', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
  // Keep the root mount for the existing SSM/local test URL.
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.listen(port, listenHost, () => {
  const endpoint = listenHost ? `${listenHost}:${port}` : `埠號 ${port}`;
  console.log(`[Server] API 伺服器正在執行，監聽 ${endpoint}`);
});
