<template>
  <div class="export-pptx-dialog">
    <div class="thumbnails-view">
      <div class="thumbnails" ref="imageThumbnailsRef">
        <ThumbnailSlide 
          class="export-thumbnail" 
          v-for="slide in renderSlides" 
          :key="slide.id" 
          :slide="slide" 
          :size="1600" 
        />
      </div>
    </div>
    <div class="configs">
      <div class="row">
        <div class="title">匯出範圍：</div>
        <RadioGroup
          class="config-item"
          v-model:value="rangeType"
        >
          <RadioButton style="width: 33.33%;" value="all">全部</RadioButton>
          <RadioButton style="width: 33.33%;" value="current">當前頁</RadioButton>
          <RadioButton style="width: 33.33%;" value="custom">自定義</RadioButton>
        </RadioGroup>
      </div>
      <div class="row">
        <div class="title">匯出模式：</div>
        <RadioGroup
          class="config-item"
          v-model:value="exportMode"
        >
          <RadioButton style="width: 50%;" value="standard">標準版</RadioButton>
          <RadioButton style="width: 50%;" value="image">純圖版</RadioButton>
        </RadioGroup>
      </div>
      <div class="row" style="margin-bottom: 32px" v-if="rangeType === 'custom'">
        <div class="title" :data-range="`（${range[0]} ~ ${range[1]}）`">自定義範圍：</div>
        <Slider
          class="config-item"
          range
          :min="1"
          :max="slides.length"
          :step="1"
          v-model:value="range"
        />
      </div>
      
      <template v-if="exportMode === 'standard'">
        <div class="row">
          <div class="title">忽略音訊/影片：</div>
          <div class="config-item">
            <Switch v-model:value="ignoreMedia" v-tooltip="'匯出時預設忽略音影片，若您的投影片中存在音影片元素，且希望將其匯出到PPTX檔案中，可選擇關閉「忽略音影片」選項，但要注意這將會大幅增加匯出用時。'" />
          </div>
        </div>
        <div class="row">
          <div class="title">覆蓋預設母版：</div>
          <div class="config-item">
            <Switch v-model:value="masterOverwrite" />
          </div>
        </div>

        <div class="tip" v-if="!ignoreMedia">
          提示：1. 支援匯出格式：avi、mp4、mov、wmv、mp3、wav；2. 跨域資源無法匯出。
        </div>
      </template>
    </div>
    <div class="btns">
      <Button class="btn export" type="primary" @click="execExport()"><i-icon-park-outline:download /> 匯出 PPTX</Button>
      <Button class="btn close" @click="emit('close')">關閉</Button>
    </div>

    <FullscreenSpin :loading="exporting" tip="正在匯出..." />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import useExport from '@/hooks/useExport'

import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Switch from '@/components/Switch.vue'
import Slider from '@/components/Slider.vue'
import Button from '@/components/Button.vue'
import RadioButton from '@/components/RadioButton.vue'
import RadioGroup from '@/components/RadioGroup.vue'

const emit = defineEmits<{
  (event: 'close'): void
}>()

const { slides, currentSlide } = storeToRefs(useSlidesStore())

const { exportPPTX, exportImagePPTX, exporting } = useExport()

const imageThumbnailsRef = useTemplateRef<HTMLElement>('imageThumbnailsRef')
const rangeType = ref<'all' | 'current' | 'custom'>('all')
const exportMode = ref<'standard' | 'image'>('standard')
const range = ref<[number, number]>([1, slides.value.length])
const masterOverwrite = ref(true)
const ignoreMedia = ref(true)

const selectedSlides = computed(() => {
  if (rangeType.value === 'all') return slides.value
  if (rangeType.value === 'current') return [currentSlide.value]
  return slides.value.filter((item, index) => {
    const [min, max] = range.value
    return index >= min - 1 && index <= max - 1
  })
})

const renderSlides = computed(() => {
  if (exportMode.value === 'standard') return []
  return selectedSlides.value
})

const execExport = () => {
  if (exportMode.value === 'standard') {
    exportPPTX(selectedSlides.value, masterOverwrite.value, ignoreMedia.value)
  } 
  else {
    const slideRefs = imageThumbnailsRef.value!.querySelectorAll('.export-thumbnail')
    exportImagePPTX(slideRefs)
  }
}
</script>

<style lang="scss" scoped>
.export-pptx-dialog {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.thumbnails-view {
  @include absolute-0();

  &::after {
    content: '';
    background-color: #fff;
    @include absolute-0();
  }
}
.configs {
  width: 350px;
  height: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 1;

  .row {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 25px;
  }

  .title {
    width: 100px;
    position: relative;

    &::after {
      content: attr(data-range);
      position: absolute;
      top: 20px;
      left: 0;
    }
  }
  .config-item {
    flex: 1;
  }

  .tip {
    font-size: 12px;
    color: #aaa;
    line-height: 1.8;
    margin-top: 10px;
  }
}
.btns {
  width: 300px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;

  .export {
    flex: 1;
  }
  .close {
    width: 100px;
    margin-left: 10px;
  }
}
</style>