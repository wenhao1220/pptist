import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useMainStore, useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { activeElementIdList, activeElementList, handleElementId } = storeToRefs(mainStore)
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  /**
   * 判斷當前選中的元素是否可以組合
   */
  const canCombine = computed(() => {
    if (activeElementList.value.length < 2) return false

    const firstGroupId = activeElementList.value[0].groupId
    if (!firstGroupId) return true

    const inSameGroup = activeElementList.value.every(el => (el.groupId && el.groupId) === firstGroupId)
    return !inSameGroup
  })

  /**
   * 組合當前選中的元素：給當前選中的元素賦予一個相同的分組ID
   */
  const combineElements = () => {
    if (!activeElementList.value.length) return

    // 生成一個新元素列表進行後續操作
    let newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))

    // 生成分組ID
    const groupId = nanoid(10)

    // 收集需要組合的元素列表，並賦上唯一分組ID
    const combineElementList: PPTElement[] = []
    for (const element of newElementList) {
      if (activeElementIdList.value.includes(element.id)) {
        element.groupId = groupId
        combineElementList.push(element)
      }
    }

    // 確保該組合內所有元素成員的階層是連續的，具體操作方法為：
    // 先獲取到該組合內最上層元素的階層，將本次需要組合的元素從新元素列表中移除，
    // 再根據最上層元素的階層位置，將上面收集到的需要組合的元素列表一起插入到新元素列表中合適的位置
    const combineElementMaxLevel = newElementList.findIndex(_element => _element.id === combineElementList[combineElementList.length - 1].id)
    const combineElementIdList = combineElementList.map(_element => _element.id)
    newElementList = newElementList.filter(_element => !combineElementIdList.includes(_element.id))

    const insertLevel = combineElementMaxLevel - combineElementList.length + 1
    newElementList.splice(insertLevel, 0, ...combineElementList)

    slidesStore.updateSlide({ elements: newElementList })
    addHistorySnapshot()
  }

  /**
   * 取消組合元素：移除選中元素的分組ID
   */
  const uncombineElements = () => {
    if (!activeElementList.value.length) return
    const hasElementInGroup = activeElementList.value.some(item => item.groupId)
    if (!hasElementInGroup) return
    
    const newElementList: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))
    for (const element of newElementList) {
      if (activeElementIdList.value.includes(element.id) && element.groupId) delete element.groupId
    }
    slidesStore.updateSlide({ elements: newElementList })

    // 取消組合後，需要重置啟用元素狀態
    // 預設重置為當前正在操作的元素,如果不存在則重置為空
    const handleElementIdList = handleElementId.value ? [handleElementId.value] : []
    mainStore.setActiveElementIdList(handleElementIdList)

    addHistorySnapshot()
  }

  return {
    canCombine,
    combineElements,
    uncombineElements,
  }
}