import { defineStore } from 'pinia'

export interface ScreenState {
  screening: boolean
}

export const useScreenStore = defineStore('screen', {
  state: (): ScreenState => ({
    screening: false, // 是否進入放映狀態
  }),

  actions: {
    setScreening(screening: boolean) {
      this.screening = screening
    },
  },
})