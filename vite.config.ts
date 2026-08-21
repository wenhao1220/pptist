import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  base: '/ppt/',
  plugins: [
    vue(),
    Components({
      dirs: [],
      resolvers: [IconsResolver({ prefix: 'i', customCollections: ['custom'] })],
    }),
    Icons({
      compiler: 'vue3',
      autoInstall: false,
      customCollections: { custom: FileSystemIconLoader('src/assets/icons') },
      scale: 1,
      defaultClass: 'i-icon',
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      // Generated files may remain locked on Windows. They are not Vite source inputs.
      ignored: ['**/skills/**', '**/skill/**', '**/skills-main/**', '**/.gemini/**', '**/work/**', '**/temp_skill.bin'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // The production app is mounted below /ppt/. Keep this alias for local
      // testing and for an explicitly configured relative API base URL.
      '/ppt/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import '@/assets/styles/variable.scss';
          @import '@/assets/styles/mixin.scss';
        `,
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
