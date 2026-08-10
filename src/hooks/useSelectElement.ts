import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'

export default () => {
  const mainStore = useMainStore()
  const { currentSlide } = storeToRefs(useSlidesStore())
  const { hiddenElementIdList, handleElementId } = storeToRefs(mainStore)

  // 將當前頁面全部元素設定為被選擇狀態
  const selectAllElements = () => {
    const unlockedElements = currentSlide.value.elements.filter(el => !el.lock && !hiddenElementIdList.value.includes(el.id))
    const newActiveElementIdList = unlockedElements.map(el => el.id)
    mainStore.setActiveElementIdList(newActiveElementIdList)
  }
  
  // 將指定元素設定為被選擇狀態
  const selectElement = (id: string) => {
    if (handleElementId.value === id) return
    if (hiddenElementIdList.value.includes(id)) return
    
    const lockedElements = currentSlide.value.elements.filter(el => el.lock)
    if (lockedElements.some(el => el.id === id)) return
  
    mainStore.setActiveElementIdList([id])
  }

  return {
    selectAllElements,
    selectElement,
  }
}