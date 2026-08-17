/**
 * 可由 AI 選用的 DataEco／國泰簡報版型庫。
 *
 * 這不是縮圖清單：每一項都定義了可安全填入的內容插槽，供前端提示、
 * 後端選版與動態渲染器共用同一組名稱。
 */
export interface DataEcoTemplateDefinition {
  id: string
  label: string
  useWhen: string
  slots: string[]
  supports: Array<'text' | 'bullets' | 'chart' | 'table' | 'cards' | 'image'>
}

export const DATAECO_TEMPLATE_CATALOG: DataEcoTemplateDefinition[] = [
  { id: 'dataeco-cover', label: '封面', useWhen: '新簡報第一頁', slots: ['title', 'subtitle', 'department'], supports: ['text'] },
  { id: 'dataeco-toc', label: '目錄', useWhen: '章節總覽或議程', slots: ['title', 'items'], supports: ['bullets'] },
  { id: 'dataeco-section', label: '章節扉頁', useWhen: '新章節開始', slots: ['sectionNumber', 'title', 'subtitle'], supports: ['text'] },
  { id: 'dataeco-content', label: '重點內容', useWhen: '一個主題搭配重點說明', slots: ['title', 'subtitle', 'items'], supports: ['text', 'bullets'] },
  { id: 'dataeco-chart', label: '圖表洞察', useWhen: '折線、長條或圓餅圖及其解讀', slots: ['title', 'insights', 'chart'], supports: ['bullets', 'chart'] },
  { id: 'dataeco-table', label: '表格比較', useWhen: '多方案、優劣勢或成本比較', slots: ['title', 'summary', 'table'], supports: ['text', 'table'] },
  { id: 'dataeco-kpi', label: 'KPI 數據', useWhen: '三至四個核心數字或指標', slots: ['title', 'metrics'], supports: ['cards'] },
  { id: 'dataeco-process', label: '步驟流程', useWhen: '3 至 5 個連續步驟', slots: ['title', 'steps'], supports: ['cards'] },
  { id: 'dataeco-timeline', label: '時間軸', useWhen: '依時間推進的里程碑', slots: ['title', 'milestones'], supports: ['cards'] },
  { id: 'dataeco-pyramid', label: '階層金字塔', useWhen: '呈現四層優先順序、成熟度或策略層級', slots: ['title', 'summary', 'levels', 'keyPoint'], supports: ['text', 'bullets'] },
  { id: 'dataeco-alternating-steps', label: '四步驟雙列流程', useWhen: '呈現四個有先後關係的執行步驟', slots: ['title', 'steps'], supports: ['cards'] },
  { id: 'dataeco-orbit-image', label: '環狀四要點圖', useWhen: '一個核心主題搭配四個環繞要點', slots: ['title', 'image', 'items'], supports: ['image', 'cards'] },
  { id: 'dataeco-project-hub', label: '專案放射圖', useWhen: '一個專案主軸連結四項工作或要點', slots: ['title', 'project', 'items'], supports: ['text', 'bullets'] },
  { id: 'dataeco-milestone-bar', label: '五節點里程碑軸', useWhen: '五個時間節點的演進、計畫或歷程', slots: ['title', 'milestones'], supports: ['text', 'bullets'] },
  { id: 'dataeco-why-how-what', label: 'WHY／HOW／WHAT 策略圖', useWhen: '說明目的、方法與具體行動', slots: ['title', 'why', 'how', 'what'], supports: ['text', 'bullets'] },
  { id: 'dataeco-image-split', label: '圖文分欄', useWhen: '一張關鍵圖片搭配短文', slots: ['title', 'image', 'caption'], supports: ['text', 'image'] },
  { id: 'dataeco-closing', label: '行動／感謝封底', useWhen: '最後一頁的結論、下一步或感謝', slots: ['title', 'subtitle', 'actions'], supports: ['text', 'cards'] },
]

export const DATAECO_TEMPLATE_PROMPT = DATAECO_TEMPLATE_CATALOG
  .map(template => `- ${template.id}（${template.label}）：${template.useWhen}；可填入：${template.slots.join('、')}；支援：${template.supports.join('、')}`)
  .join('\n')

export function isDataEcoTemplateRequest(text: string): boolean {
  return /(?:國泰|dataeco|DataEco|國泰金控)/i.test(text)
}
