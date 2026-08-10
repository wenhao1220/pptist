import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeGroupElementId } = storeToRefs(mainStore)
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  // 刪除全部選中元素
  // 組合元素成員中，存在被選中可獨立操作的元素時，優先刪除該元素。否則預設刪除所有被選中的元素
  const deleteElement = () => {
    if (!activeElementIdList.value.length) return

    let newElementList: PPTElement[] = []
    if (activeGroupElementId.value) {
      newElementList = currentSlide.value.elements.filter(el => el.id !== activeGroupElementId.value)
    }
    else {
      newElementList = currentSlide.value.elements.filter(el => !activeElementIdList.value.includes(el.id))
    }

    mainStore.setActiveElementIdList([])
    slidesStore.updateSlide({ elements: newElementList })
    addHistorySnapshot()
  }

  // 刪除內面內全部元素(無論是否選中)
  const deleteAllElements = () => {
    if (!currentSlide.value.elements.length) return
    mainStore.setActiveElementIdList([])
    slidesStore.updateSlide({ elements: [] })
    addHistorySnapshot()
  }

  return {
    deleteElement,
    deleteAllElements,
  }
}