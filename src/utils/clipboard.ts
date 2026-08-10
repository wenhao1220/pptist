import Clipboard from 'clipboard'
import { decrypt } from '@/utils/crypto'

/**
 * 複製文本到剪貼簿
 * @param text 文本內容
 */
export const copyText = (text: string) => {
  return new Promise((resolve, reject) => {
    const fakeElement = document.createElement('button')
    const clipboard = new Clipboard(fakeElement, {
      text: () => text,
      action: () => 'copy',
      container: document.body,
    })
    clipboard.on('success', e => {
      clipboard.destroy()
      resolve(e)
    })
    clipboard.on('error', e => {
      clipboard.destroy()
      reject(e)
    })
    document.body.appendChild(fakeElement)
    fakeElement.click()
    document.body.removeChild(fakeElement)
  })
}

// 讀取剪貼簿
export const readClipboard = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then(text => {
        if (!text) reject('剪貼簿為空或者不包含文本')
        return resolve(text)
      })
    }
    else reject('瀏覽器不支援或禁止訪問剪貼簿，請使用快捷鍵 Ctrl + V')
  })
}

// 解析加密後的剪貼簿內容
export const pasteCustomClipboardString = (text: string) => {
  let clipboardData
  try {
    clipboardData = JSON.parse(decrypt(text))
  }
  catch {
    clipboardData = text
  }

  return clipboardData
}

// 嘗試解析剪貼簿內容是否為Excel表格（或類似的）資料格式
export const pasteExcelClipboardString = (text: string): string[][] | null => {
  const lines: string[] = text.split('\r\n')

  if (lines[lines.length - 1] === '') lines.pop()

  let colCount = -1
  const data: string[][] = []
  for (const index in lines) {
    data[index] = lines[index].split('\t')

    if (data[index].length === 1) return null
    if (colCount === -1) colCount = data[index].length
    else if (colCount !== data[index].length) return null
  }
  return data
}

// 嘗試解析剪貼簿內容是否為HTML table程式碼
export const pasteHTMLTableClipboardString = (text: string): string[][] | null => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/html')
  const table = doc.querySelector('table')
  const data: string[][] = []

  if (!table) return data

  const rows = table.querySelectorAll('tr')
  for (const row of rows) {
    const rowData = []
    const cells = row.querySelectorAll('td, th')
    for (const cell of cells) {
      const text = cell.textContent ? cell.textContent.trim() : ''
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10)
      for (let i = 0; i < colspan; i++) {
        rowData.push(text)
      }
    }
    data.push(rowData)
  }

  return data
}