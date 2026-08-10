<template>
  <div 
    class="screen-element"
    :class="{ 'link': elementInfo.link }"
    :id="`screen-element-${elementInfo.id}`"
    :style="{
      zIndex: elementIndex,
      color: theme.fontColor,
      fontFamily: theme.fontName,
      visibility: needWaitAnimation ? 'hidden' : 'visible',
    }"
    :title="elementInfo.link?.target || ''"
    @click="$event => openLink($event)"
  >
    <component
      :is="currentElementComponent"
      :elementInfo="elementInfo"
    ></component>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { ElementTypes, type PPTElement } from '@/types/slides'

import BaseImageElement from '@/views/components/element/ImageElement/BaseImageElement.vue'
import BaseTextElement from '@/views/components/element/TextElement/BaseTextElement.vue'
import BaseShapeElement from '@/views/components/element/ShapeElement/BaseShapeElement.vue'
import BaseLineElement from '@/views/components/element/LineElement/BaseLineElement.vue'
import BaseChartElement from '@/views/components/element/ChartElement/BaseChartElement.vue'
import BaseTableElement from '@/views/components/element/TableElement/BaseTableElement.vue'
import BaseLatexElement from '@/views/components/element/LatexElement/BaseLatexElement.vue'
import ScreenVideoElement from '@/views/components/element/VideoElement/ScreenVideoElement.vue'
import ScreenAudioElement from '@/views/components/element/AudioElement/ScreenAudioElement.vue'

const props = defineProps<{
  elementInfo: PPTElement
  elementIndex: number
  animationIndex: number
  turnSlideToId: (id: string) => void
  manualExitFullscreen: () => void
}>()

const currentElementComponent = computed<unknown>(() => {
  const elementTypeMap = {
    [ElementTypes.IMAGE]: BaseImageElement,
    [ElementTypes.TEXT]: BaseTextElement,
    [ElementTypes.SHAPE]: BaseShapeElement,
    [ElementTypes.LINE]: BaseLineElement,
    [ElementTypes.CHART]: BaseChartElement,
    [ElementTypes.TABLE]: BaseTableElement,
    [ElementTypes.LATEX]: BaseLatexElement,
    [ElementTypes.VIDEO]: ScreenVideoElement,
    [ElementTypes.AUDIO]: ScreenAudioElement,
  }
  return elementTypeMap[props.elementInfo.type] || null
})

const { formatedAnimations, theme } = storeToRefs(useSlidesStore())

// 判斷元素是否需要等待執行入場動畫：等待執行入場的元素需要先隱藏
const needWaitAnimation = computed(() => {
  // 該元素在本頁動畫序列中的位置
  const elementIndexInAnimation = formatedAnimations.value.findIndex(item => {
    const elIds = item.animations.map(item => item.elId)
    return elIds.includes(props.elementInfo.id)
  })

  // 該元素未設定過動畫
  if (elementIndexInAnimation === -1) return false

  // 若該元素已執行過動畫，都無須隱藏
  // 具體來說：若已執行的最後一個動畫為入場，顯然無須隱藏；若已執行的最後一個動畫為退場，由於保留了退場動畫結束狀態，也無需額外隱藏
  if (elementIndexInAnimation < props.animationIndex) return false

  // 若該元素未執行過動畫，獲取其將要執行的第一個動畫
  // 若將要執行的第一個動畫為入場，則需要隱藏，否則無須隱藏
  const firstAnimation = formatedAnimations.value[elementIndexInAnimation].animations.find(item => item.elId === props.elementInfo.id)
  if (firstAnimation?.type === 'in') return true
  return false
})

// 開啟元素繫結的超連結
const openLink = (e: MouseEvent) => {
  if ((e.target as HTMLElement).tagName === 'A') {
    props.manualExitFullscreen()
    return
  }

  const link = props.elementInfo.link
  if (!link) return

  if (link.type === 'web') {
    props.manualExitFullscreen()
    window.open(link.target)
  }
  else if (link.type === 'slide') {
    props.turnSlideToId(link.target)
  }
}
</script>

<style lang="scss" scoped>
.link {
  cursor: pointer;
}
</style>