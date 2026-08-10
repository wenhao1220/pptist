import axios from 'axios'
import message from '@/utils/message'

const instance = axios.create({ timeout: 1000 * 300 })

instance.interceptors.response.use(
  response => {
    if (response.status >= 200 && response.status < 400) {
      return Promise.resolve(response.data)
    }

    message.error('未知的請求錯誤！')
    return Promise.reject(response)
  },
  error => {
    if (error && error.response) {
      if (error.response.status >= 400 && error.response.status < 500) {
        return Promise.reject(error.message)
      }
      else if (error.response.status >= 500) {
        return Promise.reject(error.message)
      }
      
      message.error('伺服器遇到未知錯誤！')
      return Promise.reject(error.message)
    }

    message.error('連線到伺服器失敗 或 伺服器響應超時！')
    return Promise.reject(error)
  }
)

export default instance