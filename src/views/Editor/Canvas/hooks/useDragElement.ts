import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore, useKeyboardStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import type { AlignmentLineProps } from '@/types/edit'
import { createElementIdMap, getRectRotatedRange, uniqAlignLines, type AlignLine } from '@/utils/element'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default (
  elementList: Ref<PPTElement[]>,
  alignmentLines: Ref<AlignmentLineProps[]>,
  canvasScale: Ref<number>,
) => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeGroupElementId } = storeToRefs(mainStore)
  const { ctrlKeyState, shiftKeyState } = storeToRefs(useKeyboardStore())
  const { viewportRatio, viewportSize } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  const dragElement = (e: MouseEvent | TouchEvent, element: PPTElement) => {
    const isTouchEvent = !(e instanceof MouseEvent)
    if (isTouchEvent && (!e.changedTouches || !e.changedTouches[0])) return

    if (!activeElementIdList.value.includes(element.id)) return
    let isMouseDown = true

    const edgeWidth = viewportSize.value
    const edgeHeight = viewportSize.value * viewportRatio.value
    
    const sorptionRange = 5

    const originElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList.value))
    let originActiveElementList = originElementList.filter(el => activeElementIdList.value.includes(el.id))

    // 拖拽目標元素和初始屬性宣告，Ctrl+拖拽複製時會替換為副本元素及其屬性
    let dragTargetElement = element
    let elOriginLeft = element.left
    let elOriginTop = element.top
    let elOriginWidth = element.width
    let elOriginHeight = ('height' in element && element.height) ? element.height : 0
    let elOriginRotate = ('rotate' in element && element.rotate) ? element.rotate : 0
  
    const startPageX = isTouchEvent ? e.changedTouches[0].pageX : e.pageX
    const startPageY = isTouchEvent ? e.changedTouches[0].pageY : e.pageY

    let isMisoperation: boolean | null = null
    let duplicateTriggered = false // 標記是否已觸發 Ctrl+拖拽複製

    const isActiveGroupElement = element.id === activeGroupElementId.value

    // 單元素拖拽：僅選中一個元素，或正在操作組合中的啟用成員
    const dragSingleElement = activeElementIdList.value.length === 1 || isActiveGroupElement

    // 收集對齊對齊吸附線
    // 包括頁面內除目標元素外的其他元素在畫布中的各個可吸附對齊位置：上下左右四邊，水平中心、垂直中心
    // 其中線條和被旋轉過的元素需要重新計算他們在畫布中的中心點位置的範圍
    let horizontalLines: AlignLine[] = []
    let verticalLines: AlignLine[] = []

    for (const el of elementList.value) {
      if (el.type === 'line') continue
      if (isActiveGroupElement && el.id === element.id) continue
      if (!isActiveGroupElement && activeElementIdList.value.includes(el.id)) continue

      let left, top, width, height
      if ('rotate' in el && el.rotate) {
        const { xRange, yRange } = getRectRotatedRange({
          left: el.left,
          top: el.top,
          width: el.width,
          height: el.height,
          rotate: el.rotate,
        })
        left = xRange[0]
        top = yRange[0]
        width = xRange[1] - xRange[0]
        height = yRange[1] - yRange[0]
      }
      else {
        left = el.left
        top = el.top
        width = el.width
        height = el.height
      }
      
      const right = left + width
      const bottom = top + height
      const centerX = top + height / 2
      const centerY = left + width / 2

      const topLine: AlignLine = { value: top, range: [left, right] }
      const bottomLine: AlignLine = { value: bottom, range: [left, right] }
      const horizontalCenterLine: AlignLine = { value: centerX, range: [left, right] }
      const leftLine: AlignLine = { value: left, range: [top, bottom] }
      const rightLine: AlignLine = { value: right, range: [top, bottom] }
      const verticalCenterLine: AlignLine = { value: centerY, range: [top, bottom] }

      horizontalLines.push(topLine, bottomLine, horizontalCenterLine)
      verticalLines.push(leftLine, rightLine, verticalCenterLine)
    }

    // 畫布可視區域的四個邊界、水平中心、垂直中心
    const edgeTopLine: AlignLine = { value: 0, range: [0, edgeWidth] }
    const edgeBottomLine: AlignLine = { value: edgeHeight, range: [0, edgeWidth] }
    const edgeHorizontalCenterLine: AlignLine = { value: edgeHeight / 2, range: [0, edgeWidth] }
    const edgeLeftLine: AlignLine = { value: 0, range: [0, edgeHeight] }
    const edgeRightLine: AlignLine = { value: edgeWidth, range: [0, edgeHeight] }
    const edgeVerticalCenterLine: AlignLine = { value: edgeWidth / 2, range: [0, edgeHeight] }

    horizontalLines.push(edgeTopLine, edgeBottomLine, edgeHorizontalCenterLine)
    verticalLines.push(edgeLeftLine, edgeRightLine, edgeVerticalCenterLine)
    
    // 對齊吸附線去重
    horizontalLines = uniqAlignLines(horizontalLines)
    verticalLines = uniqAlignLines(verticalLines)

    // Ctrl+拖拽複製：複製選中元素並將副本插入畫布，
    // 然後將拖拽目標切換為副本元素，後續移動操作作用於副本上
    const duplicateElement = () => {
      // 複製源元素，單選時僅複製目標元素，多選時複製所有選中元素
      const sourceElements = JSON.parse(JSON.stringify(dragSingleElement ? [dragTargetElement] : originActiveElementList)) as PPTElement[]

      const { groupIdMap, elIdMap } = createElementIdMap(sourceElements)

      const duplicatedElements = sourceElements.map(item => {
        item.id = elIdMap[item.id]
        if (isActiveGroupElement && item.groupId) delete item.groupId
        else if (item.groupId) item.groupId = groupIdMap[item.groupId]
        return item
      })

      elementList.value = [...elementList.value, ...duplicatedElements]
      slidesStore.updateSlide({ elements: elementList.value })

      // 將選中狀態切換到副本元素
      const duplicatedActiveElementIdList = duplicatedElements.map(item => item.id)
      const duplicatedHandleElementId = elIdMap[dragTargetElement.id]
      const duplicatedHandleElement = duplicatedElements.find(item => item.id === duplicatedHandleElementId)
      if (!duplicatedHandleElement) return

      mainStore.setActiveElementIdList(duplicatedActiveElementIdList)
      mainStore.setHandleElementId(duplicatedHandleElementId)
      mainStore.setActiveGroupElementId('')

      // 將拖拽目標和初始屬性替換為副本
      dragTargetElement = duplicatedHandleElement
      originActiveElementList = duplicatedElements

      elOriginLeft = duplicatedHandleElement.left
      elOriginTop = duplicatedHandleElement.top
      elOriginWidth = duplicatedHandleElement.width
      elOriginHeight = ('height' in duplicatedHandleElement && duplicatedHandleElement.height) ? duplicatedHandleElement.height : 0
      elOriginRotate = ('rotate' in duplicatedHandleElement && duplicatedHandleElement.rotate) ? duplicatedHandleElement.rotate : 0

      duplicateTriggered = true
    }

    const handleMousemove = (e: MouseEvent | TouchEvent) => {
      const currentPageX = e instanceof MouseEvent ? e.pageX : e.changedTouches[0].pageX
      const currentPageY = e instanceof MouseEvent ? e.pageY : e.changedTouches[0].pageY

      // 如果滑鼠滑動距離過小，則將操作判定為誤操作：
      // 如果誤操作標記為null，表示是第一次觸發移動，需要計算當前是否是誤操作
      // 如果誤操作標記為true，表示當前還處在誤操作範圍內，但仍然需要繼續計算檢查後續操作是否還處於誤操作
      // 如果誤操作標記為false，表示已經脫離了誤操作範圍，不需要再次計算
      if (isMisoperation !== false) {
        isMisoperation = Math.abs(startPageX - currentPageX) < sorptionRange && 
                         Math.abs(startPageY - currentPageY) < sorptionRange
      }
      if (!isMouseDown || isMisoperation) return

      // 拖拽過程中按住Ctrl鍵且尚未複製過，則觸發複製
      if (!duplicateTriggered && ctrlKeyState.value) duplicateElement()
      
      let moveX = (currentPageX - startPageX) / canvasScale.value
      let moveY = (currentPageY - startPageY) / canvasScale.value

      if (shiftKeyState.value) {
        if (Math.abs(moveX) > Math.abs(moveY)) moveY = 0
        if (Math.abs(moveX) < Math.abs(moveY)) moveX = 0
      }

      // 基礎目標位置
      let targetLeft = elOriginLeft + moveX
      let targetTop = elOriginTop + moveY

      // 計算目標元素在畫布中的位置範圍，用於吸附對齊
      // 需要區分單選和多選兩種情況，其中多選狀態下需要計算多選元素的整體範圍；單選狀態下需要繼續區分線條、普通元素、旋轉後的普通元素三種情況
      let targetMinX: number, targetMaxX: number, targetMinY: number, targetMaxY: number

      if (dragSingleElement) {
        if (elOriginRotate) {
          const { xRange, yRange } = getRectRotatedRange({
            left: targetLeft,
            top: targetTop,
            width: elOriginWidth,
            height: elOriginHeight,
            rotate: elOriginRotate,
          })
          targetMinX = xRange[0]
          targetMaxX = xRange[1]
          targetMinY = yRange[0]
          targetMaxY = yRange[1]
        }
        else if (dragTargetElement.type === 'line') {
          targetMinX = targetLeft
          targetMaxX = targetLeft + Math.max(dragTargetElement.start[0], dragTargetElement.end[0])
          targetMinY = targetTop
          targetMaxY = targetTop + Math.max(dragTargetElement.start[1], dragTargetElement.end[1])
        }
        else {
          targetMinX = targetLeft
          targetMaxX = targetLeft + elOriginWidth
          targetMinY = targetTop
          targetMaxY = targetTop + elOriginHeight
        }
      }
      else {
        const leftValues = []
        const topValues = []
        const rightValues = []
        const bottomValues = []
        
        for (let i = 0; i < originActiveElementList.length; i++) {
          const element = originActiveElementList[i]
          const left = element.left + moveX
          const top = element.top + moveY
          const width = element.width
          const height = ('height' in element && element.height) ? element.height : 0
          const rotate = ('rotate' in element && element.rotate) ? element.rotate : 0

          if ('rotate' in element && element.rotate) {
            const { xRange, yRange } = getRectRotatedRange({ left, top, width, height, rotate })
            leftValues.push(xRange[0])
            topValues.push(yRange[0])
            rightValues.push(xRange[1])
            bottomValues.push(yRange[1])
          }
          else if (element.type === 'line') {
            leftValues.push(left)
            topValues.push(top)
            rightValues.push(left + Math.max(element.start[0], element.end[0]))
            bottomValues.push(top + Math.max(element.start[1], element.end[1]))
          }
          else {
            leftValues.push(left)
            topValues.push(top)
            rightValues.push(left + width)
            bottomValues.push(top + height)
          }
        }

        targetMinX = Math.min(...leftValues)
        targetMaxX = Math.max(...rightValues)
        targetMinY = Math.min(...topValues)
        targetMaxY = Math.max(...bottomValues)
      }
      
      const targetCenterX = targetMinX + (targetMaxX - targetMinX) / 2
      const targetCenterY = targetMinY + (targetMaxY - targetMinY) / 2

      // 將收集到的對齊吸附線與計算的目標元素位置範圍做對比，二者的差小於設定的值時執行自動對齊校正
      // 水平和垂直兩個方向需要分開計算
      const _alignmentLines: AlignmentLineProps[] = []
      let isVerticalAdsorbed = false
      let isHorizontalAdsorbed = false
      for (let i = 0; i < horizontalLines.length; i++) {
        const { value, range } = horizontalLines[i]
        const min = Math.min(...range, targetMinX, targetMaxX)
        const max = Math.max(...range, targetMinX, targetMaxX)
        
        if (Math.abs(targetMinY - value) < sorptionRange && !isHorizontalAdsorbed) {
          targetTop = targetTop - (targetMinY - value)
          isHorizontalAdsorbed = true
          _alignmentLines.push({type: 'horizontal', axis: {x: min - 50, y: value}, length: max - min + 100})
        }
        if (Math.abs(targetMaxY - value) < sorptionRange && !isHorizontalAdsorbed) {
          targetTop = targetTop - (targetMaxY - value)
          isHorizontalAdsorbed = true
          _alignmentLines.push({type: 'horizontal', axis: {x: min - 50, y: value}, length: max - min + 100})
        }
        if (Math.abs(targetCenterY - value) < sorptionRange && !isHorizontalAdsorbed) {
          targetTop = targetTop - (targetCenterY - value)
          isHorizontalAdsorbed = true
          _alignmentLines.push({type: 'horizontal', axis: {x: min - 50, y: value}, length: max - min + 100})
        }
      }
      for (let i = 0; i < verticalLines.length; i++) {
        const { value, range } = verticalLines[i]
        const min = Math.min(...range, targetMinY, targetMaxY)
        const max = Math.max(...range, targetMinY, targetMaxY)

        if (Math.abs(targetMinX - value) < sorptionRange && !isVerticalAdsorbed) {
          targetLeft = targetLeft - (targetMinX - value)
          isVerticalAdsorbed = true
          _alignmentLines.push({type: 'vertical', axis: {x: value, y: min - 50}, length: max - min + 100})
        }
        if (Math.abs(targetMaxX - value) < sorptionRange && !isVerticalAdsorbed) {
          targetLeft = targetLeft - (targetMaxX - value)
          isVerticalAdsorbed = true
          _alignmentLines.push({type: 'vertical', axis: {x: value, y: min - 50}, length: max - min + 100})
        }
        if (Math.abs(targetCenterX - value) < sorptionRange && !isVerticalAdsorbed) {
          targetLeft = targetLeft - (targetCenterX - value)
          isVerticalAdsorbed = true
          _alignmentLines.push({type: 'vertical', axis: {x: value, y: min - 50}, length: max - min + 100})
        }
      }
      alignmentLines.value = _alignmentLines
      
      // 單選狀態下，或者當前選中的多個元素中存在正在操作的元素時，僅修改正在操作的元素的位置
      if (dragSingleElement) {
        elementList.value = elementList.value.map(el => {
          return el.id === dragTargetElement.id ? { ...el, left: targetLeft, top: targetTop } : el
        })
      }

      // 多選狀態下，除了修改正在操作的元素的位置，其他被選中的元素也需要修改位置資訊
      // 其他被選中的元素的位置資訊通過正在操作的元素的移動偏移量來進行計算
      else {
        const handleElement = elementList.value.find(el => el.id === dragTargetElement.id)
        if (!handleElement) return

        elementList.value = elementList.value.map(el => {
          if (activeElementIdList.value.includes(el.id)) {
            if (el.id === dragTargetElement.id) {
              return {
                ...el,
                left: targetLeft,
                top: targetTop,
              }
            }
            return {
              ...el,
              left: el.left + (targetLeft - handleElement.left),
              top: el.top + (targetTop - handleElement.top),
            }
          }
          return el
        })
      }
    }

    const handleMouseup = (e: MouseEvent | TouchEvent) => {
      isMouseDown = false
      
      document.ontouchmove = null
      document.ontouchend = null
      document.onmousemove = null
      document.onmouseup = null

      alignmentLines.value = []

      const currentPageX = e instanceof MouseEvent ? e.pageX : e.changedTouches[0].pageX
      const currentPageY = e instanceof MouseEvent ? e.pageY : e.changedTouches[0].pageY

      if (startPageX === currentPageX && startPageY === currentPageY) return

      slidesStore.updateSlide({ elements: elementList.value })
      addHistorySnapshot()
    }

    if (isTouchEvent) {
      document.ontouchmove = handleMousemove
      document.ontouchend = handleMouseup
    }
    else {
      document.onmousemove = handleMousemove
      document.onmouseup = handleMouseup
    }
  }

  return {
    dragElement,
  }
}