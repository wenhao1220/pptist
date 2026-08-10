import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore, useKeyboardStore } from '@/store'
import type { PPTElement, PPTImageElement, PPTLineElement, PPTShapeElement } from '@/types/slides'
import { OperateResizeHandlers, type AlignmentLineProps, type MultiSelectRange } from '@/types/edit'
import { MIN_SIZE } from '@/configs/element'
import { SHAPE_PATH_FORMULAS } from '@/configs/shapes'
import { type AlignLine, uniqAlignLines } from '@/utils/element'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

interface RotateElementData {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 計算旋轉後的元素八個縮放點的位置
 * @param element 元素原始位置大小資訊
 * @param angle 旋轉角度
 */
const getRotateElementPoints = (element: RotateElementData, angle: number) => {
  const { left, top, width, height } = element

  const radius = Math.sqrt( Math.pow(width, 2) + Math.pow(height, 2) ) / 2
  const auxiliaryAngle = Math.atan(height / width) * 180 / Math.PI

  const tlbraRadian = (180 - angle - auxiliaryAngle) * Math.PI / 180
  const trblaRadian = (auxiliaryAngle - angle) * Math.PI / 180
  const taRadian = (90 - angle) * Math.PI / 180
  const raRadian = angle * Math.PI / 180

  const halfWidth = width / 2
  const halfHeight = height / 2

  const middleLeft = left + halfWidth
  const middleTop = top + halfHeight

  const leftTopPoint = {
    left: middleLeft + radius * Math.cos(tlbraRadian),
    top: middleTop - radius * Math.sin(tlbraRadian),
  }
  const topPoint = {
    left: middleLeft + halfHeight * Math.cos(taRadian),
    top: middleTop - halfHeight * Math.sin(taRadian),
  }
  const rightTopPoint = {
    left: middleLeft + radius * Math.cos(trblaRadian),
    top: middleTop - radius * Math.sin(trblaRadian),
  }
  const rightPoint = {
    left: middleLeft + halfWidth * Math.cos(raRadian),
    top: middleTop + halfWidth * Math.sin(raRadian),
  }
  const rightBottomPoint = {
    left: middleLeft - radius * Math.cos(tlbraRadian),
    top: middleTop + radius * Math.sin(tlbraRadian),
  }
  const bottomPoint = {
    left: middleLeft - halfHeight * Math.sin(raRadian),
    top: middleTop + halfHeight * Math.cos(raRadian),
  }
  const leftBottomPoint = {
    left: middleLeft - radius * Math.cos(trblaRadian),
    top: middleTop + radius * Math.sin(trblaRadian),
  }
  const leftPoint = {
    left: middleLeft - halfWidth * Math.cos(raRadian),
    top: middleTop - halfWidth * Math.sin(raRadian),
  }

  return { leftTopPoint, topPoint, rightTopPoint, rightPoint, rightBottomPoint, bottomPoint, leftBottomPoint, leftPoint }
}

/**
 * 獲取元素某縮放點相對的另一個點的位置，如：【上】對應【下】、【左上】對應【右下】
 * @param direction 當前操作的縮放點
 * @param points 旋轉後的元素八個縮放點的位置
 */
const getOppositePoint = (direction: OperateResizeHandlers, points: ReturnType<typeof getRotateElementPoints>): { left: number; top: number } => {
  const oppositeMap = {
    [OperateResizeHandlers.RIGHT_BOTTOM]: points.leftTopPoint,
    [OperateResizeHandlers.LEFT_BOTTOM]: points.rightTopPoint,
    [OperateResizeHandlers.LEFT_TOP]: points.rightBottomPoint,
    [OperateResizeHandlers.RIGHT_TOP]: points.leftBottomPoint,
    [OperateResizeHandlers.TOP]: points.bottomPoint,
    [OperateResizeHandlers.BOTTOM]: points.topPoint,
    [OperateResizeHandlers.LEFT]: points.rightPoint,
    [OperateResizeHandlers.RIGHT]: points.leftPoint,
  }
  return oppositeMap[direction]
}

/**
 * 判斷是否為角點縮放
 * @param direction 當前操作的縮放點
 */
const isCornerResizeHandler = (direction: OperateResizeHandlers) => {
  return direction === OperateResizeHandlers.RIGHT_BOTTOM ||
    direction === OperateResizeHandlers.LEFT_BOTTOM ||
    direction === OperateResizeHandlers.LEFT_TOP ||
    direction === OperateResizeHandlers.RIGHT_TOP
}

/**
 * 獲取當前操作縮放點的位置
 * @param direction 當前操作的縮放點
 * @param points 旋轉後的元素八個縮放點的位置
 */
const getResizeHandlerPoint = (direction: OperateResizeHandlers, points: ReturnType<typeof getRotateElementPoints>): { left: number; top: number } => {
  const pointMap = {
    [OperateResizeHandlers.RIGHT_BOTTOM]: points.rightBottomPoint,
    [OperateResizeHandlers.LEFT_BOTTOM]: points.leftBottomPoint,
    [OperateResizeHandlers.LEFT_TOP]: points.leftTopPoint,
    [OperateResizeHandlers.RIGHT_TOP]: points.rightTopPoint,
    [OperateResizeHandlers.TOP]: points.topPoint,
    [OperateResizeHandlers.BOTTOM]: points.bottomPoint,
    [OperateResizeHandlers.LEFT]: points.leftPoint,
    [OperateResizeHandlers.RIGHT]: points.rightPoint,
  }
  return pointMap[direction]
}

export default (
  elementList: Ref<PPTElement[]>,
  alignmentLines: Ref<AlignmentLineProps[]>,
  canvasScale: Ref<number>,
) => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeGroupElementId } = storeToRefs(mainStore)
  const { viewportRatio, viewportSize } = storeToRefs(slidesStore)
  const { ctrlOrShiftKeyActive } = storeToRefs(useKeyboardStore())

  const { addHistorySnapshot } = useHistorySnapshot()

  // 縮放元素
  const scaleElement = (e: MouseEvent | TouchEvent, element: Exclude<PPTElement, PPTLineElement>, command: OperateResizeHandlers) => {
    const isTouchEvent = !(e instanceof MouseEvent)
    if (isTouchEvent && (!e.changedTouches || !e.changedTouches[0])) return

    let isMouseDown = true
    mainStore.setScalingState(true)

    const elOriginLeft = element.left
    const elOriginTop = element.top
    const elOriginWidth = element.width
    const elOriginHeight = element.height

    const originTableCellMinHeight = element.type === 'table' ? element.cellMinHeight : 0
    
    const elRotate = ('rotate' in element && element.rotate) ? element.rotate : 0
    const rotateRadian = Math.PI * elRotate / 180

    const fixedRatio = ctrlOrShiftKeyActive.value || ('fixedRatio' in element && element.fixedRatio)
    const aspectRatio = elOriginWidth / elOriginHeight

    const startPageX = isTouchEvent ? e.changedTouches[0].pageX : e.pageX
    const startPageY = isTouchEvent ? e.changedTouches[0].pageY : e.pageY

    // 元素最小縮放限制
    const minSize = MIN_SIZE[element.type] || 20
    const getSizeWithinRange = (size: number, type: 'width' | 'height') => {
      if (!fixedRatio) return size < minSize ? minSize : size

      let minWidth = minSize
      let minHeight = minSize
      const ratio = element.width / element.height
      if (ratio < 1) minHeight = minSize / ratio
      if (ratio > 1) minWidth = minSize * ratio

      if (type === 'width') return size < minWidth ? minWidth : size
      return size < minHeight ? minHeight : size
    }

    let points: ReturnType<typeof getRotateElementPoints>
    let baseLeft = 0
    let baseTop = 0
    let horizontalLines: AlignLine[] = []
    let verticalLines: AlignLine[] = []
    const isCornerScaling = elRotate ? isCornerResizeHandler(command) : false

    // 旋轉後的元素進行縮放時，引入基點的概念，以當前操作的縮放點相對的點為基點
    // 例如拖動右下角縮放時，左上角為基點，需要保持左上角不變然後修改其他的點的位置來達到所放的效果
    if ('rotate' in element && element.rotate) {
      const { left, top, width, height } = element
      points = getRotateElementPoints({ left, top, width, height }, elRotate)
      const oppositePoint = getOppositePoint(command, points)

      baseLeft = oppositePoint.left
      baseTop = oppositePoint.top
    }

    // 未旋轉的元素，以及旋轉元素的角點縮放具有對齊吸附功能，在此處收集對齊吸附線
    // 包括頁面內除目標元素外的其他元素在畫布中的各個可吸附對齊位置：上下左右四邊
    // 其中線條和被旋轉過的元素不參與吸附對齊
    if (!elRotate || isCornerScaling) {
      const edgeWidth = viewportSize.value
      const edgeHeight = viewportSize.value * viewportRatio.value
      const isActiveGroupElement = element.id === activeGroupElementId.value
      
      for (const el of elementList.value) {
        if ('rotate' in el && el.rotate) continue
        if (el.type === 'line') continue
        if (isActiveGroupElement && el.id === element.id) continue
        if (!isActiveGroupElement && activeElementIdList.value.includes(el.id)) continue

        const left = el.left
        const top = el.top
        const width = el.width
        const height = el.height
        const right = left + width
        const bottom = top + height

        const topLine: AlignLine = { value: top, range: [left, right] }
        const bottomLine: AlignLine = { value: bottom, range: [left, right] }
        const leftLine: AlignLine = { value: left, range: [top, bottom] }
        const rightLine: AlignLine = { value: right, range: [top, bottom] }

        horizontalLines.push(topLine, bottomLine)
        verticalLines.push(leftLine, rightLine)
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
      
      horizontalLines = uniqAlignLines(horizontalLines)
      verticalLines = uniqAlignLines(verticalLines)
    }
    
    // 對齊吸附方法
    // 將收集到的對齊吸附線與計算的目標元素當前的位置大小相關資料做對比，差值小於設定的值時執行自動縮放校正
    // 水平和垂直兩個方向需要分開計算
    const alignedAdsorption = (currentX: number | null, currentY: number | null) => {
      const sorptionRange = 5

      const _alignmentLines: AlignmentLineProps[] = []
      let isVerticalAdsorbed = false
      let isHorizontalAdsorbed = false
      const correctionVal = { offsetX: 0, offsetY: 0 }
      
      if (currentY || currentY === 0) {
        for (let i = 0; i < horizontalLines.length; i++) {
          const { value, range } = horizontalLines[i]
          const min = Math.min(...range, currentX || 0)
          const max = Math.max(...range, currentX || 0)
          
          if (Math.abs(currentY - value) < sorptionRange && !isHorizontalAdsorbed) {
            correctionVal.offsetY = currentY - value
            isHorizontalAdsorbed = true
            _alignmentLines.push({ type: 'horizontal', axis: {x: min - 50, y: value}, length: max - min + 100 })
          }
        }
      }
      if (currentX || currentX === 0) {
        for (let i = 0; i < verticalLines.length; i++) {
          const { value, range } = verticalLines[i]
          const min = Math.min(...range, (currentY || 0))
          const max = Math.max(...range, (currentY || 0))

          if (Math.abs(currentX - value) < sorptionRange && !isVerticalAdsorbed) {
            correctionVal.offsetX = currentX - value
            isVerticalAdsorbed = true
            _alignmentLines.push({ type: 'vertical', axis: {x: value, y: min - 50}, length: max - min + 100 })
          }
        }
      }
      alignmentLines.value = _alignmentLines
      return correctionVal
    }

    const handleMousemove = (e: MouseEvent | TouchEvent) => {
      if (!isMouseDown) return

      const currentPageX = e instanceof MouseEvent ? e.pageX : e.changedTouches[0].pageX
      const currentPageY = e instanceof MouseEvent ? e.pageY : e.changedTouches[0].pageY

      const x = currentPageX - startPageX
      const y = currentPageY - startPageY

      let width = elOriginWidth
      let height = elOriginHeight
      let left = elOriginLeft
      let top = elOriginTop
      
      // 元素被旋轉的情況下，需要根據元素旋轉的角度，重新計算需要縮放的距離（滑鼠按下後移動的距離）
      if (elRotate) {
        let revisedX = (Math.cos(rotateRadian) * x + Math.sin(rotateRadian) * y) / canvasScale.value
        let revisedY = (Math.cos(rotateRadian) * y - Math.sin(rotateRadian) * x) / canvasScale.value

        // 鎖定寬高比例（僅四個角可能觸發，四條邊不會觸發）
        // 以水平方向上縮放的距離為基礎，計算垂直方向上的縮放距離，保持二者具有相同的縮放比例
        if (fixedRatio) {
          if (command === OperateResizeHandlers.RIGHT_BOTTOM || command === OperateResizeHandlers.LEFT_TOP) revisedY = revisedX / aspectRatio
          if (command === OperateResizeHandlers.LEFT_BOTTOM || command === OperateResizeHandlers.RIGHT_TOP) revisedY = -revisedX / aspectRatio
        }

        const updateRotatedElementSize = () => {
          width = elOriginWidth
          height = elOriginHeight
          left = elOriginLeft
          top = elOriginTop

          // 根據不同的操作點分別計算元素縮放後的大小和位置
          // 需要注意：
          // 此處計算的位置需要在後面重新進行校正，因為旋轉後再縮放事實上會改變元素基點的位置（雖然視覺上基點保持不動，但這是【旋轉】+【移動】共同作用的結果）
          // 但此處計算的大小不需要重新校正，因為前面已經重新計算需要縮放的距離，相當於大小已經經過了校正
          if (command === OperateResizeHandlers.RIGHT_BOTTOM) {
            width = getSizeWithinRange(elOriginWidth + revisedX, 'width')
            height = getSizeWithinRange(elOriginHeight + revisedY, 'height')
          }
          else if (command === OperateResizeHandlers.LEFT_BOTTOM) {
            width = getSizeWithinRange(elOriginWidth - revisedX, 'width')
            height = getSizeWithinRange(elOriginHeight + revisedY, 'height')
            left = elOriginLeft - (width - elOriginWidth)
          }
          else if (command === OperateResizeHandlers.LEFT_TOP) {
            width = getSizeWithinRange(elOriginWidth - revisedX, 'width')
            height = getSizeWithinRange(elOriginHeight - revisedY, 'height')
            left = elOriginLeft - (width - elOriginWidth)
            top = elOriginTop - (height - elOriginHeight)
          }
          else if (command === OperateResizeHandlers.RIGHT_TOP) {
            width = getSizeWithinRange(elOriginWidth + revisedX, 'width')
            height = getSizeWithinRange(elOriginHeight - revisedY, 'height')
            top = elOriginTop - (height - elOriginHeight)
          }
          else if (command === OperateResizeHandlers.TOP) {
            height = getSizeWithinRange(elOriginHeight - revisedY, 'height')
            top = elOriginTop - (height - elOriginHeight)
          }
          else if (command === OperateResizeHandlers.BOTTOM) {
            height = getSizeWithinRange(elOriginHeight + revisedY, 'height')
          }
          else if (command === OperateResizeHandlers.LEFT) {
            width = getSizeWithinRange(elOriginWidth - revisedX, 'width')
            left = elOriginLeft - (width - elOriginWidth)
          }
          else if (command === OperateResizeHandlers.RIGHT) {
            width = getSizeWithinRange(elOriginWidth + revisedX, 'width')
          }
        }

        const correctRotatedElementPosition = () => {
          // 獲取當前元素的基點座標，與初始狀態時的基點座標進行對比，並計算差值進行元素位置的校正
          const currentPoints = getRotateElementPoints({ width, height, left, top }, elRotate)
          const currentOppositePoint = getOppositePoint(command, currentPoints)
          const currentBaseLeft = currentOppositePoint.left
          const currentBaseTop = currentOppositePoint.top

          const offsetX = currentBaseLeft - baseLeft
          const offsetY = currentBaseTop - baseTop

          left = left - offsetX
          top = top - offsetY
        }

        updateRotatedElementSize()
        correctRotatedElementPosition()

        if (isCornerScaling) {
          const currentPoints = getRotateElementPoints({ width, height, left, top }, elRotate)
          const currentHandlerPoint = getResizeHandlerPoint(command, currentPoints)
          const { offsetX, offsetY } = alignedAdsorption(currentHandlerPoint.left, currentHandlerPoint.top)

          if (offsetX || offsetY) {
            const worldCorrectionX = -offsetX
            const worldCorrectionY = -offsetY

            if (fixedRatio) {
              const ratioDirection = command === OperateResizeHandlers.RIGHT_BOTTOM || command === OperateResizeHandlers.LEFT_TOP ? 1 : -1
              const vectorX = Math.cos(rotateRadian) - Math.sin(rotateRadian) * ratioDirection / aspectRatio
              const vectorY = Math.sin(rotateRadian) + Math.cos(rotateRadian) * ratioDirection / aspectRatio

              if (offsetY && vectorY) revisedX = revisedX + worldCorrectionY / vectorY
              else if (offsetX && vectorX) revisedX = revisedX + worldCorrectionX / vectorX
              revisedY = ratioDirection * revisedX / aspectRatio
            }
            else {
              const localCorrectionX = Math.cos(rotateRadian) * worldCorrectionX + Math.sin(rotateRadian) * worldCorrectionY
              const localCorrectionY = Math.cos(rotateRadian) * worldCorrectionY - Math.sin(rotateRadian) * worldCorrectionX

              revisedX = revisedX + localCorrectionX
              revisedY = revisedY + localCorrectionY
            }

            updateRotatedElementSize()
            correctRotatedElementPosition()
          }
        }
      }

      // 元素未被旋轉的情況下，正常計算新的位置大小即可，無需複雜的校正等工作
      // 額外需要處理對齊吸附相關的操作
      // 鎖定寬高比例相關的操作同上，不再贅述
      else {
        let moveX = x / canvasScale.value
        let moveY = y / canvasScale.value

        if (fixedRatio) {
          if (command === OperateResizeHandlers.RIGHT_BOTTOM || command === OperateResizeHandlers.LEFT_TOP) moveY = moveX / aspectRatio
          if (command === OperateResizeHandlers.LEFT_BOTTOM || command === OperateResizeHandlers.RIGHT_TOP) moveY = -moveX / aspectRatio
        }

        if (command === OperateResizeHandlers.RIGHT_BOTTOM) {
          const { offsetX, offsetY } = alignedAdsorption(elOriginLeft + elOriginWidth + moveX, elOriginTop + elOriginHeight + moveY)
          moveX = moveX - offsetX
          moveY = moveY - offsetY
          if (fixedRatio) {
            if (offsetY) moveX = moveY * aspectRatio
            else moveY = moveX / aspectRatio
          }
          width = getSizeWithinRange(elOriginWidth + moveX, 'width')
          height = getSizeWithinRange(elOriginHeight + moveY, 'height')
        }
        else if (command === OperateResizeHandlers.LEFT_BOTTOM) {
          const { offsetX, offsetY } = alignedAdsorption(elOriginLeft + moveX, elOriginTop + elOriginHeight + moveY)
          moveX = moveX - offsetX
          moveY = moveY - offsetY
          if (fixedRatio) {
            if (offsetY) moveX = -moveY * aspectRatio
            else moveY = -moveX / aspectRatio
          }
          width = getSizeWithinRange(elOriginWidth - moveX, 'width')
          height = getSizeWithinRange(elOriginHeight + moveY, 'height')
          left = elOriginLeft - (width - elOriginWidth)
        }
        else if (command === OperateResizeHandlers.LEFT_TOP) {
          const { offsetX, offsetY } = alignedAdsorption(elOriginLeft + moveX, elOriginTop + moveY)
          moveX = moveX - offsetX
          moveY = moveY - offsetY
          if (fixedRatio) {
            if (offsetY) moveX = moveY * aspectRatio
            else moveY = moveX / aspectRatio
          }
          width = getSizeWithinRange(elOriginWidth - moveX, 'width')
          height = getSizeWithinRange(elOriginHeight - moveY, 'height')
          left = elOriginLeft - (width - elOriginWidth)
          top = elOriginTop - (height - elOriginHeight)
        }
        else if (command === OperateResizeHandlers.RIGHT_TOP) {
          const { offsetX, offsetY } = alignedAdsorption(elOriginLeft + elOriginWidth + moveX, elOriginTop + moveY)
          moveX = moveX - offsetX
          moveY = moveY - offsetY
          if (fixedRatio) {
            if (offsetY) moveX = -moveY * aspectRatio
            else moveY = -moveX / aspectRatio
          }
          width = getSizeWithinRange(elOriginWidth + moveX, 'width')
          height = getSizeWithinRange(elOriginHeight - moveY, 'height')
          top = elOriginTop - (height - elOriginHeight)
        }
        else if (command === OperateResizeHandlers.LEFT) {
          const { offsetX } = alignedAdsorption(elOriginLeft + moveX, null)
          moveX = moveX - offsetX
          width = getSizeWithinRange(elOriginWidth - moveX, 'width')
          left = elOriginLeft - (width - elOriginWidth)
        }
        else if (command === OperateResizeHandlers.RIGHT) {
          const { offsetX } = alignedAdsorption(elOriginLeft + elOriginWidth + moveX, null)
          moveX = moveX - offsetX
          width = getSizeWithinRange(elOriginWidth + moveX, 'width')
        }
        else if (command === OperateResizeHandlers.TOP) {
          const { offsetY } = alignedAdsorption(null, elOriginTop + moveY)
          moveY = moveY - offsetY
          height = getSizeWithinRange(elOriginHeight - moveY, 'height')
          top = elOriginTop - (height - elOriginHeight)
        }
        else if (command === OperateResizeHandlers.BOTTOM) {
          const { offsetY } = alignedAdsorption(null, elOriginTop + elOriginHeight + moveY)
          moveY = moveY - offsetY
          height = getSizeWithinRange(elOriginHeight + moveY, 'height')
        }
      }
      
      elementList.value = elementList.value.map(el => {
        if (element.id !== el.id) return el
        if (el.type === 'shape' && 'pathFormula' in el && el.pathFormula) {
          const pathFormula = SHAPE_PATH_FORMULAS[el.pathFormula]

          let path = ''
          if ('editable' in pathFormula) path = pathFormula.formula(width, height, el.keypoints!)
          else path = pathFormula.formula(width, height)

          return {
            ...el, left, top, width, height,
            viewBox: [width, height],
            path,
          }
        }
        if (el.type === 'table') {
          let cellMinHeight = originTableCellMinHeight + (height - elOriginHeight) / el.data.length
          cellMinHeight = cellMinHeight < 36 ? 36 : cellMinHeight

          if (cellMinHeight === originTableCellMinHeight) return { ...el, left, width }
          return {
            ...el, left, top, width, height,
            cellMinHeight: cellMinHeight < 36 ? 36 : cellMinHeight,
          }
        }
        return { ...el, left, top, width, height }
      })
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
      mainStore.setScalingState(false)
      
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

  // 多選元素縮放
  const scaleMultiElement = (e: MouseEvent, range: MultiSelectRange, command: OperateResizeHandlers) => {
    let isMouseDown = true
    
    const { minX, maxX, minY, maxY } = range
    const operateWidth = maxX - minX
    const operateHeight = maxY - minY
    const aspectRatio = operateWidth / operateHeight

    const startPageX = e.pageX
    const startPageY = e.pageY

    const originElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList.value))

    document.onmousemove = e => {
      if (!isMouseDown) return
      
      const currentPageX = e.pageX
      const currentPageY = e.pageY

      const x = (currentPageX - startPageX) / canvasScale.value
      let y = (currentPageY - startPageY) / canvasScale.value

      // 鎖定寬高比例，邏輯同上
      if (ctrlOrShiftKeyActive.value) {
        if (command === OperateResizeHandlers.RIGHT_BOTTOM || command === OperateResizeHandlers.LEFT_TOP) y = x / aspectRatio
        if (command === OperateResizeHandlers.LEFT_BOTTOM || command === OperateResizeHandlers.RIGHT_TOP) y = -x / aspectRatio
      }

      // 所有選中元素的整體範圍
      let currentMinX = minX
      let currentMaxX = maxX
      let currentMinY = minY
      let currentMaxY = maxY

      if (command === OperateResizeHandlers.RIGHT_BOTTOM) {
        currentMaxX = maxX + x
        currentMaxY = maxY + y
      }
      else if (command === OperateResizeHandlers.LEFT_BOTTOM) {
        currentMinX = minX + x
        currentMaxY = maxY + y
      }
      else if (command === OperateResizeHandlers.LEFT_TOP) {
        currentMinX = minX + x
        currentMinY = minY + y
      }
      else if (command === OperateResizeHandlers.RIGHT_TOP) {
        currentMaxX = maxX + x
        currentMinY = minY + y
      }
      else if (command === OperateResizeHandlers.TOP) {
        currentMinY = minY + y
      }
      else if (command === OperateResizeHandlers.BOTTOM) {
        currentMaxY = maxY + y
      }
      else if (command === OperateResizeHandlers.LEFT) {
        currentMinX = minX + x
      }
      else if (command === OperateResizeHandlers.RIGHT) {
        currentMaxX = maxX + x
      }

      // 所有選中元素的整體寬高
      const currentOppositeWidth = currentMaxX - currentMinX
      const currentOppositeHeight = currentMaxY - currentMinY

      // 當前正在操作元素寬高佔所有選中元素的整體寬高的比例
      let widthScale = currentOppositeWidth / operateWidth
      let heightScale = currentOppositeHeight / operateHeight

      if (widthScale <= 0) widthScale = 0
      if (heightScale <= 0) heightScale = 0
      
      // 根據前面計算的比例，計算並修改所有選中元素的位置大小
      elementList.value = elementList.value.map(el => {
        if ((el.type === 'image' || el.type === 'shape') && activeElementIdList.value.includes(el.id)) {
          const originElement = originElementList.find(originEl => originEl.id === el.id) as PPTImageElement | PPTShapeElement
          return {
            ...el,
            width: originElement.width * widthScale,
            height: originElement.height * heightScale,
            left: currentMinX + (originElement.left - minX) * widthScale,
            top: currentMinY + (originElement.top - minY) * heightScale,
          }
        }
        return el
      })
    }

    document.onmouseup = e => {
      isMouseDown = false
      document.onmousemove = null
      document.onmouseup = null

      if (startPageX === e.pageX && startPageY === e.pageY) return

      slidesStore.updateSlide({ elements: elementList.value })
      addHistorySnapshot()
    }
  }

  return {
    scaleElement,
    scaleMultiElement,
  }
}
