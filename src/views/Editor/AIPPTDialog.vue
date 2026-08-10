<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AIPPT (Claude 3.5 Sonnet)</span>
      <span class="subtitle">上傳您的 PDF 檔案，我們將透過 AWS Bedrock 智慧為您生成簡報結構</span>
    </div>
    <div class="content">
      <div class="upload-area">
        <input type="file" ref="fileInputRef" accept=".pdf" style="display: none" @change="handleFileChange" />
        <Button class="btn" type="primary" @click="triggerUpload">選擇 PDF 檔案</Button>
        <div v-if="selectedFile" class="file-info">已選擇：{{ selectedFile.name }}</div>
      </div>
      <div class="configs" v-if="!isEmptySlide">
        <div class="config-item">
          <Checkbox v-model:value="overwrite">覆蓋已有投影片</Checkbox>
        </div>
      </div>
      <div class="btns" v-if="selectedFile">
        <Button class="btn" type="primary" @click="generatePPT">開始生成</Button>
      </div>
    </div>
    <FullscreenSpin :loading="loading" tip="Claude 正在努力閱讀與生成簡報，請耐心等待（可能需要 1~2 分鐘）..." />
  </div>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue'
import axios from 'axios'
import { aiApiUrl } from '@/utils/aiApi'
import useImport from '@/hooks/useImport'
import useSlideHandler from '@/hooks/useSlideHandler'
import { useMainStore, useSnapshotStore } from '@/store'
import message from '@/utils/message'
import Button from '@/components/Button.vue'
import Checkbox from '@/components/Checkbox.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'

const mainStore = useMainStore()
const snapshotStore = useSnapshotStore()
const { isEmptySlide } = useSlideHandler()
const { importPPTXFile } = useImport()

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const overwrite = ref(true)

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

/** 解碼 Axios 錯誤中可能以 ArrayBuffer 格式回傳的 JSON 錯誤訊息 */
const decodeAxiosError = (err: any): string => {
  if (err.response?.data instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(err.response.data)
      const parsed = JSON.parse(text)
      return parsed.error || '請求失敗'
    } catch (_) {
      return '請求失敗'
    }
  }
  return err.response?.data?.error || err.message || '未知錯誤'
}

const generatePPT = async () => {
  if (!selectedFile.value) return message.error('請先選擇 PDF 檔案')

  loading.value = true
  mainStore.setAIPPTDialogState('running')

  // 使用 FormData 將檔案傳至後端：後端將自動提取文字 → LLM 生成藍圖 → buildPPTX → 回傳 .pptx
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('prompt', '請根據上傳的文件內容，生成一份結構完整、視覺豐富的高品質i簡報')

  try {
    const response = await axios.post(
      aiApiUrl('/api/generate-pptx'),
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'arraybuffer',
      }
    )

    // 將 ArrayBuffer 封裝成 File 物件
    const buffer = response.data as ArrayBuffer
    const file = new File(
      [buffer],
      'AI生成簡報.pptx',
      { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
    )

    // 儲存復原點（在覆蓋畫布前）
    snapshotStore.addSnapshot()
    // cover 參數依用者勾選框選擇：勾選則覆蓋，此外則附加
    await importPPTXFile([file], { cover: overwrite.value || isEmptySlide.value })

    message.success('簡報生成成功！')
    mainStore.setAIPPTDialogState(false)
  } catch (err: any) {
    console.error('PPTX 生成錯誤', err)
    message.error(decodeAxiosError(err) || '生成失敗，請檢查後端狀態')
  } finally {
    loading.value = false
    if (mainStore.showAIPPTDialog === 'running') {
      mainStore.setAIPPTDialogState(true)
    }
  }
}
</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 20px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtitle {
    color: #888;
    font-size: 12px;
  }
}
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;

  .upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
    
    .file-info {
      margin-top: 10px;
      font-size: 14px;
      color: #555;
    }
  }

  .configs {
    margin-bottom: 20px;
    font-size: 13px;
  }

  .btns {
    display: flex;
    justify-content: center;
  }
}
</style>
