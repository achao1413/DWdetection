<script setup lang="ts">
import {
  IconLock,
  IconPhoto,
  IconRefresh,
  IconWriting,
} from '@tabler/icons-vue'
import type { Component } from 'vue'
import type { MeterTemplateStepId } from '@/state/meterTemplateConfiguration'

const props = defineProps<{
  currentStep: MeterTemplateStepId
}>()

const emit = defineEmits<{
  redraw: []
}>()

type ToolItem = {
  key: string
  label: string
  icon: Component
  side?: 'right'
}

const tools: ToolItem[] = [
  { key: 'base', label: '底图', icon: IconPhoto },
  { key: 'lock', label: '锁定', icon: IconLock },
  { key: 'reset', label: '复位', icon: IconRefresh, side: 'right' },
  { key: 'redraw', label: '重画', icon: IconWriting, side: 'right' },
]

function activeTool() {
  if (props.currentStep === 'range') return 'lock'
  return ''
}

function isDisabled(key: string) {
  if (key === 'redraw') return props.currentStep !== 'dial' && props.currentStep !== 'center'
  return key !== activeTool()
}

function handleTool(key: string) {
  if (key === 'redraw' && !isDisabled(key)) emit('redraw')
}
</script>

<template>
  <div class="meter-toolbar" aria-label="表计模板工具栏">
    <div class="meter-toolbar__group">
      <button
        v-for="tool in tools.filter((item) => !item.side)"
        :key="tool.key"
        type="button"
        class="meter-toolbar__tool"
        :class="{ 'is-active': activeTool() === tool.key, 'is-disabled': isDisabled(tool.key) }"
        :disabled="isDisabled(tool.key)"
        :aria-pressed="activeTool() === tool.key"
        @click="handleTool(tool.key)"
      >
        <component :is="tool.icon" :size="19" stroke="1.7" />
        <span>{{ tool.label }}</span>
      </button>
    </div>
    <div class="meter-toolbar__group meter-toolbar__group--right">
      <button
        v-for="tool in tools.filter((item) => item.side)"
        :key="tool.key"
        type="button"
        class="meter-toolbar__tool"
        :class="{ 'is-active': activeTool() === tool.key, 'is-disabled': isDisabled(tool.key) }"
        :disabled="isDisabled(tool.key)"
        @click="handleTool(tool.key)"
      >
        <component :is="tool.icon" :size="19" stroke="1.7" />
        <span>{{ tool.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.meter-toolbar {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  z-index: 5;
  min-height: 58px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 0 8px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 82%, transparent);
  border: 1px solid var(--el-border-color);
  backdrop-filter: blur(18px);
}

.meter-toolbar__group {
  display: flex;
  align-items: stretch;
}

.meter-toolbar__tool {
  min-width: 76px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 12px;
  cursor: default;
}

.meter-toolbar__tool.is-active {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.meter-toolbar__tool.is-disabled {
  color: var(--el-text-color-disabled);
}

.meter-toolbar__tool:not(.is-disabled) {
  cursor: pointer;
}

@media (max-width: 1100px) {
  .meter-toolbar__tool {
    min-width: 64px;
  }
}
</style>
