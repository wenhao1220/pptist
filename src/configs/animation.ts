import type { TurningMode } from '@/types/slides'

export const ANIMATION_DEFAULT_DURATION = 1000
export const ANIMATION_DEFAULT_TRIGGER = 'click'
export const ANIMATION_CLASS_PREFIX = 'animate__'

export const ENTER_ANIMATIONS = [
  {
    type: 'bounce',
    name: '彈跳',
    children: [
      { name: '彈入', value: 'bounceIn' },
      { name: '向右彈入', value: 'bounceInLeft' },
      { name: '向左彈入', value: 'bounceInRight' },
      { name: '向上彈入', value: 'bounceInUp' },
      { name: '向下彈入', value: 'bounceInDown' },
    ],
  },
  {
    type: 'fade',
    name: '浮現',
    children: [
      { name: '浮入', value: 'fadeIn' },
      { name: '向下浮入', value: 'fadeInDown' },
      { name: '向下長距浮入', value: 'fadeInDownBig' },
      { name: '向右浮入', value: 'fadeInLeft' },
      { name: '向右長距浮入', value: 'fadeInLeftBig' },
      { name: '向左浮入', value: 'fadeInRight' },
      { name: '向左長距浮入', value: 'fadeInRightBig' },
      { name: '向上浮入', value: 'fadeInUp' },
      { name: '向上長距浮入', value: 'fadeInUpBig' },
      { name: '從左上浮入', value: 'fadeInTopLeft' },
      { name: '從右上浮入', value: 'fadeInTopRight' },
      { name: '從左下浮入', value: 'fadeInBottomLeft' },
      { name: '從右下浮入', value: 'fadeInBottomRight' },
    ],
  },
  {
    type: 'rotate',
    name: '旋轉',
    children: [
      { name: '旋轉進入', value: 'rotateIn' },
      { name: '繞左下進入', value: 'rotateInDownLeft' },
      { name: '繞右下進入', value: 'rotateInDownRight' },
      { name: '繞左上進入', value: 'rotateInUpLeft' },
      { name: '繞右上進入', value: 'rotateInUpRight' },
    ],
  },
  {
    type: 'zoom',
    name: '縮放',
    children: [
      { name: '放大進入', value: 'zoomIn' },
      { name: '向下放大進入', value: 'zoomInDown' },
      { name: '從左放大進入', value: 'zoomInLeft' },
      { name: '從右放大進入', value: 'zoomInRight' },
      { name: '向上放大進入', value: 'zoomInUp' },
    ],
  },
  {
    type: 'slide',
    name: '滑入',
    children: [
      { name: '向下滑入', value: 'slideInDown' },
      { name: '從右滑入', value: 'slideInLeft' },
      { name: '從左滑入', value: 'slideInRight' },
      { name: '向上滑入', value: 'slideInUp' },
    ],
  },
  {
    type: 'flip',
    name: '翻轉',
    children: [
      { name: 'X軸翻轉進入', value: 'flipInX' },
      { name: 'Y軸翻轉進入', value: 'flipInY' },
    ],
  },
  {
    type: 'back',
    name: '放大滑入',
    children: [
      { name: '向下放大滑入', value: 'backInDown' },
      { name: '從左放大滑入', value: 'backInLeft' },
      { name: '從右放大滑入', value: 'backInRight' },
      { name: '向上放大滑入', value: 'backInUp' },
    ],
  },
  {
    type: 'lightSpeed',
    name: '飛入',
    children: [
      { name: '從右飛入', value: 'lightSpeedInRight' },
      { name: '從左飛入', value: 'lightSpeedInLeft' },
    ],
  },
]

