import { customAlphabet } from 'nanoid'
import { defineStore } from 'pinia'
import { ToolbarStates } from '@/types/toolbar'
import type { CreatingElement, ShapeFormatPainter, TextFormatPainter } from '@/types/edit'
import type { DialogForExportTypes } from '@/types/export'
import { type TextAttrs, defaultRichTextAttrs } from '@/utils/prosemirror/utils'

import { useSlidesStore } from './slides'

export interface MainState {
  activeElementIdList: string[]
  handleElementId: string
  activeGroupElementId: string
  hiddenElementIdList: string[]
  canvasPercentage: number
  canvasScale: number
  canvasDragged: boolean
  thumbnailsFocus: boolean
  editorAreaFocus: boolean
  disableHotkeys: boolean
  gridLineSize: number
  showRuler: boolean
  showBubbleMenu: boolean
  creatingElement: CreatingElement | null
  creatingCustomShape: boolean
  toolbarState: ToolbarStates
  clipingImageElementId: string
  isScaling: boolean
  richTextAttrs: TextAttrs
  selectedTableCells: string[]
  selectedSlidesIndex: number[]
  dialogForExport: DialogForExportTypes
  databaseId: string
  textFormatPainter: TextFormatPainter | null
  shapeFormatPainter: ShapeFormatPainter | null
  showSelectPanel: boolean
  showSearchPanel: boolean
  showNotesPanel: boolean
  showSymbolPanel: boolean
  showMarkupPanel: boolean
  showImageLibPanel: boolean
  showAIPPTDialog: boolean | 'running'
  showAICopilotPanel: boolean
  aiElementEditRequest: { elementId: string; instruction: string } | null
}

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
export const databaseId = nanoid(10)

