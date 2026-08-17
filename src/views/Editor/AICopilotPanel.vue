<template>
  <MoveablePanel 
    class="ai-copilot-panel" 
    :width="340" 
    :height="620" 
    title="🤖 AI 助理 (Claude)" 
    :left="300" 
    :top="90"
    :minWidth="300"
    :minHeight="400"
    :maxWidth="800"
    :maxHeight="1200"
    resizeable
    @close="close()"
  >
    <div class="container">
      <div class="chat-history" ref="chatRef">
        <div class="empty" v-if="!messages.length">
          我是您的 AI 助理，<br/>
          您可以輸入指令或上傳附件<br/>
          讓我幫您生成或修改簡報！
        </div>
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <div class="avatar">{{ msg.role === 'user' ? '你' : '🤖' }}</div>
          <div class="bubble">
            <div class="content">{{ msg.content }}</div>
          </div>
        </div>
        <div class="message assistant" v-if="loading">
          <div class="avatar">🤖</div>
          <div class="bubble">
            <div class="content loading-dots">思考中...</div>
          </div>
        </div>
      </div>

      <!-- 藍圖確認區：當 generate 意圖觸發後顯示 -->
      <div class="blueprint-confirm" v-if="pendingBlueprint && !loading">
        <div class="blueprint-header">
          <span class="blueprint-icon">✨</span>
          <span class="blueprint-title">{{ pendingInsertion ? '新增頁面藍圖已就緒，確認插入？' : '藍圖已就緒，確認生成？' }}</span>
          <button class="cancel-btn" @click="cancelGenerate" title="取消">✕</button>
        </div>
        <div class="blueprint-meta">
          <div style="font-weight: bold; margin-bottom: 8px;">📋 {{ pendingBlueprint.title }} (共 {{ pendingBlueprint.slides?.length || 0 }} 頁)</div>
          <div v-if="pendingInsertion" class="blueprint-insertion">📌 將插入至：{{ pendingInsertion.label }}（原有投影片會保留）</div>
          
          <div class="blueprint-slides-preview">
            <div class="slide-card" v-for="(slide, i) in pendingBlueprint.slides" :key="i">
              <div class="slide-card-header">
                <span class="slide-page">P{{ slide.page_number || (i + 1) }}</span>
              </div>
              <div class="slide-card-title">{{ slide.title || '（無標題）' }}</div>
              <div class="slide-card-subtitle" v-if="slide.subtitle">{{ slide.subtitle }}</div>
              
              <ul class="slide-card-points" v-if="slide.content_points && slide.content_points.length">
                <li v-for="(pt, j) in slide.content_points" :key="j">{{ pt }}</li>
              </ul>
              
              <div class="slide-card-desc" v-if="slide.visual_or_chart_desc">
                🎨 {{ slide.visual_or_chart_desc }}
              </div>
              <div class="slide-card-theme" v-if="slide.color_theme">
                🖌️ {{ slide.color_theme }}
              </div>
            </div>
          </div>
        </div>
        <Button type="primary" class="confirm-btn" :disabled="loading" @click="confirmGenerate">
          {{ pendingInsertion ? '➕ 確認插入投影片' : '🚀 確認生成簡報' }}
        </Button>
      </div>

      <div class="send">
        <!-- 已附加的檔案標籤 -->
        <div class="attached-file" v-if="attachedFile">
          <span class="file-icon">📎</span>
          <span class="file-name">{{ attachedFile.name }}</span>
          <button class="remove-btn" @click="removeAttachment" title="移除附件">❌</button>
        </div>

        <!-- 隱藏的 file input，支援多種格式 -->
        <input 
          type="file" 
          ref="fileInputRef"
          accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style="display: none"
          @change="handleFileSelect"
        />

        <TextArea 
          v-model:value="prompt"
          :padding="8"
          placeholder="例如：把標題改成藍色、字體放大，或貼上主題後點生成..."
          :rows="3"
          @enter="handlePromptEnter"
        />
        <div class="footer">
          <button class="attach-btn" @click="clearMessages" title="清空對話" :disabled="loading || messages.length === 0">
            <i-icon-park-outline:delete style="color: #666; font-size: 16px;" />
          </button>
          <button class="attach-btn" @click="triggerFileInput" title="上傳附件（PDF、DOCX、TXT、MD）" :disabled="loading">
            📎
          </button>
          <Button type="primary" class="btn" :disabled="loading || (!prompt && !attachedFile)" @click="sendPrompt()">
            <i-icon-park-outline:send /> 送出
          </Button>
        </div>
      </div>
    </div>
  </MoveablePanel>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import { aiApiUrl } from '@/utils/aiApi'
