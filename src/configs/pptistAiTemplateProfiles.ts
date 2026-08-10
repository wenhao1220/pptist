/** 原生 PPTist 範本延伸出的 AI 模板模式。 */
export type PPTistAiTemplateProfileId =
  | 'pptist-tech-blue'
  | 'pptist-plum-editorial'
  | 'pptist-gold-executive'
  | 'pptist-sage-minimal'

export interface PPTistAiTemplateProfile {
  id: PPTistAiTemplateProfileId
  name: string
  sourceTemplate: string
  description: string
  palette: { primary: string; secondary: string; accent: string; background: string; surface: string; textDark: string; textLight: string }
}

export const PPTIST_AI_TEMPLATE_PROFILES: PPTistAiTemplateProfile[] = [
  {
    id: 'pptist-tech-blue', name: '科技藍圖', sourceTemplate: 'template_2',
    description: '青藍城市、線條與節點感，適合科技與數據主題。',
    palette: { primary: '#2B9DB7', secondary: '#76C7D7', accent: '#177E99', background: '#F7FBFC', surface: '#FFFFFF', textDark: '#163946', textLight: '#FFFFFF' },
  },
  {
    id: 'pptist-plum-editorial', name: '紫灰敘事', sourceTemplate: 'template_3',
    description: '紫灰留白與編輯式圖文層次，適合研究和品牌提案。',
    palette: { primary: '#5E5268', secondary: '#A99EAE', accent: '#73556F', background: '#FAF8FA', surface: '#FFFFFF', textDark: '#342D39', textLight: '#FFFFFF' },
  },
  {
    id: 'pptist-gold-executive', name: '金棕高階', sourceTemplate: 'template_6',
    description: '深棕金色、高對比與正式感，適合策略與高階溝通。',
    palette: { primary: '#4A3024', secondary: '#9A7653', accent: '#FBD26A', background: '#4A3024', surface: '#FFF8E7', textDark: '#2F211B', textLight: '#FFFFFF' },
  },
  {
    id: 'pptist-sage-minimal', name: '簡約鼠尾草', sourceTemplate: 'template_4',
    description: '鼠尾草綠、柔和留白與低裝飾，適合策略、教育與內部報告。',
    palette: { primary: '#8AAE9A', secondary: '#BFD3C4', accent: '#668A75', background: '#FCFDFC', surface: '#FFFFFF', textDark: '#34443B', textLight: '#FFFFFF' },
  },
]

export const PPTIST_AI_TEMPLATE_IDS = ['cover', 'toc', 'section', 'content', 'chart', 'table', 'kpi', 'process', 'timeline', 'action', 'closing'] as const

export const PPTIST_AI_TEMPLATE_PROMPT = PPTIST_AI_TEMPLATE_PROFILES
  .map(profile => `- ${profile.id}（${profile.name}，源自 ${profile.sourceTemplate}）：${profile.description}`)
  .join('\n')

export function isPPTistAiTemplateRequest(text: string): boolean {
  return /(?:科技藍圖|紫灰敘事|金棕高階|簡約鼠尾草|原生PPTist模板|PPTist模板)/i.test(text)
}

export function getPPTistAiTemplateProfile(id?: string | null): PPTistAiTemplateProfile | undefined {
  return PPTIST_AI_TEMPLATE_PROFILES.find(profile => profile.id === id)
}
