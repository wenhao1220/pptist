import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import usePasteTextClipboardData from './usePasteTextClipboardData'
import usePasteDataTransfer from './usePasteDataTransfer'

export default () => {
  const { editorAreaFocus, thumbnailsFocus, disableHotkeys } = storeToRefs(useMainStore())

  const { pasteTextClipboardData } = usePasteTextClipboardData()
  const { pasteDataTransfer } = usePasteDataTransfer()

  /**
   * 貼上事件監聽
   * @param e ClipboardEvent
   */
  const pasteListener = (e: ClipboardEvent) => {
    if (!editorAreaFocus.value && !thumbnailsFocus.value) return
    if (disableHotkeys.value) return

    if (!e.clipboardData) return

    const { isFile, dataTransferFirstItem } = pasteDataTransfer(e.clipboardData)
    if (isFile) return
    
    // 如果剪貼簿內不存在有效檔案，但有文字內容，嘗試解析文字內容
    if (dataTransferFirstItem && dataTransferFirstItem.kind === 'string' && dataTransferFirstItem.type === 'text/plain') {
      dataTransferFirstItem.getAsString(text => pasteTextClipboardData(text))
    }
  }

  onMounted(() => {
    document.addEventListener('paste', pasteListener)
  })
  onUnmounted(() => {
    document.removeEventListener('paste', pasteListener)
  })
}