<template>
  <div 
    class="element-create-selection"
    ref="selectionRef"
    @mousedown.stop="$event => createSelection($event)"
    @contextmenu.stop.prevent
  >
    <div :class="['selection', creatingElement?.type]" v-if="start && end" :style="position">

      <!-- 繪製線條專用 -->
      <svg
        v-if="creatingElement?.type === 'line' && lineData"
        overflow="visible" 
        :width="lineData.svgWidth"
        :height="lineData.svgHeight"
      >
				<path
          :d="lineData.path" 
          stroke="#d14424" 
          fill="none" 
          stroke-width="2" 
        ></path>
			</svg>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useKeyboardStore } from '@/store'
import type { CreateElementSelectionData } from '@/types/edit'

const emit = defineEmits<{
  (event: 'created', payload: CreateElementSelectionData): void
}>()

const mainStore = useMainStore()
const { creatingElement } = storeToRefs(mainStore)
const { ctrlOrShiftKeyActive } = storeToRefs(useKeyboardStore())

const start = ref<[number, number]>()
const end = ref<[number, number]>()

const selectionRef = useTemplateRef<HTMLElement>('selectionRef')
const offset = ref({
  x: 0,
  y: 0,
})
onMounted(() => {
  if (!selectionRef.value) return
  const { x, y } = selectionRef.value.getBoundingClientRect()
  offset.value = { x, y }
})

// 滑鼠拖動建立元素生成位置大小
// 獲取範圍的起始位置和終點位置
const createSelection = (e: MouseEvent) => {
  let isMouseDown = true

  const startPageX = e.pageX
  const startPageY = e.pageY
  start.value = [startPageX, startPageY]

  document.onmousemove = e => {
    if (!creatingElement.value || !isMouseDown) return

    let currentPageX = e.pageX
    let currentPageY = e.pageY

    // 按住Ctrl鍵或者Shift鍵時：
    // 對於非線條元素需要鎖定寬高比例，對於線條元素需要鎖定水平或垂直方向
    if (ctrlOrShiftKeyActive.value) {
      const moveX = currentPageX - startPageX
      const moveY = currentPageY - startPageY

      // 水平和垂直方向的拖動距離，後面以拖動距離較大的方向為基礎計算另一方向的資料
      const absX = Math.abs(moveX)
      const absY = Math.abs(moveY)

      if (creatingElement.value.type === 'shape') {

        // 判斷是否為反向拖動：從左上到右下為正向操作，此外所有情況都是反向操作
        const isOpposite = (moveY > 0 && moveX < 0) || (moveY < 0 && moveX > 0)

        if (absX > absY) {
          currentPageY = isOpposite ? startPageY - moveX : startPageY + moveX
        }
        else {
          currentPageX = isOpposite ? startPageX - moveY : startPageX + moveY
        }
      }

      else if (creatingElement.value.type === 'line') {
        if (absX > absY) currentPageY = startPageY
        else currentPageX = startPageX
      }
    }

    end.value = [currentPageX, currentPageY]
  }

  document.onmouseup = e => {
    document.onmousemove = null
    document.onmouseup = null

    if (e.button === 2) {
      setTimeout(() => mainStore.setCreatingElement(null), 0)
      return
    }

    isMouseDown = false

    const endPageX = e.pageX
    const endPageY = e.pageY

    const minSize = 30

    if (
      creatingElement.value?.type === 'line' &&
      (Math.abs(endPageX - startPageX) >= minSize || Math.abs(endPageY - startPageY) >= minSize)
    ) {
      emit('created', {
        start: start.value!,
        end: end.value!,
      })
    }
    else if (
      creatingElement.value?.type !== 'line' &&
      (Math.abs(endPageX - startPageX) >= minSize && Math.abs(endPageY - startPageY) >= minSize)
    ) {
      emit('created', {
        start: start.value!,
        end: end.value!,
      })
    }
    else {
      const defaultSize = 200
      const minX = Math.min(endPageX, startPageX)
      const minY = Math.min(endPageY, startPageY)
      const maxX = Math.max(endPageX, startPageX)
      const maxY = Math.max(endPageY, startPageY)
      const offsetX = maxX - minX >= minSize ? maxX - minX : defaultSize
      const offsetY = maxY - minY >= minSize ? maxY - minY : defaultSize
      emit('created', {
        start: [minX, minY],
        end: [minX + offsetX, minY + offsetY],
      })
    }
  }
}

// 繪製線條的路徑相關資料（僅當繪製元素型別為線條時使用）
const lineData = computed(() => {
  if (!start.value || !end.value) return null
  if (!creatingElement.value || creatingElement.value.type !== 'line') return null

  const [_startX, _startY] = start.value
  const [_endX, _endY] = end.value
  const minX = Math.min(_startX, _endX)
  const maxX = Math.max(_startX, _endX)
  const minY = Math.min(_startY, _endY)
  const maxY = Math.max(_startY, _endY)

  const svgWidth = maxX - minX >= 24 ? maxX - minX : 24
  const svgHeight = maxY - minY >= 24 ? maxY - minY : 24

  const startX = _startX === minX ? 0 : maxX - minX
  const startY = _startY === minY ? 0 : maxY - minY
  const endX = _endX === minX ? 0 : maxX - minX
  const endY = _endY === minY ? 0 : maxY - minY

  const path = `M${startX}, ${startY} L${endX}, ${endY}`

  return {
    svgWidth,
    svgHeight,
    startX,
    startY,
    endX,
    endY,
    path,
  }
})

// 根據生成範圍的起始位置和終點位置，計算元素建立時的位置和大小
const position = computed(() => {
  if (!start.value || !end.value) return {}

  const [startX, startY] = start.value
  const [endX, endY] = end.value
  const minX = Math.min(startX, endX)
  const maxX = Math.max(startX, endX)
  const minY = Math.min(startY, endY)
  const maxY = Math.max(startY, endY)

  const width = maxX - minX
  const height = maxY - minY

  return {
    left: minX - offset.value.x + 'px',
    top: minY - offset.value.y + 'px',
    width: width + 'px',
    height: height + 'px',
  }
})
</script>

<style lang="scss" scoped>
.element-create-selection {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  cursor: crosshair;

  svg {
    overflow: visible;
  }
}
.selection {
  position: absolute;
  opacity: .8;

  &:not(.line) {
    border: 1px solid $themeColor;
  }
}
</style>