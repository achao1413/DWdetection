<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconBook, IconChevronDown, IconUser } from '@tabler/icons-vue'

withDefaults(defineProps<{
  fullBleed?: boolean
}>(), {
  fullBleed: false,
})

const route = useRoute()
const router = useRouter()

const navItems = [
  { key: 'inference', label: '推理', to: '/' },
  { key: 'annotation', label: '标注', to: '/annotation' },
  { key: 'training', label: '训练', to: '/training' },
] as const

const activeKey = computed(() => {
  if (route.path.startsWith('/annotation')) return 'annotation'
  if (route.path.startsWith('/training')) return 'training'
  return 'inference'
})

function openTutorial() {
  const target = router.resolve({
    name: 'annotation-guide-document',
    query: { scope: 'tool', returnTo: route.fullPath },
  })
  window.open(target.href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="dw-page-bg">
    <div class="dw-page-artwork" aria-hidden="true" />
    <div class="dw-page-scrim" aria-hidden="true" />
    <div class="dw-shell dw-app-shell">
      <header class="dw-header-bar dw-app-header">
        <div class="dw-header-left">
          <div class="dw-logo-mark" aria-hidden="true" />
          <span class="dw-app-title dw-subtitle2">算法训练工具</span>
        </div>

        <nav class="dw-main-nav" aria-label="主导航">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="dw-main-nav__item"
            :class="{ 'is-active': activeKey === item.key }"
            @click="router.push(item.to)"
          >
            {{ item.label }}
          </button>
        </nav>

        <div class="dw-header-right">
          <el-tooltip
            content="查看算法训练工具教程"
            placement="bottom"
            effect="dark"
            popper-class="dw-ops-tooltip"
          >
            <el-button class="dw-header-tutorial dw-ops-secondary" @click="openTutorial">
              <span class="dw-btn-inner">
                <IconBook :size="17" stroke="1.8" />
                教程
              </span>
            </el-button>
          </el-tooltip>
          <slot name="header-actions" />
          <div class="dw-user">
            <div class="dw-avatar">
              <IconUser :size="16" color="var(--el-text-color-primary)" />
            </div>
            <span class="dw-body2">User</span>
            <IconChevronDown :size="18" color="var(--el-text-color-secondary)" />
          </div>
        </div>
      </header>

      <main class="dw-app-main" :class="{ 'is-full-bleed': fullBleed }">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.dw-app-shell {
  display: flex;
  flex-direction: column;
}

.dw-app-header {
  flex-shrink: 0;
}

.dw-header-left,
.dw-header-right,
.dw-user {
  display: flex;
  align-items: center;
}

.dw-header-left {
  gap: 16px;
  min-width: 240px;
}

.dw-header-right {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
  min-width: 240px;
}

.dw-logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: radial-gradient(circle at 30% 25%, var(--el-color-primary-light-3), var(--el-color-primary));
  box-shadow: 0 0 0 1px var(--el-border-color-dark);
}

.dw-app-title {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.dw-main-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.dw-main-nav__item {
  position: relative;
  height: 48px;
  min-width: 76px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.dw-main-nav__item.is-active {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dw-main-nav__item.is-active::after {
  content: '';
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--el-color-primary);
}

.dw-user {
  gap: 8px;
}

.dw-header-tutorial {
  height: 32px;
  padding-inline: 12px;
}

.dw-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--el-border-radius-base);
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--el-fill-color-light) 65%, transparent);
}

.dw-app-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 30px 30px 42px;
  box-sizing: border-box;
}

.dw-app-main.is-full-bleed {
  padding: 0;
}
</style>
