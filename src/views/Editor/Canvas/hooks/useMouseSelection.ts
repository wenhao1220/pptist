import { type Ref, type ShallowRef, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useKeyboardStore, useMainStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import { getElementRange } from '@/utils/element'

export default (elementList: Ref<PPTElement[]>, viewportRef: ShallowRef<HTMLElement | null>) => {
  const mainStore = useMainStore()
  const { canvasScale, hiddenElementIdList } = storeToRefs(mainStore)
  const { ctrlOrShiftKeyActive } = storeToRefs(useKeyboardStore())

  const mouseSelectionVisible = ref(false)
  const mouseSelectionQuadrant = ref(1)
  const mouseSelection = ref({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  })

  // 更新滑鼠框選範圍
  const updateMouseSelection = (e: MouseEvent) => {
    if (!viewportRef.value) return

    let isMouseDown = true
    const viewportRect = viewportRef.value.getBoundingClientRect()

    const minSelectionRange = 5
    
    const startPageX = e.pageX
    const startPageY = e.pageY

    const left = (startPageX - viewportRect.x) / canvasScale.value
    const top = (startPageY - viewportRect.y) / canvasScale.value

    // 確定框選的起始位置和其他預設值初始化
    mouseSelection.value = {
      top: top,
      left: left,
      width: 0,
      height: 0,
    }
    mouseSelectionVisible.value = false
    mouseSelectionQuadrant.value = 4

    document.onmousemove = e => {
      if (!isMouseDown) return

      const currentPageX = e.pageX
      const currentPageY = e.pageY

      const offsetWidth = (currentPageX - startPageX) / canvasScale.value
      const offsetHeight = (currentPageY - startPageY) / canvasScale.value

      const width = Math.abs(offsetWidth)
      const height = Math.abs(offsetHeight)

      if ( width < minSelectionRange || height < minSelectionRange ) return
      
      // 計算滑鼠框選（移動）的方向
      // 按四個象限的位置區分，如右下角為第四象限
      let quadrant = 0
      if ( offsetWidth > 0 && offsetHeight > 0 ) quadrant = 4
      else if ( offsetWidth < 0 && offsetHeight < 0 ) quadrant = 2
      else if ( offsetWidth > 0 && offsetHeight < 0 ) quadrant = 1
      else if ( offsetWidth < 0 && offsetHeight > 0 ) quadrant = 3

      // 更新框選範圍
      mouseSelection.value = {
        ...mouseSelection.value,
        width: width,
        height: height,
      }
      mouseSelectionVisible.value = true
      mouseSelectionQuadrant.value = quadrant
    }

    document.onmouseup = () => {
      document.onmousemove = null
      document.onmouseup = null
      isMouseDown = false

      // 計算畫布中的元素是否處在滑鼠選擇範圍中，處在範圍中的元素設定為被選中狀態
      let inRangeElementList: PPTElement[] = []
      for (let i = 0; i < elementList.value.length; i++) {
        const element = elementList.value[i]
        const mouseSelectionLeft = mouseSelection.value.left
        const mouseSelectionTop = mouseSelection.value.top
        const mouseSelectionWidth = mouseSelection.value.width
        const mouseSelectionHeight = mouseSelection.value.height

        const { minX, maxX, minY, maxY } = getElementRange(element)

        // 計算元素是否處在框選範圍內時，四個框選方向的計算方式有差異
        let isInclude = false
        if (ctrlOrShiftKeyActive.value) {
          if (mouseSelectionQuadrant.value === 4) {
            isInclude = maxX > mouseSelectionLeft && 
                        minX < mouseSelectionLeft + mouseSelectionWidth && 
                        maxY > mouseSelectionTop && 
                        minY < mouseSelectionTop + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 2) {
            isInclude = maxX > (mouseSelectionLeft - mouseSelectionWidth) && 
                        minX < (mouseSelectionLeft - mouseSelectionWidth) + mouseSelectionWidth && 
                        maxY > (mouseSelectionTop - mouseSelectionHeight) && 
                        minY < (mouseSelectionTop - mouseSelectionHeight) + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 1) {
            isInclude = maxX > mouseSelectionLeft && 
                        minX < mouseSelectionLeft + mouseSelectionWidth && 
                        maxY > (mouseSelectionTop - mouseSelectionHeight) && 
                        minY < (mouseSelectionTop - mouseSelectionHeight) + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 3) {
            isInclude = maxX > (mouseSelectionLeft - mouseSelectionWidth) && 
                        minX < (mouseSelectionLeft - mouseSelectionWidth) + mouseSelectionWidth && 
                        maxY > mouseSelectionTop && 
                        minY < mouseSelectionTop + mouseSelectionHeight
          }
        }
        else {
          if (mouseSelectionQuadrant.value === 4) {
            isInclude = minX > mouseSelectionLeft && 
                        maxX < mouseSelectionLeft + mouseSelectionWidth && 
                        minY > mouseSelectionTop && 
                        maxY < mouseSelectionTop + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 2) {
            isInclude = minX > (mouseSelectionLeft - mouseSelectionWidth) && 
                        maxX < (mouseSelectionLeft - mouseSelectionWidth) + mouseSelectionWidth && 
                        minY > (mouseSelectionTop - mouseSelectionHeight) && 
                        maxY < (mouseSelectionTop - mouseSelectionHeight) + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 1) {
            isInclude = minX > mouseSelectionLeft && 
                        maxX < mouseSelectionLeft + mouseSelectionWidth && 
                        minY > (mouseSelectionTop - mouseSelectionHeight) && 
                        maxY < (mouseSelectionTop - mouseSelectionHeight) + mouseSelectionHeight
          }
          else if (mouseSelectionQuadrant.value === 3) {
            isInclude = minX > (mouseSelectionLeft - mouseSelectionWidth) && 
                        maxX < (mouseSelectionLeft - mouseSelectionWidth) + mouseSelectionWidth && 
                        minY > mouseSelectionTop && 
                        maxY < mouseSelectionTop + mouseSelectionHeight
          }
        }

        // 被鎖定或被隱藏的元素即使在範圍內，也不需要設定為選中狀態
        if (isInclude && !element.lock && !hiddenElementIdList.value.includes(element.id)) inRangeElementList.push(element)
      }

      // 如果範圍內有組合元素的成員，需要該組全部成員都處在範圍內，才會被設定為選中狀態
      inRangeElementList = inRangeElementList.filter(inRangeElement => {
        if (inRangeElement.groupId) {
          const inRangeElementIdList = inRangeElementList.map(inRangeElement => inRangeElement.id)
          const groupElementList = elementList.value.filter(element => element.groupId === inRangeElement.groupId)
          return groupElementList.every(groupElement => inRangeElementIdList.includes(groupElement.id))
        }
        return true
      })
      const inRangeElementIdList = inRangeElementList.map(inRangeElement => inRangeElement.id)
      mainStore.setActiveElementIdList(inRangeElementIdList)

      mouseSelectionVisible.value = false
    }
  }

  return {
    mouseSelection,
    mouseSelectionVisible,
    mouseSelectionQuadrant,
    updateMouseSelection,
  }
}