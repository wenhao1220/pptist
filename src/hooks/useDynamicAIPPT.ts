import { nanoid } from 'nanoid';
import tinycolor from 'tinycolor2';
import featherIconSource from '../../feather.json?raw';
import type { Slide, PPTTextElement, PPTChartElement, PPTTableElement, PPTShapeElement, PPTImageElement, PPTElement } from '@/types/slides';
import { PPTIST_AI_TEMPLATE_PROFILES } from '@/configs/pptistAiTemplateProfiles';

// 確保 HEX 色碼正確，失敗回傳空字串（不再預設黑色）
function sanitizeHex(color: string): string {
  if (!color) return '';
  const t = tinycolor(color);
  return t.isValid() ? t.toHexString() : '';
}

// 安全取色：若解析失敗則回傳 fallback
function safeColor(color: string, fallback: string): string {
  return sanitizeHex(color) || fallback;
}

// 判斷顏色是否為深色（亮度低於 0.35）
function isDark(color: string): boolean {
  if (!color) return false;
  return tinycolor(color).getLuminance() < 0.35;
}

// 確保兩個顏色有足夠對比（若不夠，強制回傳高對比色）
function ensureContrast(textColor: string, bgColor: string, lightFallback: string, darkFallback: string): string {
  const ratio = tinycolor.readability(textColor, bgColor);
  if (ratio >= 3.0) return textColor;
  return isDark(bgColor) ? lightFallback : darkFallback;
}

function createId() {
  return nanoid(10);
}

function truncateStr(str: any, limit: number) {
  if (!str) return '';
  const s = String(str);
  return s.length > limit ? s.substring(0, limit) + '...' : s;
}

// Icon 名稱 → Emoji 對照表
const ICON_EMOJI_MAP: Record<string, string> = {
  'rocket': '🚀', 'shield': '🛡️', 'users': '👥', 'target': '🎯',
  'bulb': '💡', 'gear': '⚙️', 'globe': '🌐', 'chart-bar': '📊',
  'chart-line': '📈', 'chart-pie': '🥧', 'trophy': '🏆', 'star': '⭐',
  'heart': '❤️', 'clock': '🕐', 'calendar': '📅', 'mail': '✉️',
  'phone': '📞', 'map-pin': '📍', 'book': '📚', 'briefcase': '💼',
  'dollar-sign': '💲', 'trending-up': '📈', 'trending-down': '📉',
  'check-circle': '✅', 'alert-circle': '⚠️', 'zap': '⚡',
  'database': '🗄️', 'cloud': '☁️', 'lock': '🔒', 'unlock': '🔓',
  'search': '🔍', 'layers': '🗂️', 'puzzle': '🧩', 'flag': '🚩',
  'compass': '🧭', 'award': '🥇', 'thumbs-up': '👍',
  'message-circle': '💬', 'link': '🔗', 'package': '📦',
};

// 可在 PPTist 畫布直接繪製的既有線性 icon path（24 × 24 viewBox）。
// 品牌模式優先用這些向量路徑，避免將 emoji 當成簡報視覺素材。
const ICON_PATH_MAP: Record<string, string> = {
  'rocket': 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.3-.09-3.09 M12 15l-3-3a22 22 0 0 1 2-3.5A12.9 12.9 0 0 1 22 3c0 2.72-.78 7.5-5.5 11A22.4 22.4 0 0 1 12 15z M9 12H4s.55-3.03 2-4c1.72-1.15 5.13-.93 5.13-.93 M12 15v5s3.03-.55 4-2c1.15-1.72.93-5.13.93-5.13 M9 16.5a5 5 0 0 0-1.5-1.5',
  'bulb': 'M9 18h6 M10 22h4 M15.09 14c.18-.5.75-1.12 1.23-1.62A6 6 0 1 0 7.68 12.38c.48.5 1.05 1.12 1.23 1.62',
  'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'users': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  'globe': 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  'mail': 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
  'briefcase': 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  'database': 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3 M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  'cloud': 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  'lock': 'M7 11V7a5 5 0 0 1 10 0v4',
  'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14',
};

function getIconEmoji(iconName: string): string {
  return ICON_EMOJI_MAP[iconName] || '●';
}

// AI 使用的舊名稱與 Feather 名稱之間的相容層。除此之外，任何 feather.json
// 內的 icon 名稱都能直接使用，讓品牌與一般簡報共用同一套向量 icon 庫。
const ICON_ALIASES: Record<string, string> = {
  'gear': 'settings',
  'chart-bar': 'bar-chart-2',
  'chart-line': 'trending-up',
  'chart-pie': 'pie-chart',
  'trophy': 'award',
  'bulb': 'sun',
};

