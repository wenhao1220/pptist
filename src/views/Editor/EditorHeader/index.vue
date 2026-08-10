<template>
  <div class="editor-header">
    <div class="left">
      <Popover trigger="click" placement="bottom-start" v-model:value="mainMenuVisible">
        <template #content>
          <div class="main-menu">
            <div class="ai-menu" @click="toggleAICopilot(); mainMenuVisible = false">
              <div class="icon" style="font-size: 24px;"><span class="ai-gradient-text" style="font-size: 20px;">AI</span></div>
              <div class="aippt-content">
                <div class="aippt"><span>AI 助理</span></div>
                <div class="aippt-subtitle">AI 智慧摘要生成 PPT</div>
              </div>
            </div>
          </div>
          <Divider :margin="10" />
          <PopoverMenuItem class="popover-menu-item" @click="setDialogForExport('pptx')"><i-icon-park-outline:download class="icon" /> 匯出檔案</PopoverMenuItem>
          <Divider :margin="10" />
          <PopoverMenuItem class="popover-menu-item" @click="resetSlides(); mainMenuVisible = false"><i-icon-park-outline:refresh class="icon" /> 重置投影片</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="openMarkupPanel(); mainMenuVisible = false"><i-icon-park-outline:mark class="icon" /> 投影片型別標註</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="mainMenuVisible = false; hotkeyDrawerVisible = true"><i-icon-park-outline:command class="icon" /> 快捷操作</PopoverMenuItem>
        </template>
        <div class="menu-item"><i-icon-park-outline:hamburger-button class="icon" /></div>
      </Popover>

      <div class="title">
        <Input 
          class="title-input" 
          ref="titleInputRef"
          v-model:value="titleValue" 
          @blur="handleUpdateTitle()" 
          v-if="editingTitle" 
        ></Input>
        <div 
          class="title-text"
          @click="startEditTitle()"
          :title="title"
          v-else
        >{{ title }}</div>
      </div>
    </div>

    <div class="right">
      <div class="group-menu-item">
        <div class="menu-item" v-tooltip="'投影片放映（F5）'" @click="enterScreening()">
          <i-icon-park-outline:ppt class="icon" />
        </div>
        <Popover trigger="click" center>
          <template #content>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreeningFromStart()"><i-icon-park-outline:slide-two class="icon" /> 從頭開始</PopoverMenuItem>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreening()"><i-icon-park-outline:ppt class="icon" /> 從當前頁開始</PopoverMenuItem>
          </template>
          <div class="arrow-btn"><i-icon-park-outline:down class="arrow" /></div>
        </Popover>
      </div>
      <div class="menu-item" v-tooltip="'AI 助理'" @click="toggleAICopilot()">
        <span class="icon ai-gradient-text">AI</span>
      </div>
      <div class="menu-item" v-tooltip="'匯出'" @click="setDialogForExport('pptx')">
        <i-icon-park-outline:download class="icon" />
      </div>
      <div class="menu-item feedback-menu-item" v-tooltip="'問題回報'" @click="feedbackVisible = true">
        <span class="feedback-label">問題回報</span>
      </div>
    </div>

    <Drawer
      :width="320"
      v-model:visible="hotkeyDrawerVisible"
      placement="right"
    >
      <HotkeyDoc />
      <template v-slot:title>快捷操作</template>
    </Drawer>

    <FullscreenSpin :loading="exporting" tip="正在匯入..." />
    <div v-if="feedbackVisible" class="feedback-backdrop" @click.self="closeFeedback">
      <section class="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div class="feedback-dialog-header">
          <div>
            <h2 id="feedback-title">問題回報</h2>
            <p>告訴我們你遇到的問題、建議或錯誤情況。</p>
          </div>
          <button class="feedback-close" type="button" aria-label="關閉" @click="closeFeedback">×</button>
        </div>
        <label for="feedback-message">問題或建議 <span>*</span></label>
        <textarea id="feedback-message" v-model="feedbackMessage" maxlength="4000" placeholder="例如：操作步驟、預期結果、實際看到的狀況…"></textarea>
        <label for="feedback-contact">聯絡方式（選填）</label>
        <input id="feedback-contact" v-model="feedbackContact" maxlength="320" placeholder="Email、姓名或 Teams 帳號" />
        <p v-if="feedbackStatus" :class="['feedback-status', feedbackStatus.type]">{{ feedbackStatus.text }}</p>
        <div class="feedback-actions">
          <button class="feedback-secondary" type="button" :disabled="feedbackSending" @click="closeFeedback">取消</button>
          <button class="feedback-primary" type="button" :disabled="feedbackSending || !feedbackMessage.trim()" @click="submitFeedback">{{ feedbackSending ? '傳送中…' : '傳送回報' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, ref, useTemplateRef } from 'vue'
import axios from 'axios'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import useScreening from '@/hooks/useScreening'
import useImport from '@/hooks/useImport'
import useSlideHandler from '@/hooks/useSlideHandler'
import type { DialogForExportTypes } from '@/types/export'

import HotkeyDoc from './HotkeyDoc.vue'
import FileInput from '@/components/FileInput.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Drawer from '@/components/Drawer.vue'
import Input from '@/components/Input.vue'
import Popover from '@/components/Popover.vue'
import PopoverMenuItem from '@/components/PopoverMenuItem.vue'
import Divider from '@/components/Divider.vue'
import { aiApiUrl } from '@/utils/aiApi'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { title } = storeToRefs(slidesStore)
const { enterScreening, enterScreeningFromStart } = useScreening()
const { importSpecificFile, importPPTXFile, importJSON, exporting } = useImport()
const { resetSlides } = useSlideHandler()

const mainMenuVisible = ref(false)
const hotkeyDrawerVisible = ref(false)
const editingTitle = ref(false)
const titleValue = ref('')
const titleInputRef = useTemplateRef<InstanceType<typeof Input>>('titleInputRef')
const feedbackVisible = ref(false)
const feedbackMessage = ref('')
const feedbackContact = ref('')
const feedbackSending = ref(false)
const feedbackStatus = ref<{ type: 'success' | 'error', text: string } | null>(null)

const startEditTitle = () => {
  titleValue.value = title.value
  editingTitle.value = true
  nextTick(() => titleInputRef.value?.focus())
}

const handleUpdateTitle = () => {
  slidesStore.setTitle(titleValue.value)
  editingTitle.value = false
}

const goLink = (url: string) => {
  window.open(url)
  mainMenuVisible.value = false
}

const setDialogForExport = (type: DialogForExportTypes) => {
  mainStore.setDialogForExport(type)
  mainMenuVisible.value = false
}

const openMarkupPanel = () => {
  mainStore.setMarkupPanelState(true)
}

const toggleAICopilot = () => {
  mainStore.setAICopilotPanelState(!mainStore.showAICopilotPanel)
}

const closeFeedback = () => {
  if (feedbackSending.value) return
  feedbackVisible.value = false
  feedbackStatus.value = null
}

const submitFeedback = async () => {
  if (!feedbackMessage.value.trim() || feedbackSending.value) return
  feedbackSending.value = true
  feedbackStatus.value = null
  try {
    await axios.post(aiApiUrl('/api/feedback'), {
      message: feedbackMessage.value.trim(),
      contact: feedbackContact.value.trim(),
      pageTitle: title.value,
    })
    feedbackStatus.value = { type: 'success', text: '已送出，謝謝你的回報。' }
    feedbackMessage.value = ''
    feedbackContact.value = ''
  } catch (error: any) {
    feedbackStatus.value = { type: 'error', text: error?.response?.data?.error || '送出失敗，請稍後再試。' }
  } finally {
    feedbackSending.value = false
  }
}
</script>

<style lang="scss" scoped>
.editor-header {
  background-color: #fff;
  user-select: none;
  border-bottom: 1px solid $borderColor;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.left, .right {
  display: flex;
  justify-content: center;
  align-items: center;
}
.menu-item {
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  padding: 0 10px;
  border-radius: $borderRadius;
  cursor: pointer;

  .icon {
    font-size: 18px;
    color: #666;
  }
  .text {
    width: 18px;
    text-align: center;
    font-size: 17px;
  }
  .ai {
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    font-weight: 700;
  }

  &:hover {
    background-color: #f1f1f1;
  }
}
.popover-menu-item {
  display: flex;
  padding: 8px 10px;

  .icon {
    font-size: 18px;
    margin-right: 10px;
  }
}
.statement {
  font-size: 12px;
  color: #999;
  padding: 8px 10px;
  font-style: italic;
}
.main-menu {
  width: 300px;
}
.ai-menu {
  background: linear-gradient(270deg, #f8edff, #d4f1ff);
  color: $themeColor;
  border-radius: $borderRadius;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  cursor: pointer;

  .icon {
    font-size: 22px;
    margin-right: 16px;
  }
  .aippt-content {
    display: flex;
    flex-direction: column;
  }
  .aippt {
    font-weight: 700;
    font-size: 16px;

    span {
      background: linear-gradient(270deg, #d897fd, #33bcfc);
      background-clip: text;
      color: transparent;
    }
  }
  .aippt-subtitle {
    font-size: 12px;
    color: #777;
    margin-top: 5px;
  }
}

.import-section {
  padding: 5px 0;

  .import-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 6px;
  }
  .import-grid {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .import-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    border-radius: $borderRadius;
    border: 1px solid $borderColor;
    transition: background-color .2s;
    cursor: pointer;
  
    &:hover {
      background-color: #f1f1f1;
    }
    .icon {
      font-size: 24px;
      margin-bottom: 2px;
    }
    .label {
      font-size: 12px;
      text-align: center;
    }
    .sub-label {
      font-size: 10px;
      color: #999;
    }
  }
}

.group-menu-item {
  height: 30px;
  display: flex;
  margin: 0 8px;
  padding: 0 2px;
  border-radius: $borderRadius;

  &:hover {
    background-color: #f1f1f1;
  }

  .menu-item {
    padding: 0 3px;
  }
  .arrow-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
}
.title {
  height: 30px;
  margin-left: 2px;
  font-size: 13px;

  .title-input {
    width: 200px;
    height: 100%;
    padding-left: 0;
    padding-right: 0;

    ::v-deep(input) {
      height: 28px;
      line-height: 28px;
    }
  }
  .title-text {
    min-width: 20px;
    max-width: 400px;
    line-height: 30px;
    padding: 0 6px;
    border-radius: $borderRadius;
    cursor: pointer;

    @include ellipsis-oneline();

    &:hover {
      background-color: #f1f1f1;
    }
  }
}
.github-link {
  color: inherit;
}

.ai-gradient-text {
  font-weight: 900;
  font-family: 'Arial Black', Arial, sans-serif;
  background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
  line-height: 1;
}
.feedback-menu-item .feedback-label {
  color: #44546a;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.feedback-backdrop {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(17, 24, 39, 0.42);
}
.feedback-dialog {
  width: min(480px, 100%);
  border-radius: 12px;
  padding: 24px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);

  label {
    display: block;
    margin: 18px 0 7px;
    color: #334155;
    font-size: 13px;
    font-weight: 600;
    span { color: #dc2626; }
  }
  textarea, input {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 10px 12px;
    color: #1e293b;
    font: inherit;
    outline: none;
    &:focus { border-color: #4f8ef7; box-shadow: 0 0 0 3px rgba(79, 142, 247, 0.16); }
  }
  textarea { min-height: 120px; resize: vertical; }
}
.feedback-dialog-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  h2 { margin: 0; color: #1e293b; font-size: 20px; }
  p { margin: 7px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; }
}
.feedback-close {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  &:hover { background: #f1f5f9; }
}
.feedback-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.feedback-actions button {
  border: 0;
  border-radius: 7px;
  padding: 9px 15px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  &:disabled { cursor: not-allowed; opacity: 0.55; }
}
.feedback-secondary { background: #e2e8f0; color: #334155; }
.feedback-primary { background: #2563eb; color: #fff; }
.feedback-status { margin: 14px 0 0; font-size: 13px; }
.feedback-status.success { color: #15803d; }
.feedback-status.error { color: #dc2626; }
</style>