import { useMainStore, useSlidesStore, useSnapshotStore } from '@/store'
import useImport from '@/hooks/useImport'
import useDynamicAIPPT from '@/hooks/useDynamicAIPPT'
import { DATAECO_TEMPLATE_PROMPT, isDataEcoTemplateRequest } from '@/configs/dataecoTemplateCatalog'

import MoveablePanel from '@/components/MoveablePanel.vue'
import TextArea from '@/components/TextArea.vue'
import Button from '@/components/Button.vue'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const { currentSlide, slides } = storeToRefs(slidesStore)
const { aiElementEditRequest } = storeToRefs(mainStore)
const { importPPTXFile } = useImport()

const prompt = ref('')
const loading = ref(false)
const attachedFile = ref<File | null>(null)
// Keep the original source attached through the one allowed requirement
// follow-up. Previously it was cleared after the first request, so a reply
// such as "1A 2B 3C 4D" reached the Navigator with no PDF/DOCX/TXT/MD text.
const requirementSourceFile = ref<File | null>(null)
const chatRef = useTemplateRef<HTMLElement>('chatRef')
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

/** 待確認的簡報藍圖（來自後端 generate 意圖），等使用者點擊確認後才送去 /api/generate-pptx */
const pendingBlueprint = ref<any>(null)
const awaitingRequirementReply = ref(false)

interface PendingInsertion {
  /** Array.splice 使用的零起點插入位置 */
  index: number
  label: string
  /** Number of new slides requested; this is never the final deck length. */
  count: number
}

/** 僅在「加頁／插入」需求時啟用；完整生成仍維持覆蓋整份簡報的既有行為。 */
const pendingInsertion = ref<PendingInsertion | null>(null)
// Preserve an insertion target through a requirements follow-up. Without this
// state, the short answer (for example "DD 國泰") looked like a fresh request
// and the server was allowed to regenerate an entire deck.
const requirementInsertion = ref<PendingInsertion | null>(null)

interface Message {
  role: 'user' | 'assistant'
  content: string
}
const messages = ref<Message[]>([])
const elementEditTargetId = ref('')

// A follow-up such as「在第四頁後新增文獻探討時間軸」has no attachment
// payload any more. Send a compact digest of the current deck so the new
// page continues the actual report instead of inventing generic milestones.
const stripDeckHtml = (value: unknown) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildDeckContext = () => slides.value.slice(0, 30).map((slide: any, index: number) => {
  const parts = (slide?.elements || []).flatMap((element: any) => {
    if (['title', 'subtitle', 'text'].includes(element?.type)) return [stripDeckHtml(element.content)]
    if (element?.type === 'bullets') return Array.isArray(element.content) ? element.content.map(stripDeckHtml) : []
    if (element?.type === 'card') return [stripDeckHtml(element.content?.title), stripDeckHtml(element.content?.text)]
    if (element?.type === 'table') return [
      ...(element?.data?.rows || []).flatMap((row: any) => Array.isArray(row) ? row.map(stripDeckHtml) : []),
    ]
    return []
  }).filter(Boolean).slice(0, 24)
  return `投影片 ${index + 1}：${parts.join('；')}`
}).filter((line: string) => line !== '投影片 ：').join('\n').slice(0, 30000)

const scrollToBottom = () => {
  if (chatRef.value) {
    chatRef.value.scrollTop = chatRef.value.scrollHeight
  }
}

const clearMessages = () => {
  messages.value = []
  pendingBlueprint.value = null
  pendingInsertion.value = null
  requirementInsertion.value = null
  attachedFile.value = null
  requirementSourceFile.value = null
  prompt.value = ''
  awaitingRequirementReply.value = false
}

