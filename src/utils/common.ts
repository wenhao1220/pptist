import { padStart } from 'lodash'

/**
 * 補足數字位數
 * @param digit 數字
 * @param len 位數
 */
export const fillDigit = (digit: number, len: number) => {
  return padStart('' + digit, len, '0')
}

/**
 * 判斷裝置
 */
export const isPC = () => {
  return !navigator.userAgent.match(/(iPhone|iPod|iPad|Android|Mobile|BlackBerry|Symbian|Windows Phone)/i)
}

/**
 * 判斷URL字串
 */
export const isValidURL = (url: string) => {
  return /^(https?:\/\/)([\w-]+\.)+[\w-]{2,}(\/[\w-./?%&=]*)?$/i.test(url)
}

/**
 * HTML轉純文本
 */
export const htmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

/**
 * 浮點數比較
 */
export const isFloatEqual = (a: number, b: number, epsilon = 1e-10) => {
  return Math.abs(a - b) < epsilon
}

/**
 * 保留小數轉換
 */
export const toFixed = (num: number, fractionDigits = 1) => {
  if (num % 1 !== 0) {
    return parseFloat(num.toFixed(fractionDigits))
  } 
  return Math.floor(num)
}