// 清除文字選區
export const removeAllRanges = () => {
  const selection = window.getSelection()
  selection && selection.removeAllRanges()
}