// The bundled source is UTF-16 and contains SVG markup that Vite's JSON
// transform rejects in production builds. Import it as text, then normalize
// the UTF-16 byte artifacts before parsing it in the browser.
const featherIconMap = JSON.parse(
  featherIconSource.replace(/\0/g, '').replace(/^\uFFFD+/, '')
) as Record<string, string>;

function getIconDataUrl(iconName: string, color: string): string | null {
  const name = ICON_ALIASES[iconName] || iconName;
  const featherMarkup = featherIconMap[name];
  // The small compatibility map covers legacy names such as rocket that do
  // not exist in every Feather release.
  const fallbackMarkup = ICON_PATH_MAP[iconName] ? `<path d="${ICON_PATH_MAP[iconName]}"/>` : '';
  const markup = featherMarkup || fallbackMarkup;
  if (!markup) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// 圓角矩形 SVG path（圓角半徑 = viewBox 的 4%，微圓角效果）
const RR_PATH = 'M 8 0 L 192 0 Q 200 0 200 8 L 200 192 Q 200 200 192 200 L 8 200 Q 0 200 0 192 L 0 8 Q 0 0 8 0 Z';

export default function useDynamicAIPPT() {
  const W = 1000;
  const H = 562.5;

  const generateDynamicSlides = (blueprint: any) => {
    if (!blueprint || !blueprint.slides) return [];

    const slides: Slide[] = [];
    const theme = blueprint.theme || {};
    const isDataEco = blueprint.brandProfile === 'dataeco' || theme.brandProfile === 'dataeco';
    const templateProfile = PPTIST_AI_TEMPLATE_PROFILES.find(profile => profile.id === blueprint.templateProfile);
    const templateColorOverride = safeColor(blueprint.templateColorOverride, '');
    const templatePalette = templateProfile ? { ...templateProfile.palette } : null;
    if (templatePalette && templateColorOverride) {
      templatePalette.primary = templateColorOverride;
      templatePalette.secondary = tinycolor.mix(templateColorOverride, '#FFFFFF', 48).toHexString();
      templatePalette.accent = tinycolor(templateColorOverride).darken(18).toHexString();
      templatePalette.background = tinycolor.mix(templateColorOverride, '#FFFFFF', 97).toHexString();
      templatePalette.surface = '#FFFFFF';
      templatePalette.textDark = '#1A202C';
    }

    // 全域 pal：基礎色票，只包含固定的主題色
    const pal: any = {
      primary: templatePalette ? templatePalette.primary : safeColor(theme.primary, '#1E2761'),
      secondary: templatePalette ? templatePalette.secondary : safeColor(theme.secondary, '#408EC6'),
      accent: templatePalette ? templatePalette.accent : safeColor(theme.accent, '#7A2048'),
      textDark: templatePalette ? templatePalette.textDark : safeColor(theme.textDark, '#1A1A1A'),
      textLight: templatePalette ? templatePalette.textLight : safeColor(theme.textLight, '#FFFFFF'),
      accentPalette: [] as string[],
      // aiSurfaceColor: AI 提供的 surfaceColor，每 slide 決定是否採用
      aiSurfaceColor: templatePalette ? templatePalette.surface : safeColor(theme.surfaceColor, ''),
    };

    if (Array.isArray(theme.accentPalette) && theme.accentPalette.length > 0) {
      pal.accentPalette = theme.accentPalette
        .map((c: string) => safeColor(c, ''))
        .filter((c: string) => !!c);
    }
    if (pal.accentPalette.length === 0) {
      pal.accentPalette = templateProfile
        ? [templatePalette!.primary, templatePalette!.secondary, templatePalette!.accent]
        : [pal.accent, pal.secondary, pal.primary, '#028090'];
    }

    blueprint.slides.forEach((spec: any) => {
      const elements: PPTElement[] = [];
      const slideId = createId();

      // ── 每個 slide 的實際背景色（spec.background 才是真正的頁面顏色）
      const backgroundSpec = spec.background;
      const gradientSpec = backgroundSpec && typeof backgroundSpec === 'object' && backgroundSpec.type === 'gradient'
        ? backgroundSpec
        : null;
      const profileUsesDarkCanvas = templateProfile?.id === 'pptist-gold-executive' && ['cover', 'section', 'closing'].includes(spec.templateId);
      const profileBackground = templateProfile
        ? (profileUsesDarkCanvas ? templatePalette!.primary : templatePalette!.background)
        : '';
      const bg = gradientSpec
        ? safeColor(gradientSpec.colors?.[0], templatePalette?.primary || safeColor(theme.primary, '#01A964'))
        : (templateProfile ? profileBackground : safeColor(backgroundSpec || theme.bg || theme.background, '#F8F9FA'));
      const pageBgIsDark = isDark(bg);

      // ── 每個 slide 動態計算 surfaceColor（根據最新規範，必須永遠是淺色）
      let slideSurface: string;
      const aiSurface = pal.aiSurfaceColor;
      if (aiSurface && !isDark(aiSurface)) {
        // AI 給了合法的淺色 surfaceColor → 優先使用
        slideSurface = aiSurface;

        // 防呆：如果 AI 給的卡片底色跟頁面背景對比度過低 (< 1.15)，人眼會看不出差異，人工幫它微調以做出層次感
        if (tinycolor.readability(slideSurface, bg) < 1.15) {
          slideSurface = tinycolor.mix(pal.primary, '#FFFFFF', 90).toHexString();
          // 如果調出來還是太接近，加重色彩比例
          if (tinycolor.readability(slideSurface, bg) < 1.15) {
            slideSurface = tinycolor.mix(pal.primary, '#FFFFFF', 80).toHexString();
          }
        }
      } else {
        // AI 沒給或是給了深色 → 啟動進階 Fallback 機制
        // 強制使用主色(primary)跟白色混合，製造出帶有主題氛圍的極淺色
        const baseColor = pal.primary;
        // 將 baseColor 與白色以 8% : 92% 的比例混合，確保結果帶有清晰可見的淡色彩，而非純白
        slideSurface = tinycolor.mix(baseColor, '#FFFFFF', 92).toHexString();

        // 再次確保它跟背景不要融為一體
        if (tinycolor.readability(slideSurface, bg) < 1.15) {
          slideSurface = tinycolor.mix(baseColor, '#FFFFFF', 80).toHexString();
        }
      }

      // 計算卡片的柔和邊框顏色（主色 + 75% 白色），避免 secondary 也是白色導致邊框隱形
      const cardBorderColor = tinycolor.mix(pal.primary, '#FFFFFF', 75).toHexString();

      let rawElements = spec.elements || [];

      // DataEco 原模板中的 WHY／HOW／WHAT 頁是固定資訊圖，而不是讓模型以
      // 任意文字框拼湊。保留三層同心圓、右側三列說明與固定留白，只替換文字。
      if (isDataEco && spec.templateId === 'dataeco-why-how-what') {
        const sourceTitle = spec.title || rawElements.find((el: any) => el.type === 'title')?.content || '策略架構';
        const bulletElement = rawElements.find((el: any) => el.type === 'bullets');
        const sourceItems = Array.isArray(bulletElement?.content)
          ? bulletElement.content
          : (Array.isArray(spec.content_points) ? spec.content_points : []);
        const labels = ['WHY', 'HOW', 'WHAT'];
        const rowColors = ['#019056', '#3ABA8D', '#99E891'];
        const rowText = labels.map((label, index) => {
          const item = String(sourceItems[index] || '請填入重點說明');
          return item.replace(new RegExp(`^${label}\\s*[:：|｜-]?\\s*`, 'i'), '');
        });
        const addFixedText = (left: number, top: number, width: number, height: number, content: string, fontSize: number, color: string, bold = false, align = 'left') => {
          elements.push({
            type: 'text', id: createId(), left, top, width, height,
            content: `<p style="text-align: ${align};"><span style="font-size: ${fontSize}px; ${bold ? 'font-weight: bold;' : ''} color: ${color};">${content}</span></p>`,
            defaultFontName: theme.typography?.zh || 'Microsoft JhengHei', defaultColor: color, rotate: 0,
          } as PPTTextElement);
        };

        elements.push({
          type: 'shape', id: createId(), left: 360, top: 170, width: 580, height: 300,
          viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: '#F1FFE5',
          outline: { color: '#F1FFE5', width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
        } as PPTShapeElement);
        [
          { left: 125, top: 165, size: 280, color: '#99E891' },
          { left: 160, top: 200, size: 210, color: '#3ABA8D' },
          { left: 200, top: 240, size: 130, color: '#019056' },
        ].forEach(circle => elements.push({
          type: 'shape', id: createId(), left: circle.left, top: circle.top, width: circle.size, height: circle.size,
          viewBox: [200, 200], path: 'M 100 0 A 100 100 0 1 1 99.999 0 Z', fill: circle.color,
          outline: { color: circle.color, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
        } as PPTShapeElement));
        labels.forEach((label, index) => {
          const rowTop = 205 + index * 88;
          elements.push({
            type: 'shape', id: createId(), left: 635, top: rowTop + 2, width: 48, height: 48,
            viewBox: [200, 200], path: 'M 100 0 A 100 100 0 1 1 99.999 0 Z', fill: rowColors[index],
            outline: { color: rowColors[index], width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
          } as PPTShapeElement);
          if (index < 2) {
            elements.push({
              type: 'shape', id: createId(), left: 530, top: rowTop + 74, width: 350, height: 1,
              viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: '#C9D7C8',
              outline: { color: '#C9D7C8', width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
            } as PPTShapeElement);
          }
          addFixedText(465, rowTop + 9, 135, 34, label, 22, '#000000', true);
          addFixedText(705, rowTop + 5, 205, 53, truncateStr(rowText[index], 34), 14, '#000000');
        });
        addFixedText(125, 58, 760, 55, sourceTitle, 36, '#000000', true);
        addFixedText(220, 180, 90, 30, 'WHAT', 18, '#FFFFFF', true, 'center');
        addFixedText(220, 220, 90, 30, 'HOW', 18, '#FFFFFF', true, 'center');
        addFixedText(220, 280, 90, 30, 'WHY', 18, '#FFFFFF', true, 'center');
        rawElements = [];
      }

      // DataEco 的識別元素由渲染層固定產生，而不是讓模型以任意矩形自行猜測。
      // 這些元素位於內容之下，且不參與文字碰撞計算。
      // templateId is the primary reusable-layout contract. brandChrome is
      // retained as a compatibility override for blueprints created earlier.
      const templateChrome: Record<string, string> = {
        'dataeco-cover': 'coverArc',
        'dataeco-closing': 'closingArc',
        'dataeco-toc': 'contentRail',
        'dataeco-section': 'contentRail',
        'dataeco-content': 'contentRail',
        'dataeco-chart': 'contentRail',
        'dataeco-table': 'contentRail',
        'dataeco-kpi': 'contentRail',
        'dataeco-process': 'contentRail',
        'dataeco-timeline': 'contentRail',
        'dataeco-why-how-what': 'contentRail',
        'dataeco-image-split': 'contentRail',
      };
      const brandChrome = spec.brandChrome || templateChrome[spec.templateId] || 'contentRail';
      if (isDataEco && brandChrome === 'contentRail') {
        const railColors = ['#6DD9A7', '#3ABA8D', '#019056'];
        railColors.forEach((color, index) => {
          elements.push({
            type: 'shape', id: createId(), left: 0, top: index * (H / railColors.length), width: 66, height: H / railColors.length + 1,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: color,
            outline: { color, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
          } as PPTShapeElement);
        });
      }
      if (isDataEco && (brandChrome === 'coverArc' || brandChrome === 'closingArc')) {
        const arcColor = brandChrome === 'coverArc' ? '#6DD9A7' : '#3ABA8D';
        elements.push({
          type: 'shape', id: createId(), left: 620, top: -120, width: 520, height: 520,
          viewBox: [200, 200], path: 'M 100 0 A 100 100 0 1 1 99.999 0 Z', fill: arcColor,
          outline: { color: arcColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false,
          } as PPTShapeElement);
      }

      // The four native-template modes use restrained, repeatable chrome so
      // generated pages remain recognisable as the chosen source template.
      if (templateProfile) {
        const isCoverLike = ['cover', 'section', 'closing'].includes(spec.templateId);
        const chromeColor = templatePalette!.primary;
        const accentColor = templatePalette!.accent;
        if (templateProfile.id === 'pptist-tech-blue') {
          elements.push({ type: 'shape', id: createId(), left: 0, top: 0, width: isCoverLike ? 84 : 18, height: H,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 125 200 L 0 200 Z', fill: chromeColor,
            outline: { color: chromeColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
          elements.push({ type: 'shape', id: createId(), left: isCoverLike ? 92 : 26, top: 0, width: 5, height: H,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: templatePalette!.secondary,
            outline: { color: templatePalette!.secondary, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
        } else if (templateProfile.id === 'pptist-plum-editorial') {
          elements.push({ type: 'shape', id: createId(), left: 0, top: 0, width: W, height: isCoverLike ? 82 : 14,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: chromeColor,
            outline: { color: chromeColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
          elements.push({ type: 'shape', id: createId(), left: 72, top: isCoverLike ? 100 : 38, width: 76, height: 7,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: accentColor,
            outline: { color: accentColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
        } else if (templateProfile.id === 'pptist-gold-executive') {
          elements.push({ type: 'shape', id: createId(), left: 0, top: 0, width: W, height: 11,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: accentColor,
            outline: { color: accentColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
          elements.push({ type: 'shape', id: createId(), left: 0, top: H - 11, width: W, height: 11,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: accentColor,
            outline: { color: accentColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
        } else {
          elements.push({ type: 'shape', id: createId(), left: 0, top: 0, width: W, height: isCoverLike ? 72 : 10,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: templatePalette!.secondary,
            outline: { color: templatePalette!.secondary, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
          elements.push({ type: 'shape', id: createId(), left: 0, top: isCoverLike ? 72 : 10, width: W, height: 3,
            viewBox: [200, 200], path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z', fill: accentColor,
            outline: { color: accentColor, width: 0, style: 'solid' }, rotate: 0, fixedRatio: false } as PPTShapeElement);
        }
      }

      const PAD = 26;

      // Pass 1: 預估真實所需高度 (estH)
      const processedElements = rawElements.map((el: any) => {
        const left = Math.max(0, Math.min(Number(el.left) || 50, W - 10));
        const top = Math.max(0, Math.min(Number(el.top) || 50, H - 10));
        const width = Math.max(10, Math.min(Number(el.width) || 200, W - left));
        const height = Math.max(10, Math.min(Number(el.height) || 50, H - top));
        const hasCardBg = !!el.cardBg && el.type !== 'table';
        let scale = el.fontScale === 'lg' ? 1.3 : el.fontScale === 'sm' ? 0.8 : 1;

        // Short text in a card is a primary content block, not a caption. Keep an
        // accidental `sm` directive from making it visually disappear.
        if (hasCardBg && el.type === 'text' && el.verticalAlign === 'middle' && el.fontScale === 'sm') {
          scale = 1.3;
        }

        let estH = height;

        // 文字類元件 (不論有無 cardBg) 都預估所需高度，避免被後面元件蓋過
        if (['title', 'subtitle', 'text'].includes(el.type)) {
          let fontSize = 16;
          if (el.type === 'title') fontSize = height > 60 ? 44 : 32;
          else if (el.type === 'subtitle') fontSize = 20;
          fontSize = Math.round(fontSize * scale);

          const textPad = hasCardBg ? PAD : 0;
          const charLimit = Math.max(1, Math.floor((width - textPad * 2) / (fontSize * 1.05)));
          const lines = Math.ceil((el.content || '').length / charLimit) || 1;
          estH = lines * (fontSize * 1.2) + textPad * 2; // 將 line-height 乘數從 1.5 降為 1.2，避免單行標題佔用過多隱形高度
        } else if (el.type === 'bullets') {
          const fontSize = Math.round(18 * scale);
          const textPad = hasCardBg ? PAD : 0;
          const items = Array.isArray(el.content) ? el.content : [];
          let totalLines = 0;
          const charLimit = Math.max(1, Math.floor((width - textPad * 2) / (fontSize * 1.05)));
          items.forEach((it: string) => {
            totalLines += Math.ceil(String(it).length / charLimit) || 1;
          });
          estH = totalLines * (fontSize * 1.3) + (items.length * 8) + textPad * 2; // line-height 降為 1.3
        }

        return {
          ...el,
          _left: left,
          _top: top,
          _width: width,
          _height: Math.max(height, estH), // 採用較大者，此階段不作夾制
          _scale: scale,
          _hasCardBg: hasCardBg
        };
      });

      // Pass 2: 單趟累積式碰撞解析
      processedElements.sort((a: any, b: any) => a._top - b._top);
      for (let i = 0; i < processedElements.length; i++) {
        const current = processedElements[i];
        const bottomEdge = current._top + current._height;

        for (let j = i + 1; j < processedElements.length; j++) {
          const below = processedElements[j];
          // 水平有交集 (同一欄)
          if (current._left < below._left + below._width && current._left + current._width > below._left) {
            const GAP = 16; // 將 30px 改為 16px (1rem)，避免多元件堆疊時產生過大的累積空白
            const requiredTop = bottomEdge + GAP;
            if (below._top < requiredTop) {
              below._top = requiredTop; // 累積更新新 top，下一次迭代會基於新 top 檢查
            }
          }
        }
      }

      // Pass 3: 畫布下緣夾制、字級降級與最終渲染
      processedElements.forEach((el: any) => {
        const left = el._left;
        let top = el._top;
        const width = el._width;
        let height = el._height; // 這是推擠後的真實高度
        const scale = el._scale;
        const hasCardBg = el._hasCardBg;

        // 畫布下緣邊界夾制 (512.5)
        const MAX_Y = 512.5;
        if (top + height > MAX_Y) {
          if (top >= MAX_Y) {
            console.warn(`[Layout Warning] 頁面內容過多！元件已被推出版面底線 (type: ${el.type}, top: ${top})`);
          }
          // 只夾高度，絕不改動 top，寧可內容些微超出畫布也不要往回覆蓋造成重疊
          height = Math.max(20, MAX_Y - top);
        }

        let fontSizeScaleModifier = 1;
        if (height < el._height) {
          // 如果經過邊界夾制後，空間小於真實需要的高度，計算降級比例 (移除 0.65 限制，但給予 0.3 防禦性底線避免 / 0 導致錯誤)
          const availableTextH = Math.max(10, height - (hasCardBg ? PAD * 2 : 0));
          const requiredTextH = Math.max(10, el._height - (hasCardBg ? PAD * 2 : 0));
          fontSizeScaleModifier = Math.max(0.3, availableTextH / requiredTextH);
        }

        const actualHeight = height;

        if (hasCardBg) {
          elements.push({
            type: 'shape', id: createId(),
            left, top, width, height: actualHeight,
            viewBox: [200, 200], path: RR_PATH,
            fill: slideSurface,
            outline: { color: cardBorderColor, width: 1, style: 'solid' },
            rotate: 0, fixedRatio: false,
          } as PPTShapeElement);
        }

        const effectiveBg = hasCardBg ? slideSurface : bg;
        const onDark = isDark(effectiveBg);

        // ── title / subtitle / text
        if (['title', 'subtitle', 'text'].includes(el.type)) {
          let fontSize = 16;
          let color = onDark ? pal.textLight : pal.textDark;
          let bold = false;
          let align = 'left';

          if (el.type === 'title') {
            fontSize = height > 60 ? 44 : 32;
            const titleCandidate = onDark ? pal.textLight : pal.primary;
            color = ensureContrast(titleCandidate, effectiveBg, pal.textLight, pal.textDark);
            bold = true;
          } else if (el.type === 'subtitle') {
            fontSize = 20;
            const subCandidate = onDark ? pal.textLight : pal.primary;
            color = ensureContrast(subCandidate, effectiveBg, pal.textLight, pal.textDark);
          } else {
            const textCandidate = onDark ? pal.textLight : pal.textDark;
            color = ensureContrast(textCandidate, effectiveBg, pal.textLight, pal.textDark);
          }

          fontSize = typeof el.fontSize === 'number'
            ? Math.round(el.fontSize * fontSizeScaleModifier)
            : Math.round(fontSize * scale * fontSizeScaleModifier);
          const fontFamily = el.fontFamily || (isDataEco ? (theme.typography?.zh || 'Microsoft JhengHei') : 'Arial');

          let textTop = top;
          let textHeight = actualHeight;
          let textLeft = left;
          let textWidth = width;

          if (hasCardBg) {
            textTop = top + PAD;
            textHeight = actualHeight - PAD * 2;
            textLeft = left + PAD;
            textWidth = width - PAD * 2;

            if (el.verticalAlign === 'middle') {
              const charsPerLine = Math.max(1, Math.floor(textWidth / (fontSize * 1.05)));
              const lineCount = Math.max(1, Math.ceil(String(el.content || '').length / charsPerLine));
              const contentHeight = Math.min(textHeight, Math.max(fontSize * 1.2, lineCount * fontSize * 1.2));
              const centerOffset = Math.max(0, (textHeight - contentHeight) / 2);
              // PPTist list/text rendering has a small baseline drift below the
              // nominal box center. Compensate optically without reducing padding.
              textTop += Math.max(0, centerOffset - PAD * 0.5);
              textHeight = contentHeight;
            }
          }

          elements.push({
            type: 'text', id: createId(),
            left: textLeft, top: textTop, width: textWidth, height: textHeight,
            content: `<p style="text-align: ${align};"><span style="font-size: ${fontSize}px; ${bold ? 'font-weight: bold;' : ''} color: ${color};">${el.content || ''}</span></p>`,
            defaultFontName: fontFamily, defaultColor: color, rotate: 0,
          } as PPTTextElement);
        }

        // ── bullets
        else if (el.type === 'bullets') {
          const candidateColor = onDark ? pal.textLight : pal.textDark;
          const color = ensureContrast(candidateColor, effectiveBg, pal.textLight, pal.textDark);
          const fontSize = typeof el.fontSize === 'number'
            ? Math.round(el.fontSize * fontSizeScaleModifier)
            : Math.round(18 * scale * fontSizeScaleModifier);
          const fontFamily = el.fontFamily || (isDataEco ? (theme.typography?.zh || 'Microsoft JhengHei') : 'Arial');
          const items = Array.isArray(el.content) ? el.content : [];

          let textTop = top;
          let textHeight = actualHeight;
          let textLeft = left;
          let textWidth = width;

          if (hasCardBg) {
            textTop = top + PAD;
            textHeight = actualHeight - PAD * 2;
            textLeft = left + PAD;
            textWidth = width - PAD * 2;

            if (el.verticalAlign === 'middle') {
              const charsPerLine = Math.max(1, Math.floor(textWidth / (fontSize * 1.05)));
              const lineCount = items.reduce((sum: number, item: string) =>
                sum + Math.max(1, Math.ceil(String(item).length / charsPerLine)), 0);
              const contentHeight = Math.min(textHeight, Math.max(fontSize * 1.3, lineCount * fontSize * 1.3 + items.length * 8));
              const centerOffset = Math.max(0, (textHeight - contentHeight) / 2);
              // Match the text branch's optical centering correction.
              textTop += Math.max(0, centerOffset - PAD * 0.5);
              textHeight = contentHeight;
            }
          }

          const html = items.map((it: string) =>
            `<li style="margin: 0 0 8px 0; padding: 0;"><span style="font-size: ${fontSize}px; line-height: 1.3; color: ${color};">${String(it)}</span></li>`
          ).join('');

          elements.push({
            type: 'text', id: createId(),
            left: textLeft, top: textTop, width: textWidth, height: textHeight,
            content: `<ul style="margin: 0 0 0 20px; padding: 0; line-height: 1.3;">${html}</ul>`,
            defaultFontName: fontFamily, defaultColor: color, rotate: 0,
          } as PPTTextElement);
        }

        // ── card（版型 F 專用）
        else if (el.type === 'card' && el.content) {
          const cardData = el.content;
          const iconColor = safeColor(cardData.iconColor, '') || pal.accent;
          const cardTitle = truncateStr(cardData.title || '', 30);
          const cardText = truncateStr(cardData.text || '', 80);
          const cardFontFamily = isDataEco ? (theme.typography?.zh || 'Microsoft JhengHei') : 'Arial';

          let cardBgColor = el.cardBg || slideSurface;
          if (tinycolor.readability(cardBgColor, bg) < 1.15) {
            cardBgColor = tinycolor.mix(pal.primary, '#FFFFFF', 90).toHexString();
            if (tinycolor.readability(cardBgColor, bg) < 1.15) {
              cardBgColor = tinycolor.mix(pal.primary, '#FFFFFF', 80).toHexString();
            }
          }
          const cardBgIsDark = isDark(cardBgColor);
          const titleColor = ensureContrast(
            cardBgIsDark ? pal.textLight : pal.primary,
            cardBgColor, pal.textLight, pal.textDark
          );
          const textColor = ensureContrast(
            cardBgIsDark ? pal.textLight : pal.textDark,
            cardBgColor, pal.textLight, pal.textDark
          );

          const ICON_SIZE = 56;
          const ICON_GAP = 14;
          const TITLE_H = 44;
          const TITLE_GAP = 8;
          const TEXT_LINES = Math.ceil(cardText.length / 14) || 1;
          const TEXT_H = Math.max(TEXT_LINES * 20, 36);

          const contentGroupH = ICON_SIZE + ICON_GAP + TITLE_H + (cardText ? TITLE_GAP + TEXT_H : 0);
          const topPadding = Math.max(16, (actualHeight - contentGroupH) / 2);

          const ICON_X = left + (width - ICON_SIZE) / 2;
          const ICON_Y = top + topPadding;
          const TITLE_TOP = ICON_Y + ICON_SIZE + ICON_GAP;
          const TEXT_TOP = TITLE_TOP + TITLE_H + TITLE_GAP;

          elements.push({
            type: 'shape', id: createId(),
            left, top, width, height: actualHeight,
            viewBox: [200, 200], path: RR_PATH,
            fill: cardBgColor,
            outline: { color: cardBorderColor, width: 1, style: 'solid' },
            rotate: 0, fixedRatio: false,
          } as PPTShapeElement);

          elements.push({
            type: 'shape', id: createId(),
            left: ICON_X, top: ICON_Y, width: ICON_SIZE, height: ICON_SIZE,
            viewBox: [200, 200], path: 'M 100 0 A 100 100 0 1 1 99.999 0 Z',
            fill: iconColor,
            outline: { color: iconColor, width: 0, style: 'solid' },
            rotate: 0, fixedRatio: false,
          } as PPTShapeElement);

          const iconSrc = getIconDataUrl(cardData.icon || '', '#FFFFFF');
          if (iconSrc) {
            elements.push({
              type: 'image', id: createId(), left: ICON_X + 14, top: ICON_Y + 14, width: ICON_SIZE - 28, height: ICON_SIZE - 28,
              src: iconSrc, fixedRatio: true, rotate: 0,
            } as PPTImageElement);
          } else {
            const symbol = isDataEco ? '•' : getIconEmoji(cardData.icon || '');
            elements.push({
              type: 'text', id: createId(),
              left: ICON_X, top: ICON_Y, width: ICON_SIZE, height: ICON_SIZE,
              content: `<p style="text-align: center;"><span style="font-size: 26px; color: #FFFFFF;">${symbol}</span></p>`,
              defaultFontName: 'Arial', defaultColor: '#FFFFFF', rotate: 0,
            } as PPTTextElement);
          }

          elements.push({
            type: 'text', id: createId(),
            left: left + 8, top: TITLE_TOP, width: width - 16, height: TITLE_H,
            content: `<p style="text-align: center;"><span style="font-size: 16px; font-weight: bold; color: ${titleColor};">${cardTitle}</span></p>`,
            defaultFontName: cardFontFamily, defaultColor: titleColor, rotate: 0,
          } as PPTTextElement);

          if (cardText) {
            elements.push({
              type: 'text', id: createId(),
              left: left + 8, top: TEXT_TOP, width: width - 16, height: TEXT_H,
              content: `<p style="text-align: center;"><span style="font-size: 13px; color: ${textColor};">${cardText}</span></p>`,
              defaultFontName: cardFontFamily, defaultColor: textColor, rotate: 0,
            } as PPTTextElement);
          }
        }

        // ── chart
        else if (el.type === 'chart' && el.content && Array.isArray(el.content.values)) {
          const chartType = (el.content.chartType || 'bar').toLowerCase();
          const validType = ['bar', 'line', 'pie'].includes(chartType) ? chartType : 'bar';
          const colorPool = [pal.primary, pal.accent, pal.secondary, '#028090', '#97BC62'];
          const chartColors = validType === 'pie'
            ? colorPool.slice(0, Math.max(el.content.labels?.length || 1, 1))
            : colorPool.slice(0, 1);

          elements.push({
            type: 'chart', id: createId(),
            left, top, width, height: actualHeight,
            chartType: validType as 'bar' | 'line' | 'pie',
            themeColors: chartColors,
            textColor: onDark ? pal.textLight : pal.textDark,
            data: { labels: el.content.labels || [], legends: ['Series 1'], series: [el.content.values] },
            rotate: 0,
          } as PPTChartElement);
        }

        // ── table
        else if (el.type === 'table' && el.content && Array.isArray(el.content.rows)) {
          const headers = (el.content.headers || []).map((h: string) => String(h));
          const rows = el.content.rows.map((row: any[]) => row.map((c: any) => String(c)));

          const aiHeaderBg = safeColor(el.content.headerBg, '');
          const headerBg = (aiHeaderBg && isDark(aiHeaderBg)) ? aiHeaderBg : pal.primary;
          const headerText = safeColor(el.content.headerText, '') || (isDark(headerBg) ? pal.textLight : pal.textDark);

          const aiRowText = safeColor(el.content.rowText, '');
          const cellColor = aiRowText || (onDark ? pal.textLight : pal.textDark);
          const aiRowBg = el.content.rowBg;

          const tableData: any[] = [];
          if (headers.length > 0) {
            tableData.push(headers.map((hText: string) => ({
              id: createId(), colspan: 1, rowspan: 1,
              text: hText,
              style: {
                color: headerText,
                backcolor: headerBg,
                bold: true,
                fontsize: '14px',
              },
            })));
          }
          rows.forEach((r: string[], rIdx: number) => {
            let rowBgColor = '';
            if (Array.isArray(aiRowBg) && aiRowBg.length > 0) {
              rowBgColor = safeColor(aiRowBg[rIdx % aiRowBg.length], '');
            } else if (typeof aiRowBg === 'string' && aiRowBg) {
              rowBgColor = safeColor(aiRowBg, '');
            } else {
              rowBgColor = rIdx % 2 === 0 ? '' : tinycolor.mix(headerBg, '#FFFFFF', 88).toHexString();
            }

            tableData.push(r.map((cText: string) => ({
              id: createId(), colspan: 1, rowspan: 1,
              text: cText,
              style: {
                color: cellColor,
                backcolor: rowBgColor,
                fontsize: '14px',
              },
            })));
          });

          const cols = headers.length || rows[0]?.length || 1;
          elements.push({
            type: 'table', id: createId(),
            left, top, width, height: actualHeight,
            colWidths: new Array(cols).fill(1 / cols),
            cellMinHeight: 36,
            outline: { style: 'solid', width: 1, color: tinycolor.mix(headerBg, '#FFFFFF', 75).toHexString() },
            data: tableData,
            theme: { color: headerBg, rowHeader: false, rowFooter: false, colHeader: false, colFooter: false },
            rotate: 0,
          } as PPTTableElement);
        }
      });

      const slideBackground = gradientSpec
        ? {
            type: 'gradient' as const,
            gradient: {
              type: 'linear' as const,
              colors: (gradientSpec.colors || [theme.primary, theme.secondary]).map((color: string, index: number) => ({
                color: safeColor(color, index === 0 ? pal.primary : pal.secondary),
                pos: gradientSpec.colors?.length > 1 ? index / (gradientSpec.colors.length - 1) : 0,
              })),
              rotate: typeof gradientSpec.rotate === 'number' ? gradientSpec.rotate : 0,
            },
          }
        : { type: 'solid' as const, color: bg };

      slides.push({
        id: slideId,
        elements,
        background: slideBackground,
      } as Slide);
    });

    return slides;
  };

  return { generateDynamicSlides };
}