export const EXIT_ANIMATIONS = [
  {
    type: 'bounce',
    name: '彈跳',
    children: [
      { name: '彈出', value: 'bounceOut' },
      { name: '向左彈出', value: 'bounceOutLeft' },
      { name: '向右彈出', value: 'bounceOutRight' },
      { name: '向上彈出', value: 'bounceOutUp' },
      { name: '向下彈出', value: 'bounceOutDown' },
    ],
  },
  {
    type: 'fade',
    name: '浮現',
    children: [
      { name: '浮出', value: 'fadeOut' },
      { name: '向下浮出', value: 'fadeOutDown' },
      { name: '向下長距浮出', value: 'fadeOutDownBig' },
      { name: '向左浮出', value: 'fadeOutLeft' },
      { name: '向左長距浮出', value: 'fadeOutLeftBig' },
      { name: '向右浮出', value: 'fadeOutRight' },
      { name: '向右長距浮出', value: 'fadeOutRightBig' },
      { name: '向上浮出', value: 'fadeOutUp' },
      { name: '向上長距浮出', value: 'fadeOutUpBig' },
      { name: '從左上浮出', value: 'fadeOutTopLeft' },
      { name: '從右上浮出', value: 'fadeOutTopRight' },
      { name: '從左下浮出', value: 'fadeOutBottomLeft' },
      { name: '從右下浮出', value: 'fadeOutBottomRight' },
    ],
  },
  {
    type: 'rotate',
    name: '旋轉',
    children: [
      { name: '旋轉退出', value: 'rotateOut' },
      { name: '繞左下退出', value: 'rotateOutDownLeft' },
      { name: '繞右下退出', value: 'rotateOutDownRight' },
      { name: '繞左上退出', value: 'rotateOutUpLeft' },
      { name: '繞右上退出', value: 'rotateOutUpRight' },
    ],
  },
  {
    type: 'zoom',
    name: '縮放',
    children: [
      { name: '縮小退出', value: 'zoomOut' },
      { name: '向下縮小退出', value: 'zoomOutDown' },
      { name: '從左縮小退出', value: 'zoomOutLeft' },
      { name: '從右縮小退出', value: 'zoomOutRight' },
      { name: '向上縮小退出', value: 'zoomOutUp' },
    ],
  },
  {
    type: 'slide',
    name: '滑出',
    children: [
      { name: '向下滑出', value: 'slideOutDown' },
      { name: '從左滑出', value: 'slideOutLeft' },
      { name: '從右滑出', value: 'slideOutRight' },
      { name: '向上滑出', value: 'slideOutUp' },
    ],
  },
  {
    type: 'flip',
    name: '翻轉',
    children: [
      { name: 'X軸翻轉退出', value: 'flipOutX' },
      { name: 'Y軸翻轉退出', value: 'flipOutY' },
    ],
  },
  {
    type: 'back',
    name: '縮小滑出',
    children: [
      { name: '向下縮小滑出', value: 'backOutDown' },
      { name: '從左縮小滑出', value: 'backOutLeft' },
      { name: '從右縮小滑出', value: 'backOutRight' },
      { name: '向上縮小滑出', value: 'backOutUp' },
    ],
  },
  {
    type: 'lightSpeed',
    name: '飛出',
    children: [
      { name: '從右飛出', value: 'lightSpeedOutRight' },
      { name: '從左飛出', value: 'lightSpeedOutLeft' },
    ],
  },
]

export const ATTENTION_ANIMATIONS = [
  {
    type: 'shake',
    name: '晃動',
    children: [
      { name: '左右搖晃', value: 'shakeX' },
      { name: '上下搖晃', value: 'shakeY' },
      { name: '搖頭', value: 'headShake' },
      { name: '擺動', value: 'swing' },
      { name: '晃動', value: 'wobble' },
      { name: '驚恐', value: 'tada' },
      { name: '果凍', value: 'jello' },
    ],
  },
  {
    type: 'other',
    name: '其他',
    children: [
      { name: '彈跳', value: 'bounce' },
      { name: '閃爍', value: 'flash' },
      { name: '脈搏', value: 'pulse' },
      { name: '橡皮筋', value: 'rubberBand' },
      { name: '心跳（快）', value: 'heartBeat' },
    ],
  },
]

interface SlideAnimation {
  label: string
  value: TurningMode
}

export const SLIDE_ANIMATIONS: SlideAnimation[] = [
  { label: '無', value: 'no' },
  { label: '隨機', value: 'random' },
  { label: '左右推移', value: 'slideX' },
  { label: '上下推移', value: 'slideY' },
  { label: '左右推移（3D）', value: 'slideX3D' },
  { label: '上下推移（3D）', value: 'slideY3D' },
  { label: '淡入淡出', value: 'fade' },
  { label: '旋轉', value: 'rotate' },
  { label: '上下展開', value: 'scaleY' },
  { label: '左右展開', value: 'scaleX' },
  { label: '放大', value: 'scale' },
  { label: '縮小', value: 'scaleReverse' },
]