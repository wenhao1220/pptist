export const enum ShapePathFormulasKeys {
  ROUND_RECT = 'roundRect',
  ROUND_RECT_DIAGONAL = 'roundRectDiagonal',
  ROUND_RECT_SINGLE = 'roundRectSingle',
  ROUND_RECT_SAMESIDE = 'roundRectSameSide',
  CUT_RECT_DIAGONAL = 'cutRectDiagonal',
  CUT_RECT_SINGLE = 'cutRectSingle',
  CUT_RECT_SAMESIDE = 'cutRectSameSide',
  CUT_ROUND_RECT = 'cutRoundRect',
  MESSAGE = 'message',
  ROUND_MESSAGE = 'roundMessage',
  L = 'L',
  RING_RECT = 'ringRect',
  PLUS = 'plus',
  TRIANGLE = 'triangle',
  PARALLELOGRAM_LEFT = 'parallelogramLeft',
  PARALLELOGRAM_RIGHT = 'parallelogramRight',
  TRAPEZOID = 'trapezoid',
  BULLET = 'bullet',
  INDICATOR = 'indicator',
  DONUT = 'donut',
  DIAGSTRIPE = 'diagStripe',
}

export const enum ElementTypes {
  TEXT = 'text',
  IMAGE = 'image',
  SHAPE = 'shape',
  LINE = 'line',
  CHART = 'chart',
  TABLE = 'table',
  LATEX = 'latex',
  VIDEO = 'video',
  AUDIO = 'audio',
}

/**
 * 漸變
 * 
 * type: 漸變型別（徑向、線性）
 * 
 * colors: 漸變顏色列表（pos: 百分比位置；color: 顏色）
 * 
 * rotate: 漸變角度（線性漸變）
 */
export type GradientType = 'linear' | 'radial'
export type GradientColor = {
  pos: number
  color: string
}
export interface Gradient {
  type: GradientType
  colors: GradientColor[]
  rotate: number
}

export type LineStyleType = 'solid' | 'dashed' | 'dotted'

/**
 * 元素陰影
 * 
 * h: 水平偏移量
 * 
 * v: 垂直偏移量
 * 
 * blur: 模糊程度
 * 
 * color: 陰影顏色
 */
export interface PPTElementShadow {
  h: number
  v: number
  blur: number
  color: string
}

/**
 * 元素邊框
 * 
 * style?: 邊框樣式（實線或虛線）
 * 
 * width?: 邊框寬度
 * 
 * color?: 邊框顏色
 */
export interface PPTElementOutline {
  style?: LineStyleType
  width?: number
  color?: string
}

export type ElementLinkType = 'web' | 'slide'

/**
 * 元素超連結
 * 
 * type: 連結型別（網頁、投影片頁面）
 * 
 * target: 目標地址（網頁連結、投影片頁面ID）
 */
