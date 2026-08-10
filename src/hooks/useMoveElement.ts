import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import { KEYS } from '@/configs/hotkey'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default () => {
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeGroupElementId } = storeToRefs(useMainStore())
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  /**
   * 將元素向指定方向移動指定的距離
   * 組合元素成員中，存在被選中可獨立操作的元素時，優先移動該元素。否則預設移動所有被選中的元素
   * @param command 移動方向
   * @param step 移動距離
   */
  const moveElement = (command: string, step = 1) => {
    let newElementList: PPTElement[] = []

    const move = (el: PPTElement) => {
      let { left, top } = el
      switch (command) {
        case KEYS.LEFT: 
          left = left - step
          break
        case KEYS.RIGHT: 
          left = left + step
          break
        case KEYS.UP: 
          top = top - step
          break
        case KEYS.DOWN: 
          top = top + step
          break
        default: break
      }
      return { ...el, left, top }
    }

    if (activeGroupElementId.value) {
      newElementList = currentSlide.value.elements.map(el => {
        return activeGroupElementId.value === el.id ? move(el) : el
      })
    }
    else {
      newElementList = currentSlide.value.elements.map(el => {
        return activeElementIdList.value.includes(el.id) ? move(el) : el
      })
    }

    slidesStore.updateSlide({ elements: newElementList })
    addHistorySnapshot()
  }

  return {
    moveElement,
  }
}