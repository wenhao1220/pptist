import { nanoid } from 'nanoid';
import { cloneDeep } from 'lodash';
import type { Slide, PPTTextElement, PPTImageElement } from '@/types/slides';

export interface CatalogItem {
  slideIndex: number;
  textElements: { 
    id: string; 
    role: string;
    width: number;
    suggestedMaxChars: number;
    contentPreview: string; 
  }[];
}

export interface AIReplacementCommand {
  sourceSlideIndex: number;
  replacements: Record<string, string>;
}

/**
 * 從 PPTist 解析出來的 slides 中，萃取純文字內容做為 AI 的參考目錄
 * @param slides 原始載入的 templateSlides
 * @returns 簡化版的 Template Catalog 供 Claude 閱讀
 */
export function generateTemplateCatalog(slides: Slide[]): CatalogItem[] {
  return slides.map((slide, index) => {
    // 找出這頁面上的所有文字元素
    const textEls = slide.elements.filter(el => el.type === 'text') as PPTTextElement[];
    
    return {
      slideIndex: index,
      textElements: textEls.map(el => {
        // 清除 HTML 標籤，只保留預覽文字給 Claude 看
        const contentPreview = (el.content || '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/&nbsp;/g, ' ')
          .trim()
          .substring(0, 50); // 截斷過長預覽
          
        const width = el.width || 100;
        const fontSize = (el as any).fontSize || 20; // 安全預設值
        const suggestedMaxChars = Math.max(Math.floor(width / fontSize) * 2, 5); // 給予一點緩衝
        
        let role = '內文';
        if (width <= 150) role = '裝飾性側邊欄/窄標題';
        else if (width >= 400) role = '主標題/寬區塊';

        return {
          id: el.id,
          role,
          width,
          suggestedMaxChars,
          contentPreview
        };
      })
    };
  });
}

/**
 * 接收 AI 的替換指令，深度拷貝模板 Slide，並替換文字內容 (保留原廠座標，乾淨覆寫文字)
 * @param aiCommands Claude 回傳的替換指令陣列
 * @param templateSlides 原始載入的素材庫 (templateSlides)
 * @returns 全新的簡報 Slide 陣列
 */
export function cloneAndReplace(
  aiCommands: AIReplacementCommand[],
  templateSlides: Slide[]
): Slide[] {
  return aiCommands.map(cmd => {
    // 預防 AI 亂回 sourceSlideIndex
    const safeIndex = Math.min(Math.max(0, cmd.sourceSlideIndex || 0), templateSlides.length - 1);
    const sourceSlide = templateSlides[safeIndex];
    if (!sourceSlide) {
      console.warn(`找不到指定的 Source Slide Index: ${cmd.sourceSlideIndex}`);
      return { id: nanoid(10), elements: [] } as unknown as Slide;
    }

    // 1. 深度拷貝整張投影片 (保留所有背景、圖片、圖表、形狀、文字)
    const clonedSlide = cloneDeep(sourceSlide);
    
    // 2. 賦予新的 Slide ID，避免與模板衝突
    clonedSlide.id = nanoid(10);

    // 3. 過濾無效或過小的圖形與圖片，避免破圖
    clonedSlide.elements = clonedSlide.elements.filter(el => {
      // 檢查寬高是否存在且正常 (過濾掉 < 10px 的異常碎片，或是缺乏寬高資訊的元素)
      if (el.type === 'image' || el.type === 'shape') {
        if (typeof el.width !== 'number' || typeof el.height !== 'number') return false;
        if (el.width < 10 || el.height < 10) return false;
      }
      
      // 檢查圖片 src 是否有效與暴力防呆
      if (el.type === 'image') {
        const imgEl = el as PPTImageElement;
        const src = imgEl.src ? imgEl.src.trim() : '';
        if (!src) return false;
        
        // 過濾掉不支援的向量圖格式或是異常過短的死連結
        const lowerSrc = src.toLowerCase();
        if (lowerSrc.endsWith('.emf') || lowerSrc.endsWith('.wmf')) return false;
        if (src.length < 20) return false; // base64 或正常 URL 不可能這麼短
      }
      
      return true;
    });

    // 4. 遍歷並替換文字內容 (Micro-surgical replacement)
    clonedSlide.elements.forEach(el => {
      // 需要同時換掉 element 的 ID，確保每一頁元素 ID 唯一
      const oldId = el.id;
      el.id = nanoid(10);

      if (el.type === 'text' && cmd.replacements && cmd.replacements[oldId]) {
        const textEl = el as PPTTextElement;
        const newText = cmd.replacements[oldId];
        
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(textEl.content, 'text/html');
          
          // 尋找原有的 span 標籤
          const spans = doc.querySelectorAll('span');
          if (spans.length > 0) {
            // 100% 保留第一個 span 的 style，只換內文
            spans[0].textContent = newText;
            
            // 如果原本有多個 span，清掉後續的避免排版混亂或產生殘影
            for (let i = 1; i < spans.length; i++) {
              spans[i].remove();
            }
          } else {
            // 防呆：如果沒有 span，直接替換 body 內容
            doc.body.textContent = newText;
          }
          
          textEl.content = doc.body.innerHTML;
        } catch (e) {
          console.error('微創替換文字失敗，退回安全模式', e);
          const textColor = textEl.defaultColor || textEl.fill || '#333333';
          const fontSize = (textEl as any).fontSize || 20;
          textEl.content = `<p><span style="color: ${textColor}; font-size: ${fontSize}px;">${newText}</span></p>`;
        }
      }
    });

    return clonedSlide;
  });
}
