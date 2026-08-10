import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList } = storeToRefs(mainStore)
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  // 鎖定選中的元素,並清空選中元素狀態
  const lockElement = () => {
    const newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))
  
    for (const element of newElementList) {
      if (activeElementIdList.value.includes(element.id)) element.lock = true
    }
    slidesStore.updateSlide({ elements: newElementList })
    mainStore.setActiveElementIdList([])
    addHistorySnapshot()
  }

  /**
   * 解除元素的鎖定狀態,並將其設定為當前選擇元素
   * @param handleElement 需要解鎖的元素
   */
  const unlockElement = (handleElement: PPTElement) => {
    const newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))

    if (handleElement.groupId) {
      const groupElementIdList = []
      for (const element of newElementList) {
        if (element.groupId === handleElement.groupId) {
          element.lock = false
          groupElementIdList.push(element.id)
        }
      }
      slidesStore.updateSlide({ elements: newElementList })
      mainStore.setActiveElementIdList(groupElementIdList)
    }
    else {
      for (const element of newElementList) {
        if (element.id === handleElement.id) {
          element.lock = false
          break
        }
      }
      slidesStore.updateSlide({ elements: newElementList })
      mainStore.setActiveElementIdList([handleElement.id])
    }
    addHistorySnapshot()
  }

  return {
    lockElement,
    unlockElement,
  }
}