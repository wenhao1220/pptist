<template>
  <div 
    class="multi-select-operate"
    :style="{
      left: range.minX * canvasScale + 'px',
      top: range.minY * canvasScale + 'px',
    }"
  >
    <BorderLine v-for="line in borderLines" :key="line.type" :type="line.type" :style="line.style" />

    <template v-if="!disableResize">
      <ResizeHandler
        v-for="point in resizeHandlers"
        :key="point.direction"
        :type="point.direction"
        :style="point.style"
        @mousedown.stop="scaleMultiElement($event, range, point.direction)"
      />
    </template>
    <RotateHandler
      v-if="showRotateHandler"
      :style="{ left: width / 2 + 'px' }"
      @mousedown.stop="rotateGroupElement($event, localActiveElementList)"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import type { PPTElement } from '@/types/slides'
import { getElementListRange, canRotateGroupElements } from '@/utils/element'
import type { OperateResizeHandlers, MultiSelectRange } from '@/types/edit'
import useCommonOperate from '../hooks/useCommonOperate'

import ResizeHandler from './ResizeHandler.vue'
import BorderLine from './BorderLine.vue'
import RotateHandler from './RotateHandler.vue'

const props = defineProps<{
  elementList: PPTElement[]
  scaleMultiElement: (e: MouseEvent, range: MultiSelectRange, command: OperateResizeHandlers) => void
  rotateGroupElement: (e: MouseEvent, elements: PPTElement[]) => void
}>()

const { activeElementIdList, activeGroupElementId, canvasScale } = storeToRefs(useMainStore())

const localActiveElementList = computed(() => props.elementList.filter(el => activeElementIdList.value.includes(el.id)))

const range = ref({
  minX: 0,
  maxX: 0,
  minY: 0,
  maxY: 0,
})

// 根據多選元素整體在畫布中的範圍，計算邊框線和縮放點的位置資訊
const width = computed(() => (range.value.maxX - range.value.minX) * canvasScale.value)
const height = computed(() => (range.value.maxY - range.value.minY) * canvasScale.value)
const { resizeHandlers, borderLines } = useCommonOperate(width, height)

// 計算多選元素整體在畫布中的範圍
const setRange = () => {
  const { minX, maxX, minY, maxY } = getElementListRange(localActiveElementList.value)
  range.value = { minX, maxX, minY, maxY }
}
watchEffect(setRange)

// 停用多選狀態下縮放：僅未旋轉的圖片和形狀可以在多選狀態下縮放
const disableResize = computed(() => {
  return localActiveElementList.value.some(item => {
    if (
      (item.type === 'image' || item.type === 'shape') && 
      !item.rotate
    ) return false
    return true
  })
})

const showRotateHandler = computed(() => {
  return !activeGroupElementId.value && canRotateGroupElements(localActiveElementList.value)
})
</script>

<style lang="scss" scoped>
.multi-select-operate {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 101;
}
</style>