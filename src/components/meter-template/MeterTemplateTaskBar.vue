<script setup lang="ts">
import { IconCheck } from '@tabler/icons-vue'
import type { MeterTaskStep } from '@/state/meterTemplateConfiguration'

const props = defineProps<{
  steps: MeterTaskStep[]
  currentStepIndex: number
}>()

function stepState(index: number) {
  if (index < props.currentStepIndex) return 'completed'
  if (index === props.currentStepIndex) return 'current'
  return 'future'
}
</script>

<template>
  <section class="meter-taskbar" aria-label="表计模板配置步骤">
    <ol class="meter-taskbar__steps">
      <li
        v-for="(item, index) in steps"
        :key="item.id"
        :class="`is-${stepState(index)}`"
      >
        <span class="meter-taskbar__step-index">
          <IconCheck v-if="index < currentStepIndex" :size="14" stroke="2.2" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span>{{ item.title }}</span>
      </li>
    </ol>

  </section>
</template>

<style scoped>
.meter-taskbar {
  flex: 0 0 64px;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  box-sizing: border-box;
  background: var(--el-fill-color-blank);
  border-bottom: 1px solid var(--el-border-color);
}

.meter-taskbar__steps {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(64px, 1fr));
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meter-taskbar__steps li {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.meter-taskbar__steps li:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 8px;
  left: 32px;
  bottom: -8px;
  height: 2px;
  background: var(--el-border-color);
}

.meter-taskbar__steps li.is-completed::after {
  background: var(--el-color-success);
}

.meter-taskbar__step-index {
  position: relative;
  z-index: 1;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 700;
}

.meter-taskbar__steps li.is-current {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.meter-taskbar__steps li.is-current .meter-taskbar__step-index {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: var(--el-color-white);
}

.meter-taskbar__steps li.is-completed .meter-taskbar__step-index {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
  color: var(--el-color-white);
}

@media (max-width: 1240px) {
  .meter-taskbar__steps {
    grid-template-columns: repeat(4, minmax(40px, 1fr));
    justify-content: space-between;
  }

  .meter-taskbar__steps li {
    justify-content: center;
  }

  .meter-taskbar__steps li > span:last-child {
    display: none;
  }

  .meter-taskbar__steps li:not(:last-child)::after {
    right: -16px;
    left: 28px;
  }
}

@media (max-width: 880px) {
  .meter-taskbar {
    padding-inline: 10px;
  }

  .meter-taskbar__steps {
    grid-template-columns: repeat(4, 32px);
  }

}
</style>