export const useMainStore = defineStore('main', {
  state: (): MainState => ({
    activeElementIdList: [], // 被選中的元素ID集合，包含 handleElementId
    handleElementId: '', // 正在操作的元素ID
    activeGroupElementId: '', // 組合元素成員中，被選中可獨立操作的元素ID
    hiddenElementIdList: [], // 被隱藏的元素ID集合
    canvasPercentage: 90, // 畫布可視區域百分比
    canvasScale: 1, // 畫布縮放比例（基於寬度{{slidesStore.viewportSize}}畫素）
    canvasDragged: false, // 畫布被拖拽移動
    thumbnailsFocus: false, // 左側導航縮圖區域聚焦
    editorAreaFocus: false, //  編輯區域聚焦
    disableHotkeys: false, // 停用快捷鍵
    gridLineSize: 0, // 網格線尺寸（0表示不顯示網格線）
    showRuler: false, // 顯示尺規
    showBubbleMenu: false, // 顯示浮動選單
    creatingElement: null, // 正在插入的元素資訊，需要通過繪製插入的元素（文字、形狀、線條）
    creatingCustomShape: false, // 正在繪製任意多邊形
    toolbarState: ToolbarStates.SLIDE_DESIGN, // 右側工具欄狀態
    clipingImageElementId: '', // 當前正在裁剪的圖片ID  
    richTextAttrs: defaultRichTextAttrs, // 富文本狀態
    selectedTableCells: [], // 選中的表格單元格
    isScaling: false, // 正在進行元素縮放
    selectedSlidesIndex: [], // 當前被選中的頁面索引集合
    dialogForExport: '', // 匯出面板
    databaseId, // 標識當前應用的indexedDB資料庫ID
    textFormatPainter: null, // 文字格式刷
    shapeFormatPainter: null, // 形狀格式刷
    showSelectPanel: false, // 開啟選擇面板
    showSearchPanel: false, // 開啟查詢替換面板
    showNotesPanel: false, // 開啟註解面板
    showSymbolPanel: false, // 開啟符號面板
    showMarkupPanel: false, // 開啟型別標註面板
    showImageLibPanel: false, // 開啟圖片庫面板
    showAIPPTDialog: false, // 打开AIPPT创建窗口
    showAICopilotPanel: false, // 打开AI Copilot聊天室面板
    aiElementEditRequest: null,
  }),

  getters: {
    activeElementList(state) {
      const slidesStore = useSlidesStore()
      const currentSlide = slidesStore.currentSlide
      if (!currentSlide || !currentSlide.elements) return []
      return currentSlide.elements.filter(element => state.activeElementIdList.includes(element.id))
    },
  
    handleElement(state) {
      const slidesStore = useSlidesStore()
      const currentSlide = slidesStore.currentSlide
      if (!currentSlide || !currentSlide.elements) return null
      return currentSlide.elements.find(element => state.handleElementId === element.id) || null
    },
  },

  actions: {
    setActiveElementIdList(activeElementIdList: string[]) {
      if (activeElementIdList.length === 1) this.handleElementId = activeElementIdList[0]
      else this.handleElementId = ''
      
      this.activeElementIdList = activeElementIdList
    },
    
    setHandleElementId(handleElementId: string) {
      this.handleElementId = handleElementId
    },
    
    setActiveGroupElementId(activeGroupElementId: string) {
      this.activeGroupElementId = activeGroupElementId
    },
    
    setHiddenElementIdList(hiddenElementIdList: string[]) {
      this.hiddenElementIdList = hiddenElementIdList
    },
  
    setCanvasPercentage(percentage: number) {
      this.canvasPercentage = percentage
    },
  
    setCanvasScale(scale: number) {
      this.canvasScale = scale
    },
  
    setCanvasDragged(isDragged: boolean) {
      this.canvasDragged = isDragged
    },
  
    setThumbnailsFocus(isFocus: boolean) {
      this.thumbnailsFocus = isFocus
    },
  
    setEditorareaFocus(isFocus: boolean) {
      this.editorAreaFocus = isFocus
    },
  
    setDisableHotkeysState(disable: boolean) {
      this.disableHotkeys = disable
    },
  
    setGridLineSize(size: number) {
      this.gridLineSize = size
    },
  
    setRulerState(show: boolean) {
      this.showRuler = show
    },

    setBubbleMenuState(show: boolean) {
      this.showBubbleMenu = show
    },
  
    setCreatingElement(element: CreatingElement | null) {
      this.creatingElement = element
    },
  
    setCreatingCustomShapeState(state: boolean) {
      this.creatingCustomShape = state
    },
  
    setToolbarState(toolbarState: ToolbarStates) {
      this.toolbarState = toolbarState
    },
  
    setClipingImageElementId(elId: string) {
      this.clipingImageElementId = elId
    },
  
    setRichtextAttrs(attrs: TextAttrs) {
      this.richTextAttrs = attrs
    },
  
    setSelectedTableCells(cells: string[]) {
      this.selectedTableCells = cells
    },
  
    setScalingState(isScaling: boolean) {
      this.isScaling = isScaling
    },
    
    updateSelectedSlidesIndex(selectedSlidesIndex: number[]) {
      this.selectedSlidesIndex = selectedSlidesIndex
    },

    setDialogForExport(type: DialogForExportTypes) {
      this.dialogForExport = type
    },

    setTextFormatPainter(textFormatPainter: TextFormatPainter | null) {
      this.textFormatPainter = textFormatPainter
    },

    setShapeFormatPainter(shapeFormatPainter: ShapeFormatPainter | null) {
      this.shapeFormatPainter = shapeFormatPainter
    },

    setSelectPanelState(show: boolean) {
      this.showSelectPanel = show
    },

    setSearchPanelState(show: boolean) {
      this.showSearchPanel = show
    },

    setNotesPanelState(show: boolean) {
      this.showNotesPanel = show
    },

    setSymbolPanelState(show: boolean) {
      this.showSymbolPanel = show
    },

    setMarkupPanelState(show: boolean) {
      this.showMarkupPanel = show
    },

    setImageLibPanelState(show: boolean) {
      this.showImageLibPanel = show
    },

    setAIPPTDialogState(show: boolean | 'running') {
      this.showAIPPTDialog = show
    },

    setAICopilotPanelState(show: boolean) {
      this.showAICopilotPanel = show
    },

    setAIElementEditRequest(request: { elementId: string; instruction: string } | null) {
      this.aiElementEditRequest = request
    },
  },
})
