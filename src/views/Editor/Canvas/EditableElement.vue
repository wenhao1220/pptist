<template>
  <div 
    class="editable-element"
    ref="elementRef"
    :id="`editable-element-${elementInfo.id}`"
    :style="{
      zIndex: elementIndex,
    }"
  >
    <component
      :is="currentElementComponent"
      :elementInfo="elementInfo"
      :selectElement="selectElement"
      :contextmenus="contextmenus"
    ></component>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ElementTypes, type PPTElement } from '@/types/slides'
import type { ContextmenuItem } from '@/components/Contextmenu/types'

import useLockElement from '@/hooks/useLockElement'
import useDeleteElement from '@/hooks/useDeleteElement'
import useCombineElement from '@/hooks/useCombineElement'
import useOrderElement from '@/hooks/useOrderElement'
import useAlignElementToCanvas from '@/hooks/useAlignElementToCanvas'
import useCopyAndPasteElement from '@/hooks/useCopyAndPasteElement'
import useSelectElement from '@/hooks/useSelectElement'
import { useMainStore } from '@/store'

import { ElementOrderCommands, ElementAlignCommands } from '@/types/edit'

import ImageElement from '@/views/components/element/ImageElement/index.vue'
import TextElement from '@/views/components/element/TextElement/index.vue'
import ShapeElement from '@/views/components/element/ShapeElement/index.vue'
import LineElement from '@/views/components/element/LineElement/index.vue'
import ChartElement from '@/views/components/element/ChartElement/index.vue'
import TableElement from '@/views/components/element/TableElement/index.vue'
import LatexElement from '@/views/components/element/LatexElement/index.vue'
import VideoElement from '@/views/components/element/VideoElement/index.vue'
import AudioElement from '@/views/components/element/AudioElement/index.vue'

const props = defineProps<{
  elementInfo: PPTElement
  elementIndex: number
  isMultiSelect: boolean
  selectElement: (e: MouseEvent | TouchEvent, element: PPTElement, canMove?: boolean) => void
  openLinkDialog: () => void
}>()

const currentElementComponent = computed<unknown>(() => {
  const elementTypeMap = {
    [ElementTypes.IMAGE]: ImageElement,
    [ElementTypes.TEXT]: TextElement,
    [ElementTypes.SHAPE]: ShapeElement,
    [ElementTypes.LINE]: LineElement,
    [ElementTypes.CHART]: ChartElement,
    [ElementTypes.TABLE]: TableElement,
    [ElementTypes.LATEX]: LatexElement,
    [ElementTypes.VIDEO]: VideoElement,
    [ElementTypes.AUDIO]: AudioElement,
  }
  return elementTypeMap[props.elementInfo.type] || null
})

const { orderElement } = useOrderElement()
const { alignElementToCanvas } = useAlignElementToCanvas()
const { combineElements, uncombineElements } = useCombineElement()
const { deleteElement } = useDeleteElement()
const { lockElement, unlockElement } = useLockElement()
const { copyElement, pasteElement, cutElement } = useCopyAndPasteElement()
const { selectAllElements } = useSelectElement()
const mainStore = useMainStore()

const requestAIElementEdit = () => {
  const instruction = window.prompt('請說明要如何修正這個元件：')
  if (!instruction?.trim()) return

  mainStore.setActiveElementIdList([props.elementInfo.id])
  mainStore.setAIElementEditRequest({
    elementId: props.elementInfo.id,
    instruction: instruction.trim(),
  })
  mainStore.setAICopilotPanelState(true)
}

const contextmenus = (): ContextmenuItem[] => {
  if (props.elementInfo.lock) {
    return [{
      text: '解鎖', 
      handler: () => unlockElement(props.elementInfo),
    }]
  }

  return [
    {
      text: 'AI 修正',
      handler: requestAIElementEdit,
    },
    { divider: true },
    {
      text: '剪下',
      subText: 'Ctrl + X',
      handler: cutElement,
    },
    {
      text: '複製',
      subText: 'Ctrl + C',
      handler: copyElement,
    },
    {
      text: '貼上',
      subText: 'Ctrl + V',
      handler: pasteElement,
    },
    { divider: true },
    {
      text: '水平居中',
      handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL),
      children: [
        { text: '水平垂直居中', handler: () => alignElementToCanvas(ElementAlignCommands.CENTER), },
        { text: '水平居中', handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL) },
        { text: '左對齊', handler: () => alignElementToCanvas(ElementAlignCommands.LEFT) },
        { text: '右對齊', handler: () => alignElementToCanvas(ElementAlignCommands.RIGHT) },
      ],
    },
    {
      text: '垂直居中',
      handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL),
      children: [
        { text: '水平垂直居中', handler: () => alignElementToCanvas(ElementAlignCommands.CENTER) },
        { text: '垂直居中', handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL) },
        { text: '頂部對齊', handler: () => alignElementToCanvas(ElementAlignCommands.TOP) },
        { text: '底部對齊', handler: () => alignElementToCanvas(ElementAlignCommands.BOTTOM) },
      ],
    },
    { divider: true },
    {
      text: '置於頂層',
      disable: props.isMultiSelect && !props.elementInfo.groupId,
      handler: () => orderElement(props.elementInfo, ElementOrderCommands.TOP),
      children: [
        { text: '置於頂層', handler: () => orderElement(props.elementInfo, ElementOrderCommands.TOP) },
        { text: '上移一層', handler: () => orderElement(props.elementInfo, ElementOrderCommands.UP) },
      ],
    },
    {
      text: '置於底層',
      disable: props.isMultiSelect && !props.elementInfo.groupId,
      handler: () => orderElement(props.elementInfo, ElementOrderCommands.BOTTOM),
      children: [
        { text: '置於底層', handler: () => orderElement(props.elementInfo, ElementOrderCommands.BOTTOM) },
        { text: '下移一層', handler: () => orderElement(props.elementInfo, ElementOrderCommands.DOWN) },
      ],
    },
    { divider: true },
    {
      text: '設定連結',
      handler: props.openLinkDialog,
    },
    {
      text: props.elementInfo.groupId ? '取消組合' : '組合',
      subText: 'Ctrl + G',
      handler: props.elementInfo.groupId ? uncombineElements : combineElements,
      hide: !props.isMultiSelect,
    },
    {
      text: '全選',
      subText: 'Ctrl + A',
      handler: selectAllElements,
    },
    {
      text: '鎖定',
      subText: 'Ctrl + L',
      handler: lockElement,
    },
    {
      text: '刪除',
      subText: 'Delete',
      handler: deleteElement,
    },
  ]
}
</script>