export interface PPTElementLink {
  type: ElementLinkType
  target: string
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type TextAlignVertical = 'top' | 'middle' | 'bottom' 


/**
 * 元素通用屬性
 * 
 * id: 元素ID
 * 
 * left: 元素水平方向位置（距離畫布左側）
 * 
 * top: 元素垂直方向位置（距離畫布頂部）
 * 
 * lock?: 鎖定元素
 * 
 * groupId?: 組合ID（擁有相同組合ID的元素即為同一組合元素成員）
 * 
 * width: 元素寬度
 * 
 * height: 元素高度
 * 
 * rotate: 旋轉角度
 * 
 * link?: 超連結
 * 
 * name?: 元素名
 */
interface PPTBaseElement {
  id: string
  left: number
  top: number
  lock?: boolean
  groupId?: string
  width: number
  height: number
  rotate: number
  link?: PPTElementLink
  name?: string
}


export type TextType = 'title' | 'subtitle' | 'content' | 'item' | 'itemTitle' | 'notes' | 'header' | 'footer' | 'partNumber' | 'itemNumber'
export type TextInset = [number, number, number, number]

/**
 * 文本元素
 * 
 * type: 元素型別（text）
 * 
 * content: 文本內容（HTML字串）
 * 
 * defaultFontName: 預設字型（會被文本內容中的HTML內聯樣式覆蓋）
 * 
 * defaultColor: 預設顏色（會被文本內容中的HTML內聯樣式覆蓋）
 * 
 * outline?: 邊框
 * 
 * fill?: 填充色
 * 
 * lineHeight?: 行高（倍），預設1.5
 * 
 * wordSpace?: 字間距，預設0
 * 
 * opacity?: 不透明度，預設1
 * 
 * shadow?: 陰影
 * 
 * paragraphSpace?: 段間距，預設5px
 * 
 * vertical?: 豎向文本
 * 
 * textType?: 文本型別
 * 
 * inset?: 內邊距（上、右、下、左），預設[10, 10, 10, 10]
 *
 * fixedHeight?: 固定文本框自適應軸尺寸，橫排文本固定高度，豎排文本固定寬度
 *
 * vAlign?: 文本框內垂直對齊方向，僅fixedHeight為真時有效，預設top
 */
export interface PPTTextElement extends PPTBaseElement {
  type: 'text'
  content: string
  defaultFontName: string
  defaultColor: string
  outline?: PPTElementOutline
  fill?: string
  lineHeight?: number
  wordSpace?: number
  opacity?: number
  shadow?: PPTElementShadow
  paragraphSpace?: number
  vertical?: boolean
  textType?: TextType
  inset?: TextInset
  fixedHeight?: boolean
  vAlign?: TextAlignVertical
}


/**
 * 圖片翻轉、形狀翻轉
 * 
 * flipH?: 水平翻轉
 * 
 * flipV?: 垂直翻轉
 */
export interface ImageOrShapeFlip {
  flipH?: boolean
  flipV?: boolean
}

/**
 * 圖片濾鏡
 * 
 * https://developer.mozilla.org/zh-CN/docs/Web/CSS/filter
 * 
 * 'blur'?: 模糊，預設0（px）
 * 
 * 'brightness'?: 亮度，預設100（%）
 * 
 * 'contrast'?: 對比度，預設100（%）
 * 
 * 'grayscale'?: 灰度，預設0（%）
 * 
 * 'saturate'?: 飽和度，預設100（%）
 * 
 * 'hue-rotate'?: 色相旋轉，預設0（deg）
 * 
 * 'opacity'?: 不透明度，預設100（%）
 */
export type ImageElementFilterKeys = 'blur' | 'brightness' | 'contrast' | 'grayscale' | 'saturate' | 'hue-rotate' | 'opacity' | 'sepia' | 'invert'
export interface ImageElementFilters {
  'blur'?: string
  'brightness'?: string
  'contrast'?: string
  'grayscale'?: string
  'saturate'?: string
  'hue-rotate'?: string
  'sepia'?: string
  'invert'?: string
  'opacity'?: string
}

export type ImageClipDataRange = [[number, number], [number, number]]

/**
 * 圖片裁剪
 * 
 * range: 裁剪範圍，例如：[[10, 10], [90, 90]] 表示裁取原圖從左上角 10%, 10% 到 90%, 90% 的範圍
 * 
 * shape: 裁剪形狀，見 configs/imageClip.ts CLIPPATHS 
 */
export interface ImageElementClip {
  range: ImageClipDataRange
  shape: string
}

export type ImageType = 'pageFigure' | 'itemFigure' | 'background'

/**
 * 圖片元素
 * 
 * type: 元素型別（image）
 * 
 * fixedRatio: 固定圖片寬高比例
 * 
 * src: 圖片地址
 * 
 * outline?: 邊框
 * 
 * filters?: 圖片濾鏡
 * 
 * clip?: 裁剪資訊
 * 
 * flipH?: 水平翻轉
 * 
 * flipV?: 垂直翻轉
 * 
 * shadow?: 陰影
 * 
 * radius?: 圓角半徑
 * 
 * colorMask?: 顏色蒙版
 * 
 * imageType?: 圖片型別
 */
export interface PPTImageElement extends PPTBaseElement {
  type: 'image'
  fixedRatio: boolean
  src: string
  outline?: PPTElementOutline
  filters?: ImageElementFilters
  clip?: ImageElementClip
  flipH?: boolean
  flipV?: boolean
  shadow?: PPTElementShadow
  radius?: number
  colorMask?: string
  imageType?: ImageType
}

/**
 * 形狀內文本
 * 
 * content: 文本內容（HTML字串）
 * 
 * defaultFontName: 預設字型（會被文本內容中的HTML內聯樣式覆蓋）
 * 
 * defaultColor: 預設顏色（會被文本內容中的HTML內聯樣式覆蓋）
 * 
 * align: 文本對齊方向（垂直方向）
 * 
 * lineHeight?: 行高（倍），預設1.5
 * 
 * wordSpace?: 字間距，預設0
 * 
 * paragraphSpace?: 段間距，預設5px
 * 
 * type: 文本型別
 * 
 * inset?: 文本內邊距（上、右、下、左），預設[10, 10, 10, 10]
 */
export interface ShapeText {
  content: string
  defaultFontName: string
  defaultColor: string
  align: TextAlignVertical
  lineHeight?: number
  wordSpace?: number
  paragraphSpace?: number
  inset?: TextInset
  type?: TextType
}

/**
 * 形狀元素
 * 
 * type: 元素型別（shape）
 * 
 * viewBox: SVG的viewBox屬性，例如 [1000, 1000] 表示 '0 0 1000 1000'
 * 
 * path: 形狀路徑，SVG path 的 d 屬性
 * 
 * fixedRatio: 固定形狀寬高比例
 * 
 * fill: 填充，不存在漸變時生效
 * 
 * gradient?: 漸變，該屬性存在時將優先作為填充
 * 
 * pattern?: 圖案，該屬性存在時將優先作為填充
 * 
 * outline?: 邊框
 * 
 * opacity?: 不透明度
 * 
 * flipH?: 水平翻轉
 * 
 * flipV?: 垂直翻轉
 * 
 * shadow?: 陰影
 * 
 * special?: 特殊形狀（標記一些難以解析的形狀，例如路徑使用了 L Q C A 以外的型別，該類形狀在匯出後將變為圖片的形式）
 * 
 * text?: 形狀內文本
 * 
 * pathFormula?: 形狀路徑計算公式
 * 一般情況下，形狀的大小變化時僅由寬高基於 viewBox 的縮放比例來調整形狀，而 viewBox 本身和 path 不會變化，
 * 但也有一些形狀希望能更精確的控制一些關鍵點的位置，此時就需要提供路徑計算公式，通過在縮放時更新 viewBox 並重新計算 path 來重新繪製形狀
 * 
 * keypoints?: 關鍵點位置百分比
 */
export interface PPTShapeElement extends PPTBaseElement {
  type: 'shape'
  viewBox: [number, number]
  path: string
  fixedRatio: boolean
  fill: string
  gradient?: Gradient
  pattern?: string
  outline?: PPTElementOutline
  opacity?: number
  flipH?: boolean
  flipV?: boolean
  shadow?: PPTElementShadow
  special?: boolean
  text?: ShapeText
  pathFormula?: ShapePathFormulasKeys
  keypoints?: number[]
}


export type LinePoint = '' | 'arrow' | 'dot' 
export type Broken2LineDirection = 'horizontal' | 'vertical'

/**
 * 線條元素
 * 
 * type: 元素型別（line）
 * 
 * start: 起點位置（[x, y]）
 * 
 * end: 終點位置（[x, y]）
 * 
 * style: 線條樣式（實線、虛線、點線）
 * 
 * color: 線條顏色
 * 
 * points: 端點樣式（[起點樣式, 終點樣式]，可選：無、箭頭、圓點）
 * 
 * shadow?: 陰影
 * 
 * broken?: 折線控制點位置（[x, y]）
 * 
 * broken2?: 雙摺線控制點位置（[x, y]）
 * 
 * broken2Direction?: 雙摺線方向
 * 
 * curve?: 二次曲線控制點位置（[x, y]）
 * 
 * cubic?: 三次曲線控制點位置（[[x1, y1], [x2, y2]]）
 */
export interface PPTLineElement extends Omit<PPTBaseElement, 'height' | 'rotate'> {
  type: 'line'
  start: [number, number]
  end: [number, number]
  style: LineStyleType
  color: string
  points: [LinePoint, LinePoint]
  shadow?: PPTElementShadow
  broken?: [number, number]
  broken2?: [number, number]
  broken2Direction?: Broken2LineDirection
  curve?: [number, number]
  cubic?: [[number, number], [number, number]]
}


export type ChartType = 'bar' | 'column' | 'line' | 'pie' | 'ring' | 'area' | 'radar' | 'scatter'

export interface ChartOptions {
  lineSmooth?: boolean
  stack?: boolean
}

export interface ChartData {
  labels: string[]
  legends: string[]
  series: number[][]
}

/**
 * 圖表元素
 * 
 * type: 元素型別（chart）
 * 
 * fill?: 填充色
 * 
 * chartType: 圖表基礎型別（bar/line/pie），所有圖表型別都是由這三種基本型別衍生而來
 * 
 * data: 圖表資料
 * 
 * options: 擴充套件選項
 * 
 * outline?: 邊框
 * 
 * themeColors: 主題色
 * 
 * textColor?: 座標和文字顏色
 * 
 * lineColor?: 網格顏色
 */
export interface PPTChartElement extends PPTBaseElement {
  type: 'chart'
  fill?: string
  chartType: ChartType
  data: ChartData
  options?: ChartOptions
  outline?: PPTElementOutline
  themeColors: string[]
  textColor?: string
  lineColor?: string
}


/**
 * 表格單元格樣式
 * 
 * bold?: 加粗
 * 
 * em?: 斜體
 * 
 * underline?: 下劃線
 * 
 * strikethrough?: 刪除線
 * 
 * color?: 字型顏色
 * 
 * backcolor?: 填充色
 * 
 * fontsize?: 字型大小
 * 
 * fontname?: 字型
 * 
 * align?: 對齊方式
 */
export interface TableCellStyle {
  bold?: boolean
  em?: boolean
  underline?: boolean
  strikethrough?: boolean
  color?: string
  backcolor?: string
  fontsize?: string
  fontname?: string
  align?: TextAlign
  vAlign?: TextAlignVertical
}


/**
 * 表格單元格
 * 
 * id: 單元格ID
 * 
 * colspan: 合併列數
 * 
 * rowspan: 合併行數
 * 
 * text: 文字內容
 * 
 * style?: 單元格樣式
 */
export interface TableCell {
  id: string
  colspan: number
  rowspan: number
  text: string
  style?: TableCellStyle
}

/**
 * 表格主題
 * 
 * color: 主題色
 * 
 * rowHeader: 標題行
 * 
 * rowFooter: 彙總行
 * 
 * colHeader: 第一列
 * 
 * colFooter: 最後一列
 */
export interface TableTheme {
  color: string
  rowHeader: boolean
  rowFooter: boolean
  colHeader: boolean
  colFooter: boolean
}

/**
 * 表格元素
 * 
 * type: 元素型別（table）
 * 
 * outline: 邊框
 * 
 * theme?: 主題
 * 
 * colWidths: 列寬陣列，如[0.3, 0.5, 0.2]表示三列寬度分別佔總寬度的30%, 50%, 20%
 * 
 * cellMinHeight: 單元格最小高度
 * 
 * data: 表格資料
 */
export interface PPTTableElement extends PPTBaseElement {
  type: 'table'
  outline: PPTElementOutline
  theme?: TableTheme
  colWidths: number[]
  cellMinHeight: number
  data: TableCell[][]
}


/**
 * LaTeX元素（公式）
 * 
 * type: 元素型別（latex）
 * 
 * latex: latex程式碼
 * 
 * path: svg path
 * 
 * color: 顏色
 * 
 * strokeWidth: 路徑寬度
 * 
 * viewBox: SVG的viewBox屬性
 * 
 * fixedRatio: 固定形狀寬高比例
 */
export interface PPTLatexElement extends PPTBaseElement {
  type: 'latex'
  latex: string
  path: string
  color: string
  strokeWidth: number
  viewBox: [number, number]
  fixedRatio: boolean
}

/**
 * 影片元素
 * 
 * type: 元素型別（video）
 * 
 * src: 影片地址
 * 
 * autoplay: 自動播放
 * 
 * poster: 預覽封面
 * 
 * ext: 影片字尾，當資源連結缺少字尾時用該欄位確認資源型別
 */
export interface PPTVideoElement extends PPTBaseElement {
  type: 'video'
  src: string
  autoplay: boolean
  poster?: string
  ext?: string
}

/**
 * 音訊元素
 * 
 * type: 元素型別（audio）
 * 
 * fixedRatio: 固定圖示寬高比例
 * 
 * color: 圖示顏色
 * 
 * loop: 迴圈播放
 * 
 * autoplay: 自動播放
 * 
 * src: 音訊地址
 * 
 * ext: 音訊字尾，當資源連結缺少字尾時用該欄位確認資源型別
 */
export interface PPTAudioElement extends PPTBaseElement {
  type: 'audio'
  fixedRatio: boolean
  color: string
  loop: boolean
  autoplay: boolean
  src: string
  ext?: string
}


export type PPTElement = PPTTextElement | PPTImageElement | PPTShapeElement | PPTLineElement | PPTChartElement | PPTTableElement | PPTLatexElement | PPTVideoElement | PPTAudioElement

export type AnimationType = 'in' | 'out' | 'attention'
export type AnimationTrigger = 'click' | 'meantime' | 'auto'

/**
 * 元素動畫
 * 
 * id: 動畫id
 * 
 * elId: 元素ID
 * 
 * effect: 動畫效果
 * 
 * type: 動畫型別（入場、退場、強調）
 * 
 * duration: 動畫持續時間
 * 
 * trigger: 動畫觸發方式(click - 單擊時、meantime - 與上一動畫同時、auto - 上一動畫之後)
 */
export interface PPTAnimation {
  id: string
  elId: string
  effect: string
  type: AnimationType
  duration: number
  trigger: AnimationTrigger
}

export type SlideBackgroundType = 'solid' | 'image' | 'gradient'
export type SlideBackgroundImageSize = 'cover' | 'contain' | 'repeat'
export interface SlideBackgroundImage {
  src: string
  size: SlideBackgroundImageSize,
}

/**
 * 投影片背景
 * 
 * type: 背景型別（純色、圖片、漸變）
 * 
 * color?: 背景顏色（純色）
 * 
 * image?: 圖片背景
 * 
 * gradientType?: 漸變背景
 */
export interface SlideBackground {
  type: SlideBackgroundType
  color?: string
  image?: SlideBackgroundImage
  gradient?: Gradient
}


export type TurningMode = 'no' | 'fade' | 'slideX' | 'slideY' | 'random' | 'slideX3D' | 'slideY3D' | 'rotate' | 'scaleY' | 'scaleX' | 'scale' | 'scaleReverse'

export interface NoteReply {
  id: string
  content: string
  time: number
  user: string
}

export interface Note {
  id: string
  content: string
  time: number
  user: string
  elId?: string
  replies?: NoteReply[]
}

export interface SectionTag {
  id: string
  title?: string
}

export type SlideType = 'cover' | 'contents' | 'transition' | 'content' | 'end'

/**
 * 投影片頁面
 * 
 * id: 頁面ID
 * 
 * elements: 元素集合
 * 
 * notes?: 註解
 * 
 * remark?: 備註
 * 
 * background?: 頁面背景
 * 
 * animations?: 元素動畫集合
 * 
 * turningMode?: 翻頁方式
 * 
 * slideType?: 頁面型別
 */
export interface Slide {
  id: string
  elements: PPTElement[]
  notes?: Note[]
  remark?: string
  background?: SlideBackground
  animations?: PPTAnimation[]
  turningMode?: TurningMode
  sectionTag?: SectionTag
  type?: SlideType
}

/**
 * 投影片主題
 * 
 * backgroundColor: 頁面背景顏色
 * 
 * themeColor: 主題色，用於預設建立的形狀顏色等
 * 
 * fontColor: 字型顏色
 * 
 * fontName: 字型
 */
export interface SlideTheme {
  backgroundColor: string
  themeColors: string[]
  fontColor: string
  fontName: string
  outline: PPTElementOutline
  shadow: PPTElementShadow
}

export interface SlideTemplate {
  name: string
  id: string
  cover: string
  origin?: string
}
