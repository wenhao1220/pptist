import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import { ElementOrderCommands } from '@/types/edit'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

export default () => {
  const slidesStore = useSlidesStore()
  const { currentSlide } = storeToRefs(slidesStore)

  const { addHistorySnapshot } = useHistorySnapshot()

  /**
   * 獲取組合元素階層範圍
   * @param elementList 本頁所有元素列表
   * @param combineElementList 組合元素列表
   */
  const getCombineElementLevelRange = (elementList: PPTElement[], combineElementList: PPTElement[]) => {
    return {
      minLevel: elementList.findIndex(_element => _element.id === combineElementList[0].id),
      maxLevel: elementList.findIndex(_element => _element.id === combineElementList[combineElementList.length - 1].id),
    }
  }

  /**
   * 上移一層
   * @param elementList 本頁所有元素列表
   * @param element 當前操作的元素
   */
  const moveUpElement = (elementList: PPTElement[], element: PPTElement) => {
    const copyOfElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList))

    // 如果被操作的元素是組合元素成員，需要將該組合全部成員一起進行移動
    if (element.groupId) {

      // 獲取到該組合全部成員，以及所有成員的階層範圍
      const combineElementList = copyOfElementList.filter(_element => _element.groupId === element.groupId)
      const { minLevel, maxLevel } = getCombineElementLevelRange(elementList, combineElementList)

      // 已經處在頂層，無法繼續移動
      if (maxLevel === elementList.length - 1) return

      // 通過組合成員範圍的最大值，獲取到該組合上一層的元素，然後將該組合元素從元素列表中移除（並快取被移除的元素列表）
      // 若上層元素處在另一個組合中，則將上述被移除的組合元素插入到該上層組合上方
      // 若上層元素不處於任何分組中，則將上述被移除的組合元素插入到該上層元素上方
      const nextElement = copyOfElementList[maxLevel + 1]
      const movedElementList = copyOfElementList.splice(minLevel, combineElementList.length)

      if (nextElement.groupId) {
        const nextCombineElementList = copyOfElementList.filter(_element => _element.groupId === nextElement.groupId)
        copyOfElementList.splice(minLevel + nextCombineElementList.length, 0, ...movedElementList)
      }
      else copyOfElementList.splice(minLevel + 1, 0, ...movedElementList)
    }

    // 如果被操作的元素不是組合元素成員
    else {

      // 獲取該元素在列表中的階層
      const level = elementList.findIndex(item => item.id === element.id)

      // 已經處在頂層，無法繼續移動
      if (level === elementList.length - 1) return

      // 獲取到該組合上一層的元素，然後將該組合元素從元素列表中移除（並快取被移除的元素列表）
      const nextElement = copyOfElementList[level + 1]
      const movedElement = copyOfElementList.splice(level, 1)[0]

      // 通過組合成員範圍的最大值，獲取到該組合上一層的元素，然後將該組合元素從元素列表中移除（並快取被移除的元素列表）
      // 若上層元素處在另一個組合中，則將上述被移除的組合元素插入到該上層組合上方
      // 若上層元素不處於任何分組中，則將上述被移除的組合元素插入到該上層元素上方
      if (nextElement.groupId) {
        const combineElementList = copyOfElementList.filter(_element => _element.groupId === nextElement.groupId)
        copyOfElementList.splice(level + combineElementList.length, 0, movedElement)
      }
      else copyOfElementList.splice(level + 1, 0, movedElement)
    }

    return copyOfElementList
  }

  /**
   * 下移一層，操作方式同上移
   * @param elementList 本頁所有元素列表
   * @param element 當前操作的元素
   */
  const moveDownElement = (elementList: PPTElement[], element: PPTElement) => {
    const copyOfElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList))

    if (element.groupId) {
      const combineElementList = copyOfElementList.filter(_element => _element.groupId === element.groupId)
      const { minLevel } = getCombineElementLevelRange(elementList, combineElementList)
      if (minLevel === 0) return

      const prevElement = copyOfElementList[minLevel - 1]
      const movedElementList = copyOfElementList.splice(minLevel, combineElementList.length)

      if (prevElement.groupId) {
        const prevCombineElementList = copyOfElementList.filter(_element => _element.groupId === prevElement.groupId)
        copyOfElementList.splice(minLevel - prevCombineElementList.length, 0, ...movedElementList)
      }
      else copyOfElementList.splice(minLevel - 1, 0, ...movedElementList)
    }

    else {
      const level = elementList.findIndex(item => item.id === element.id)
      if (level === 0) return

      const prevElement = copyOfElementList[level - 1]
      const movedElement = copyOfElementList.splice(level, 1)[0]

      if (prevElement.groupId) {
        const combineElementList = copyOfElementList.filter(_element => _element.groupId === prevElement.groupId)
        copyOfElementList.splice(level - combineElementList.length, 0, movedElement)
      }
      else copyOfElementList.splice(level - 1, 0, movedElement)
    }

    return copyOfElementList
  }

  /**
   * 置頂層
   * @param elementList 本頁所有元素列表
   * @param element 當前操作的元素
   */
  const moveTopElement = (elementList: PPTElement[], element: PPTElement) => {
    const copyOfElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList))

    // 如果被操作的元素是組合元素成員，需要將該組合全部成員一起進行移動
    if (element.groupId) {

      // 獲取到該組合全部成員，以及所有成員的階層範圍
      const combineElementList = copyOfElementList.filter(_element => _element.groupId === element.groupId)
      const { minLevel, maxLevel } = getCombineElementLevelRange(elementList, combineElementList)

      // 已經處在頂層，無法繼續移動
      if (maxLevel === elementList.length - 1) return null

      // 將該組合元素從元素列表中移除，然後將被移除的元素新增到元素列表頂部
      const movedElementList = copyOfElementList.splice(minLevel, combineElementList.length)
      copyOfElementList.push(...movedElementList)
    }

    // 如果被操作的元素不是組合元素成員
    else {

      // 獲取該元素在列表中的階層
      const level = elementList.findIndex(item => item.id === element.id)

      // 已經處在頂層，無法繼續移動
      if (level === elementList.length - 1) return null

      // 將該組合元素從元素列表中移除，然後將被移除的元素新增到元素列表底部
      copyOfElementList.splice(level, 1)
      copyOfElementList.push(element)
    }

    return copyOfElementList
  }

  /**
   * 置底層，操作方式同置頂
   * @param elementList 本頁所有元素列表
   * @param element 當前操作的元素
   */
  const moveBottomElement = (elementList: PPTElement[], element: PPTElement) => {
    const copyOfElementList: PPTElement[] = JSON.parse(JSON.stringify(elementList))

    if (element.groupId) {
      const combineElementList = copyOfElementList.filter(_element => _element.groupId === element.groupId)
      const { minLevel } = getCombineElementLevelRange(elementList, combineElementList)
      if (minLevel === 0) return

      const movedElementList = copyOfElementList.splice(minLevel, combineElementList.length)
      copyOfElementList.unshift(...movedElementList)
    }

    else {
      const level = elementList.findIndex(item => item.id === element.id)
      if (level === 0) return

      copyOfElementList.splice(level, 1)
      copyOfElementList.unshift(element)
    }

    return copyOfElementList
  }

  /**
   * 調整元素階層
   * @param element 需要調整階層的元素
   * @param command 調整命令：上移、下移、置頂、置底
   */
  const orderElement = (element: PPTElement, command: ElementOrderCommands) => {
    let newElementList
    
    if (command === ElementOrderCommands.UP) newElementList = moveUpElement(currentSlide.value.elements, element)
    else if (command === ElementOrderCommands.DOWN) newElementList = moveDownElement(currentSlide.value.elements, element)
    else if (command === ElementOrderCommands.TOP) newElementList = moveTopElement(currentSlide.value.elements, element)
    else if (command === ElementOrderCommands.BOTTOM) newElementList = moveBottomElement(currentSlide.value.elements, element)

    if (!newElementList) return

    slidesStore.updateSlide({ elements: newElementList })
    addHistorySnapshot()
  }

  return {
    orderElement,
  }
}