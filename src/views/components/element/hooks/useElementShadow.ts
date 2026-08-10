import { computed, type Ref } from 'vue'
import type { PPTElementShadow } from '@/types/slides'

// 計算元素的陰影樣式
export default (shadow: Ref<PPTElementShadow | undefined>) => {
  const shadowStyle = computed(() => {
    if (shadow.value) {
      const { h, v, blur, color } = shadow.value
      return `${h}px ${v}px ${blur}px ${color}`
    }
    return ''
  })

  return {
    shadowStyle,
  }
}