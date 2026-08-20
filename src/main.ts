import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import '@/styles/global.css'
import { applyTheme } from '@/theme'
import { router } from '@/router'
import App from './App.vue'

applyTheme('dw-build')
document.documentElement.classList.add('dark')

createApp(App).use(ElementPlus, { locale: zhCn }).use(router).mount('#app')
