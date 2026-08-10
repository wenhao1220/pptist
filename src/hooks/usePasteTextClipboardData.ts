import { storeToRefs } from 'pinia'
import { useKeyboardStore } from '@/store'
import { pasteCustomClipboardString } from '@/utils/clipboard'
import { parseText2Paragraphs } from '@/utils/textParser'
import { getImageDataURL, isSVGString, svg2File } from '@/utils/image'
import { isValidURL } from '@/utils/common'
import useCreateElement from '@/hooks/useCreateElement'
import useAddSlidesOrElements from '@/hooks/useAddSlidesOrElements'

interface PasteTextClipboardDataOptions {
  onlySlide?: boolean
  onlyElements?: boolean
}

/**
 * 判斷圖片URL字串
 * 
 * ！！！注意，你需要判斷允許哪些來源的圖片地址被匹配，然後自行編寫正規表示式
 * ！！！必須確保圖片來源都是合法、可靠、可控、無訪問限制的
 */
const isValidImgURL = (url: string) => {
  const pexels = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*pexels\.com\/[^\s]+\.(?:jpg|jpeg|png|svg|webp)(?:\?.*)?$/i.test(url)
  const pptist = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*pptist\.cn\/[^\s]+\.(?:jpg|jpeg|png|svg|webp)(?:\?.*)?$/i.test(url)
  return pexels || pptist
}

export default () => {
  const { shiftKeyState } = storeToRefs(useKeyboardStore())

  const { createTextElement, createImageElement } = useCreateElement()
  const { addElementsFromData, addSlidesFromData } = useAddSlidesOrElements()

  /**
   * 貼上普通文本：建立為新的文本元素
   * @param text 文本
   */
  const createTextElementFromClipboard = (text: string) => {
    createTextElement({
      left: 0,
      top: 0,
      width: 600,
      height: 50,
    }, { content: text })
  }

  /**
   * 解析剪貼簿內容，根據解析結果選擇合適的貼上方式
   * @param text 剪貼簿內容
   * @param options 配置項：onlySlide -- 僅處理頁面貼上；onlyElements -- 僅處理元素貼上；
   */
  const pasteTextClipboardData = (text: string, options?: PasteTextClipboardDataOptions) => {
    const onlySlide = options?.onlySlide || false
    const onlyElements = options?.onlyElements || false

    const clipboardData = pasteCustomClipboardString(text)

    // 元素或頁面
    if (typeof clipboardData === 'object') {
      const { type, data } = clipboardData

      if (type === 'elements' && !onlySlide) addElementsFromData(data)
      else if (type === 'slides' && !onlyElements) addSlidesFromData(data)
    }

    // 普通文本
    else if (!onlyElements && !onlySlide) {
      // 普通文字
      if (shiftKeyState.value) {
        const string = parseText2Paragraphs(clipboardData)
        createTextElementFromClipboard(string)
      }
      else {
        // 嘗試檢查是否為圖片地址連結
        if (isValidImgURL(clipboardData)) {
          createImageElement(clipboardData)
        }
        // 嘗試檢查是否為超連結
        else if (isValidURL(clipboardData)) {
          createTextElementFromClipboard(`<a href="${clipboardData}" title="${clipboardData}" target="_blank">${clipboardData}</a>`)
        }
        // 嘗試檢查是否為SVG程式碼
        else if (isSVGString(clipboardData)) {
          const file = svg2File(clipboardData)
          getImageDataURL(file).then(dataURL => createImageElement(dataURL))
        }
        // 普通文字
        else {
          const string = parseText2Paragraphs(clipboardData)
          createTextElementFromClipboard(string)
        }
      }
    }
  }

  return {
    pasteTextClipboardData,
  }
}