/**
 * 判定是否為在既有簡報中插入投影片的需求，並解析常見的位置描述。
 * 只接受明確的「新增／多加／插入」語意，以免把「重新生成 5 頁」誤當成插頁。
 */
const detectSlideInsertion = (text: string): PendingInsertion | null => {
  if (slides.value.length === 0) return null

  const normalized = text.replace(/\s+/g, '')
  // Deterministic fast path for a precise insertion target. It runs before
  // heuristic intent matching so a command such as「第七頁後面新增」cannot
  // silently fall through to the last-slide default.
  const explicitAfterPage = normalized.match(/\u7b2c([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\d]+)\u9801(?:\u5f8c\u9762|\u5f8c)/)
  const ordinalMap: Record<string, number> = {
    '\u4e00': 1, '\u4e8c': 2, '\u4e09': 3, '\u56db': 4, '\u4e94': 5,
    '\u516d': 6, '\u4e03': 7, '\u516b': 8, '\u4e5d': 9, '\u5341': 10,
  }
  if (explicitAfterPage && /(?:\u65b0\u589e|\u52a0|\u63d2\u5165)/.test(normalized)) {
    const page = Number(explicitAfterPage[1]) || ordinalMap[explicitAfterPage[1]] || 0
    if (page > 0) return { index: Math.min(page, slides.value.length), label: `第${page} 頁後`, count: 1 }
  }
  const countToken = normalized.match(/(?:新增|增加|多加|插入|加上|加)([一二三四五六七八九十\d]+)頁/)?.[1] || '一'
  const chineseCounts: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  const requestedCount = Math.min(10, Math.max(1, Number(countToken) || chineseCounts[countToken] || 1))
  const parsePageToken = (token: string) => Number(token) || chineseCounts[token] || 0
  const isAddRequest = /(?:再)?(?:多加|新增|增加|插入|加上|加).{0,12}(?:一|1|幾)?頁/.test(normalized)
    || (/(?:目錄|toc)/i.test(normalized) && /(?:封面後|第\d+頁[前後]|最前面|開頭|最後|結尾)/.test(normalized))
  const isFullDeckRequest = /(?:重新|整份|全部|完整).{0,8}(?:生成|製作|建立)/.test(normalized)
  if (!isAddRequest || isFullDeckRequest) return null

  if (/(?:封面後|第1頁後)/.test(normalized)) return { index: Math.min(1, slides.value.length), label: '封面後', count: requestedCount }
  if (/(?:最前面|開頭|第一頁前)/.test(normalized)) return { index: 0, label: '簡報開頭', count: requestedCount }
  if (/(?:最後|結尾|末尾)/.test(normalized)) return { index: slides.value.length, label: '簡報最後', count: requestedCount }

  // 支援「第二頁後面」這類中文序數與口語位置；未辨識位置才採用目前頁後。
  const afterMatch = normalized.match(/第([一二三四五六七八九十\d]+)頁(?:後面|後)/)
  if (afterMatch) {
    const page = parsePageToken(afterMatch[1])
    if (page > 0) {
      return { index: Math.min(page, slides.value.length), label: `第 ${page} 頁後`, count: requestedCount }
    }
  }

  const beforeMatch = normalized.match(/第([一二三四五六七八九十\d]+)頁(?:前面|前)/)
  if (beforeMatch) {
    const page = parsePageToken(beforeMatch[1])
    if (page > 0) {
      return { index: Math.min(Math.max(page - 1, 0), slides.value.length), label: `第 ${page} 頁前`, count: requestedCount }
    }
  }

  return { index: Math.min(slidesStore.slideIndex + 1, slides.value.length), label: '目前投影片後', count: requestedCount }
}

/**
 * 一般「生成簡報」在已有內容時預設追加，避免任何新生成覆蓋使用者既有成果。
 * 新檔案的單張空白起始頁則會直接被第一份生成內容取代。
 */
