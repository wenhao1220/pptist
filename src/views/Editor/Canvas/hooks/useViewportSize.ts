import { ref, computed, onMounted, onUnmounted, watch, type ShallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'

export default (canvasRef: ShallowRef<HTMLElement | null>) => {
  const viewportLeft = ref(0)
  const viewportTop = ref(0)

  const mainStore = useMainStore()
  const { canvasPercentage, canvasDragged } = storeToRefs(mainStore)
  const { viewportRatio, viewportSize } = storeToRefs(useSlidesStore())

  // 初始化畫布可視區域的位置
  const initViewportPosition = () => {
    if (!canvasRef.value) return
    const canvasWidth = canvasRef.value.clientWidth
    const canvasHeight = canvasRef.value.clientHeight

    if (canvasHeight / canvasWidth > viewportRatio.value) {
      const viewportActualWidth = canvasWidth * (canvasPercentage.value / 100)
      mainStore.setCanvasScale(viewportActualWidth / viewportSize.value)
      viewportLeft.value = (canvasWidth - viewportActualWidth) / 2
      viewportTop.value = (canvasHeight - viewportActualWidth * viewportRatio.value) / 2
    }
    else {
      const viewportActualHeight = canvasHeight * (canvasPercentage.value / 100)
      mainStore.setCanvasScale(viewportActualHeight / (viewportSize.value * viewportRatio.value))
      viewportLeft.value = (canvasWidth - viewportActualHeight / viewportRatio.value) / 2
      viewportTop.value = (canvasHeight - viewportActualHeight) / 2
    }
  }

  // 更新畫布可視區域的位置
  const setViewportPosition = (newValue: number, oldValue: number) => {
    if (!canvasRef.value) return
    const canvasWidth = canvasRef.value.clientWidth
    const canvasHeight = canvasRef.value.clientHeight

    if (canvasHeight / canvasWidth > viewportRatio.value) {      
      const newViewportActualWidth = canvasWidth * (newValue / 100)
      const oldViewportActualWidth = canvasWidth * (oldValue / 100)
      const newViewportActualHeight = newViewportActualWidth * viewportRatio.value
      const oldViewportActualHeight = oldViewportActualWidth * viewportRatio.value

      mainStore.setCanvasScale(newViewportActualWidth / viewportSize.value)

      viewportLeft.value = viewportLeft.value - (newViewportActualWidth - oldViewportActualWidth) / 2
      viewportTop.value = viewportTop.value - (newViewportActualHeight - oldViewportActualHeight) / 2
    }
    else {
      const newViewportActualHeight = canvasHeight * (newValue / 100)
      const oldViewportActualHeight = canvasHeight * (oldValue / 100)
      const newViewportActualWidth = newViewportActualHeight / viewportRatio.value
      const oldViewportActualWidth = oldViewportActualHeight / viewportRatio.value

      mainStore.setCanvasScale(newViewportActualHeight / (viewportSize.value * viewportRatio.value))

      viewportLeft.value = viewportLeft.value - (newViewportActualWidth - oldViewportActualWidth) / 2
      viewportTop.value = viewportTop.value - (newViewportActualHeight - oldViewportActualHeight) / 2
    }
  }

  // 可視區域縮放或比例變化時，重置/更新可視區域的位置
  watch(canvasPercentage, setViewportPosition)
  watch(viewportRatio, initViewportPosition)
  watch(viewportSize, initViewportPosition)

  // 畫布拖拽狀態改變（復原）時，重置可視區域的位置
  watch(canvasDragged, () => {
    if (!canvasDragged.value) initViewportPosition()
  })

  // 畫布可視區域位置和大小的樣式
  const viewportStyles = computed(() => ({
    width: viewportSize.value,
    height: viewportSize.value * viewportRatio.value,
    left: viewportLeft.value,
    top: viewportTop.value,
  }))

  // 監聽畫布尺寸發生變化時，重置可視區域的位置
  const resizeObserver = new ResizeObserver(initViewportPosition)

  onMounted(() => {
    if (canvasRef.value) resizeObserver.observe(canvasRef.value)
  })
  onUnmounted(() => {
    if (canvasRef.value) resizeObserver.unobserve(canvasRef.value)
  })

  // 拖拽畫布
  const dragViewport = (e: MouseEvent) => {
    let isMouseDown = true

    const startPageX = e.pageX
    const startPageY = e.pageY

    const originLeft = viewportLeft.value
    const originTop = viewportTop.value

    document.onmousemove = e => {
      if (!isMouseDown) return

      const currentPageX = e.pageX
      const currentPageY = e.pageY

      viewportLeft.value = originLeft + (currentPageX - startPageX)
      viewportTop.value = originTop + (currentPageY - startPageY)
    }

    document.onmouseup = () => {
      isMouseDown = false
      document.onmousemove = null
      document.onmouseup = null

      mainStore.setCanvasDragged(true)
    }
  }

  return {
    viewportStyles,
    dragViewport,
  }
}