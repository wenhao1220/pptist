import type { Ref } from 'vue'
import { uniq } from 'lodash'
import { storeToRefs } from 'pinia'
import { useMainStore, useKeyboardStore } from '@/store'
import type { PPTElement } from '@/types/slides'

export default (
  elementList: Ref<PPTElement[]>,
  moveElement: (e: MouseEvent | TouchEvent, element: PPTElement) => void,
) => {
  const mainStore = useMainStore()
  const { activeElementIdList, activeGroupElementId, handleElementId, editorAreaFocus } = storeToRefs(mainStore)
  const { ctrlKeyState, ctrlOrShiftKeyActive } = storeToRefs(useKeyboardStore())

  // 選中元素
  // startMove 表示是否需要再選中操作後進入到開始移動的狀態
  const selectElement = (e: MouseEvent | TouchEvent, element: PPTElement, startMove = true) => {
    if (!editorAreaFocus.value) mainStore.setEditorareaFocus(true)

    // 如果目標元素當前未被選中，則將他設為選中狀態
    // 此時如果按下Ctrl鍵或Shift鍵，則進入多選狀態，將當前已選中的元素和目標元素一起設定為選中狀態，否則僅將目標元素設定為選中狀態
    // 如果目標元素是分組成員，需要將該組合的其他元素一起設定為選中狀態
    if (!activeElementIdList.value.includes(element.id)) {
      let newActiveIdList: string[] = []

      if (ctrlOrShiftKeyActive.value) {
        newActiveIdList = [...activeElementIdList.value, element.id]
      }
      else newActiveIdList = [element.id]
      
      if (element.groupId) {
        const groupMembersId: string[] = []
        elementList.value.forEach((el: PPTElement) => {
          if (el.groupId === element.groupId) groupMembersId.push(el.id)
        })
        newActiveIdList = [...newActiveIdList, ...groupMembersId]
      }

      mainStore.setActiveElementIdList(uniq(newActiveIdList))
      mainStore.setHandleElementId(element.id)
    }

    // 已選中元素上按下 Ctrl 且允許拖拽時，先不立刻取消選中
    // 因為 Ctrl+點選 和 Ctrl+拖拽複製 共用同一 mousedown
    // 所以需要先記錄按下位置，等 mouseup 時再判斷這次操作到底是”點選”還是”拖拽”
    // 點選時在 mouseup 再取消選中，拖拽時交給拖拽邏輯處理
    else if (ctrlKeyState.value && startMove) {
      const startPageX = e instanceof MouseEvent ? e.pageX : e.changedTouches[0].pageX
      const startPageY = e instanceof MouseEvent ? e.pageY : e.changedTouches[0].pageY
      const target = e.target as HTMLElement

      target.onmouseup = (e: MouseEvent) => {
        const currentPageX = e.pageX
        const currentPageY = e.pageY

        if (startPageX === currentPageX && startPageY === currentPageY) {
          let newActiveIdList: string[] = []

          if (element.groupId) {
            const groupMembersId: string[] = []
            elementList.value.forEach((el: PPTElement) => {
              if (el.groupId === element.groupId) groupMembersId.push(el.id)
            })
            newActiveIdList = activeElementIdList.value.filter(id => !groupMembersId.includes(id))
          }
          else {
            newActiveIdList = activeElementIdList.value.filter(id => id !== element.id)
          }

          if (newActiveIdList.length > 0) {
            mainStore.setActiveElementIdList(newActiveIdList)
          }
        }
        target.onmouseup = null
      }
    }

    // 如果目標元素已被選中，且按下了Ctrl鍵或Shift鍵，則取消其被選中狀態
    // 除非目標元素是最後的一個被選中元素，或者目標元素所在的組合是最後一組選中組合
    // 如果目標元素是分組成員，需要將該組合的其他元素一起取消選中狀態
    else if (ctrlOrShiftKeyActive.value) {
      let newActiveIdList: string[] = []

      if (element.groupId) {
        const groupMembersId: string[] = []
        elementList.value.forEach((el: PPTElement) => {
          if (el.groupId === element.groupId) groupMembersId.push(el.id)
        })
        newActiveIdList = activeElementIdList.value.filter(id => !groupMembersId.includes(id))
      }
      else {
        newActiveIdList = activeElementIdList.value.filter(id => id !== element.id)
      }

      if (newActiveIdList.length > 0) {
        mainStore.setActiveElementIdList(newActiveIdList)
      }
    }

    // 如果目標元素已被選中，同時目標元素不是當前操作元素，則將其設定為當前操作元素
    else if (handleElementId.value !== element.id) {
      mainStore.setHandleElementId(element.id)
    }

    // 如果目標元素已被選中，同時也是當前操作元素，那麼當目標元素在該狀態下再次被點選時，將被設定為多選元素中的啟用成員
    else if (activeGroupElementId.value !== element.id) {
      const startPageX = e instanceof MouseEvent ? e.pageX : e.changedTouches[0].pageX
      const startPageY = e instanceof MouseEvent ? e.pageY : e.changedTouches[0].pageY

      ;(e.target as HTMLElement).onmouseup = (e: MouseEvent) => {
        const currentPageX = e.pageX
        const currentPageY = e.pageY

        if (startPageX === currentPageX && startPageY === currentPageY) {
          mainStore.setActiveGroupElementId(element.id)
          ;(e.target as HTMLElement).onmouseup = null
        }
      }
    }

    if (startMove) moveElement(e, element)
  }

  return {
    selectElement,
  }
}