const shouldAppendGeneratedSlides = (text: string): boolean => {
  const hasOnlyBlankStarterSlide = slides.value.length === 1 && (slides.value[0]?.elements?.length || 0) === 0
  if (slides.value.length === 0 || hasOnlyBlankStarterSlide) return false

  const normalized = text.replace(/\s+/g, '')
  return !/(?:重新生成|覆蓋|取代|重做|清空後生成|全新取代)/.test(normalized)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    attachedFile.value = file
  }
  // 清除 input value，讓下次選同一檔案也能觸發 change
  target.value = ''
}

const removeAttachment = () => {
  attachedFile.value = null
  requirementSourceFile.value = null
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

/** 使用者確認藍圖，直接在前端使用動態引擎生成原生 JSON 畫布並匯入 */
const confirmGenerate = async () => {
  if (!pendingBlueprint.value || loading.value) return
  loading.value = true

  try {
    const { generateDynamicSlides } = useDynamicAIPPT()
    const generatedSlides = generateDynamicSlides(pendingBlueprint.value)

    if (generatedSlides && generatedSlides.length > 0) {
      const insertion = pendingInsertion.value
      // Client-side final guard: insertion can never append a regenerated
      // deck, even if a remote backend is running an older release.
      const insertionSlides = insertion ? generatedSlides.slice(0, insertion.count) : generatedSlides
      const existingSlideCount = slides.value.length
      if (insertion) {
        const insertionIndex = Math.min(Math.max(insertion.index, 0), existingSlideCount)
        const nextSlides = [...slides.value]
        nextSlides.splice(insertionIndex, 0, ...insertionSlides)
        slidesStore.setSlides(nextSlides)
        slidesStore.updateSlideIndex(insertionIndex)
      } else {
        // 完整簡報生成：維持原有的覆蓋行為。
        slidesStore.updateSlideIndex(0)
        slidesStore.setSlides(generatedSlides)
      }
      snapshotStore.addSnapshot()
      
      pendingBlueprint.value = null
      pendingInsertion.value = null
      requirementInsertion.value = null
      messages.value.push({
        role: 'assistant',
        content: insertion
          ? `✅ 已插入 ${insertionSlides.length} 頁至${insertion.label}`
          : `✅ 已完成 (共 ${generatedSlides.length} 頁)`,
      })
    } else {
      throw new Error('生成的畫布資料為空')
    }
  } catch (err: any) {
    console.error('[AICopilot] confirmGenerate 失敗', err)
    messages.value.push({ role: 'assistant', content: '❌ 生成失敗：' + (err.message || '未知錯誤') })
  } finally {
    loading.value = false
    nextTick(scrollToBottom)
  }
}

/** 取消待確認的藍圖 */
const cancelGenerate = () => {
  pendingBlueprint.value = null
  pendingInsertion.value = null
  requirementInsertion.value = null
  awaitingRequirementReply.value = false
  requirementSourceFile.value = null
  messages.value.push({ role: 'assistant', content: '已取消生成。您可以修改需求後重新輸入。' })
  nextTick(scrollToBottom)
}

// Enter sends the request; Shift+Enter retains the textarea's native newline.
const handlePromptEnter = (event: KeyboardEvent) => {
  if (event.shiftKey) return
  event.preventDefault()
  sendPrompt()
}

const sendPrompt = async () => {
  if ((!prompt.value.trim() && !attachedFile.value) || loading.value) return

  const userText = prompt.value.trim()
  const newlyAttachedFile = attachedFile.value

  // 【修正】若目前有待確認的藍圖，使用者的輸入視為對藍圖的修改意見，
  // 應強制以 'generate' 意圖重新規劃藍圖，而非修改當前投影片
  const isBlueprintFeedback = !!pendingBlueprint.value
  const explicitInsertion = detectSlideInsertion(userText)
  if (explicitInsertion && !isBlueprintFeedback) requirementInsertion.value = explicitInsertion
  const insertionRequest = isBlueprintFeedback
    ? pendingInsertion.value
    : explicitInsertion || (awaitingRequirementReply.value ? requirementInsertion.value : null) || (shouldAppendGeneratedSlides(userText)
      ? { index: slides.value.length, label: '簡報最後', count: 1 }
      : null)

  // 逃生出口：若在等待問卷回答時，輸入了明顯的編輯指令，則自動放棄問卷狀態，恢復一般 AI 判斷流程
  if (!isBlueprintFeedback && awaitingRequirementReply.value) {
    const editKeywords = ['幫我改', '幫我刪', '這頁', '排版', '標題改成', '幫我加']
    const isEditLike = editKeywords.some(kw => userText.includes(kw))
    if (isEditLike) {
      awaitingRequirementReply.value = false
      console.log('[AICopilot] 偵測到明確的編輯動詞，自動退出問卷等待狀態')
    }
  }
  const isRequirementFollowup = !isBlueprintFeedback && awaitingRequirementReply.value
  const fileToSend = newlyAttachedFile || (isRequirementFollowup ? requirementSourceFile.value : null)
  if (newlyAttachedFile && !isRequirementFollowup) requirementSourceFile.value = newlyAttachedFile

  // 顯示使用者訊息
  const displayText = newlyAttachedFile
    ? (userText ? `${userText}\n📎 ${newlyAttachedFile.name}` : `📎 ${newlyAttachedFile.name}`)
    : userText

  prompt.value = ''
  attachedFile.value = null
  // 若是對藍圖的修改意見，先保留 pendingBlueprint（等收到新藍圖後再替換）
  if (!isBlueprintFeedback) {
    pendingBlueprint.value = null
    pendingInsertion.value = null
  }
  messages.value.push({ role: 'user', content: displayText })
  loading.value = true
  nextTick(scrollToBottom)

  try {
    let response: any

    const isAwaitingReply = isBlueprintFeedback || awaitingRequirementReply.value
    const isTargetedElementEdit = !!elementEditTargetId.value
    let finalPrompt = fileToSend ? (userText || '請根據這份文件的內容，幫我生成一份完整的簡報') : userText

    if (isTargetedElementEdit) {
      finalPrompt = `【AI 元件修正】只可修改目前投影片中 id 為「${elementEditTargetId.value}」的元件。其他所有元件、投影片背景與版面都必須完全保留。\n使用者要求：${userText}`
    }

    // 藍圖修改意見：在 prompt 前補充「修改藍圖」的系統提示，讓後端清楚脈絡
    if (isBlueprintFeedback) {
      finalPrompt = `（使用者對以下藍圖提出了修改意見，請根據意見重新規劃藍圖，不要修改投影片）\n使用者意見：${userText}`
    } else if (!isAwaitingReply) {
      const pageInfo = `\n\n(系統備註：如果這是一個修改現有簡報的指令，請注意目前處理的是第 ${slidesStore.slideIndex + 1} 頁，簡報總共 ${slides.value.length} 頁；如果是閒聊或回答生成相關問題，請完全忽略此備註)`
      finalPrompt += pageInfo
    }

    if (insertionRequest) {
      finalPrompt += `\n\n【系統指令：插入模式】目前簡報共有 ${slides.value.length} 頁。此需求是在既有簡報中新增投影片，請只生成使用者要求的新頁面，不要重做、覆蓋或重複既有投影片；確認後前端會將新頁插入「${insertionRequest.label}」。`
    }

    // 使用者在 prompt 指定國泰／DataEco 時，將可用版型與插槽一併送到
    // 生成管線，讓 AI 選擇真正的版型而非只模仿綠色色票。
    if (isDataEcoTemplateRequest(userText) || (isBlueprintFeedback && pendingBlueprint.value?.brandProfile === 'dataeco')) {
      finalPrompt += `\n\n【DataEco 模板庫】請將每頁的 templateId 設為下列其中一項，並依該版型的可填欄位安排內容；若使用者指定圖表或表格，只能選擇支援該內容的版型。\n${DATAECO_TEMPLATE_PROMPT}`
    }

    if (fileToSend) {
      // 有附件時使用 FormData 格式
      const formData = new FormData()
      formData.append('file', fileToSend)
      formData.append('prompt', finalPrompt)
      formData.append('requirementPrompt', userText)
      formData.append('slideData', JSON.stringify(currentSlide.value))
      formData.append('deckContext', buildDeckContext())
      formData.append('chatHistory', JSON.stringify(messages.value))
      if (insertionRequest) {
        formData.append('insertionMode', 'true')
        formData.append('requestedInsertCount', String(insertionRequest.count))
      }
      if (isTargetedElementEdit) {
        formData.append('forceIntent', 'edit')
      } else if (isAwaitingReply) {
        formData.append('forceIntent', 'generate')
      }
      if (isRequirementFollowup) {
        formData.append('requirementFollowup', 'true')
      }
      if (isBlueprintFeedback) {
        formData.append('blueprintFeedback', 'true')
      }
      
      response = await axios.post(aiApiUrl('/api/edit'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } else {
      // 無附件時沿用原本的 JSON 格式
      const payload: any = {
        prompt: finalPrompt,
        requirementPrompt: userText,
        slideData: currentSlide.value,
        deckContext: buildDeckContext(),
        chatHistory: messages.value,
      }
      if (insertionRequest) {
        payload.insertionMode = true
        payload.requestedInsertCount = insertionRequest.count
      }
      if (isTargetedElementEdit) {
        payload.forceIntent = 'edit'
      } else if (isAwaitingReply) {
        payload.forceIntent = 'generate'
      }
      if (isRequirementFollowup) {
        payload.requirementFollowup = true
      }
      if (isBlueprintFeedback) {
        payload.blueprintFeedback = true
      }
      response = await axios.post(aiApiUrl('/api/edit'), payload)
    }

    if (response.data && response.data.success) {
      const intent = response.data.intent
      
      if (intent === 'chat') {
        messages.value.push({ 
          role: 'assistant', 
          content: response.data.reply || '你好！請問需要幫忙嗎？' 
        })
      } else if (intent === 'ask_for_clarification') {
        if (response.data.flow === 'requirement_navigator') {
          awaitingRequirementReply.value = true
        }
        const questionText = (response.data.questions || []).map((q: string) => '• ' + q).join('\n')
        const sourceMeta = response.data.sourceMeta
        // Keep the conversation compact. The attachment itself remains the
        // source of truth on the server, so title/character diagnostics do
        // not need to be shown to the user here.
        const sourceReadText = sourceMeta
          ? `\n\n📎 已讀取附件：${sourceMeta.fileName}`
          : ''
        messages.value.push({ 
          role: 'assistant', 
          content: '為了給您最完美的簡報，請幫我補充以下資訊：\n' + questionText + sourceReadText
        })

      } else if (intent === 'edit') {
        const updatedSlide = response.data.slide
        snapshotStore.addSnapshot()
        // The user may navigate away while AI is working. Update the slide
        // returned by the server, never whichever slide is currently visible.
        slidesStore.updateSlide(updatedSlide, updatedSlide.id)
        messages.value.push({ role: 'assistant', content: '✅ 已為您修改本頁投影片！' })

      } else if (intent === 'edit_specific_page') {
        const targetPage = response.data.targetPage
        const targetPageIndex = Number(targetPage) - 1
        
        if (typeof targetPageIndex === 'number' && targetPageIndex >= 0 && targetPageIndex < slides.value.length) {
          messages.value.push({ 
            role: 'assistant', 
            content: `🔄 正在為您修改第 ${targetPage} 頁...` 
          })
          const progressMsgIndex = messages.value.length - 1
          
          const targetSlide = slides.value[targetPageIndex]
          const instruction = response.data.instruction || userText
          
          const editPayload: any = {
            prompt: instruction + `\n\n(系統備註：目前處理的是第 ${targetPage} 頁，簡報總共 ${slides.value.length} 頁。若使用者要求加上頁碼，請根據此資訊正確填寫)`,
            slideData: targetSlide,
            chatHistory: [],
            forceIntent: 'edit'
          }
          
          try {
            const res = await axios.post(aiApiUrl('/api/edit'), editPayload)
            if (res.data && res.data.success && res.data.slide) {
               snapshotStore.addSnapshot()
               slidesStore.updateSlide(res.data.slide, res.data.slide.id)
               slidesStore.updateSlideIndex(targetPageIndex)
               messages.value[progressMsgIndex].content = `✅ 已為您修改第 ${targetPage} 頁，並已自動為您切換至該頁！`
            }
          } catch (e) {
             messages.value[progressMsgIndex].content = `❌ 第 ${targetPage} 頁修改失敗`
          }
        } else {
          messages.value.push({ role: 'assistant', content: `❌ 找不到第 ${targetPage} 頁，請確認您的簡報是否有這一頁。` })
        }

      } else if (intent === 'batch_edit') {
        const instruction = response.data.instruction || userText
        const totalSlides = slides.value.length
        
        messages.value.push({ 
          role: 'assistant', 
          content: `🔄 正在為您逐頁修改中 (0/${totalSlides})...` 
        })
        const progressMsgIndex = messages.value.length - 1
        snapshotStore.addSnapshot()
        
        // 非同步分批迴圈
        for (let i = 0; i < totalSlides; i++) {
          const slide = slides.value[i]
          messages.value[progressMsgIndex].content = `🔄 正在為您逐頁修改中 (${i + 1}/${totalSlides})...`
          
          const batchPayload: any = {
            prompt: instruction + `\n\n(系統備註：目前處理的是第 ${i + 1} 頁，簡報總共 ${totalSlides} 頁。若使用者要求加上頁碼，請根據此資訊正確填寫)`,
            slideData: slide,
            chatHistory: [],
            forceIntent: 'edit'
          }
          
          try {
            const res = await axios.post(aiApiUrl('/api/edit'), batchPayload)
            if (res.data && res.data.success && res.data.slide) {
              slidesStore.updateSlide(res.data.slide, res.data.slide.id)
            }
          } catch (e) {
            console.error(`第 ${i + 1} 頁修改失敗`, e)
          }
        }
        
        messages.value[progressMsgIndex].content = '✅ 修改完成！'

      } else if (intent === 'generate') {
        awaitingRequirementReply.value = false
        requirementSourceFile.value = null
        // ---- 新架構：收到 blueprint，顯示摘要等待使用者確認 ----
        const blueprint = response.data.blueprint
        // 以新藍圖取代舊的（包含使用者對藍圖提出修改意見後重新生成的情況）
        pendingBlueprint.value = blueprint
        pendingInsertion.value = insertionRequest
        requirementInsertion.value = null

        const slideCount = blueprint?.slides?.length || 0
        const typeLabels: Record<string, string> = {
          cover: '封面', toc: '目錄', content: '內容', chart: '圖表', stats: '數據亮點', end: '結尾'
        }
        const slideTypes = (blueprint?.slides || [])
          .map((s: any) => typeLabels[s.type] || s.type)
          .join('、')

        const isRevision = isBlueprintFeedback
        messages.value.push({
          role: 'assistant',
          content: isRevision
            ? `✨ 藍圖已依您的意見修改完成！\n\n📋 標題：${blueprint?.title || '（未命名）'}\n📄 共 ${slideCount} 頁：${slideTypes}\n\n請確認是否符合需求，或繼續提出修改，滿意後點擊「確認生成簡報」。`
            : `✨ 藍圖規劃完成！\n\n📋 標題：${blueprint?.title || '（未命名）'}\n📄 共 ${slideCount} 頁：${slideTypes}\n\n請點擊下方「確認生成簡報」按鈕，AI 已為您規劃好版面，匯入畫布後即可預覽。`,
        })
      }
    } else {
      throw new Error(response.data.error || '未知的錯誤')
    }
  } catch (err: any) {
    console.error('AI 編輯失敗', err)
    messages.value.push({ role: 'assistant', content: '❌ 編輯失敗：' + (err.response?.data?.error || err.message) })
  } finally {
    elementEditTargetId.value = ''
    loading.value = false
    nextTick(scrollToBottom)
  }
}

watch(aiElementEditRequest, request => {
  if (!request || loading.value) return
  elementEditTargetId.value = request.elementId
  prompt.value = request.instruction
  mainStore.setAIElementEditRequest(null)
  nextTick(() => sendPrompt())
}, { immediate: true })

const close = () => {
  mainStore.setAICopilotPanelState(false)
}
</script>

<style lang="scss" scoped>
.ai-copilot-panel {
  height: 100%;
  font-size: 13px;
}
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.chat-history {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background-color: #f7f9fa;
  border-bottom: 1px solid #eee;

  .empty {
    color: #999;
    text-align: center;
    margin-top: 40px;
    line-height: 1.8;
    font-size: 12px;
  }
}
.message {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: #e1e1e1;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    margin-right: 10px;
    flex-shrink: 0;
  }

  .bubble {
    background-color: #fff;
    padding: 10px 14px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    max-width: 85%;
    line-height: 1.4;
    word-break: break-word;
    white-space: pre-wrap;
  }

  &.user {
    flex-direction: row-reverse;

    .avatar {
      margin-right: 0;
      margin-left: 10px;
      background-color: $themeColor;
      color: #fff;
    }

    .bubble {
      background-color: #e6f7ff;
      color: #333;
    }
  }

  &.assistant {
    .avatar {
      background-color: #6a1b9a;
      color: #fff;
    }
  }
}

// 藍圖確認區塊
.blueprint-confirm {
  padding: 10px 12px;
  background: linear-gradient(135deg, #f0f4ff 0%, #fdf0ff 100%);
  border-top: 1px solid #d8c9f5;
  border-bottom: 1px solid #d8c9f5;

  .blueprint-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;

    .blueprint-icon {
      font-size: 16px;
    }

    .blueprint-title {
      flex: 1;
      font-weight: 600;
      font-size: 12px;
      color: #4a1f8c;
    }

    .cancel-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #999;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.2s, background 0.2s;

      &:hover {
        color: #e53e3e;
        background: rgba(229, 62, 62, 0.08);
      }
    }
  }

  .blueprint-meta {
    font-size: 11px;
    color: #5a4a7a;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;

    .blueprint-insertion {
      margin: -2px 0 8px;
      padding: 6px 8px;
      color: #25683e;
      background: #eaf8ef;
      border: 1px solid #b9e4c6;
      border-radius: 5px;
      line-height: 1.4;
    }

    .blueprint-slides-preview {
      max-height: 250px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;

      &::-webkit-scrollbar {
        width: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
      }

      .slide-card {
        background: #fff;
        border: 1px solid #d8c9f5;
        border-radius: 6px;
        padding: 8px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);

        .slide-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          .slide-page {
            background: #4a1f8c;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: bold;
          }

          .slide-type {
            font-size: 10px;
            color: #888;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
          }
        }

        .slide-card-title {
          font-weight: bold;
          font-size: 12px;
          color: #333;
          margin-bottom: 2px;
        }

        .slide-card-subtitle {
          font-size: 11px;
          color: #666;
          margin-bottom: 6px;
        }

        .slide-card-points {
          margin: 4px 0 6px 16px;
          padding: 0;
          color: #555;
          font-size: 11px;
          
          li {
            margin-bottom: 2px;
          }
        }

        .slide-card-desc, .slide-card-theme {
          font-size: 10px;
          color: #028090;
          background: #f0fbfe;
          padding: 3px 6px;
          border-radius: 4px;
          margin-top: 4px;
        }
        
        .slide-card-theme {
          color: #b85042;
          background: #fef0ef;
        }
      }
    }
  }

  .confirm-btn {
    width: 100%;
    font-size: 13px;
    font-weight: 600;
  }
}

.send {
  padding: 10px 12px 12px;
  background-color: #fff;

  .attached-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    margin-bottom: 8px;
    background-color: #f0f5ff;
    border: 1px solid #b3d1ff;
    border-radius: 6px;
    font-size: 12px;
    color: #1a6fd4;

    .file-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 11px;
      padding: 0;
      opacity: 0.6;
      flex-shrink: 0;
      line-height: 1;

      &:hover {
        opacity: 1;
      }
    }
  }

  .footer {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;

    .attach-btn {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      background: #f4f4f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: #e8e8ea;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .btn {
      flex: 1;
    }
  }
}
.loading-dots {
  color: #888;
  font-style: italic;
}
</style>
