<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { IconChevronLeft, IconChevronRight, IconGripVertical, IconX } from '@tabler/icons-vue'
import {
  annotationGuideList,
  annotationGuideMap,
  type AnnotationGuideExamplePage,
  type AnnotationGuideKey,
} from '@/state/annotationGuides'

const props = defineProps<{
  modelValue: boolean
  guideKey: AnnotationGuideKey
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const panelRef = ref<HTMLElement>()
const selectedGuideKey = ref<AnnotationGuideKey>(props.guideKey)
const exampleIndex = ref(0)
const position = ref({ x: 84, y: 128 })
const dragState = ref<{
  startX: number
  startY: number
  originX: number
  originY: number
} | null>(null)

const guide = computed(() => annotationGuideMap[selectedGuideKey.value])
const guideExamples = computed<AnnotationGuideExamplePage[]>(() => [
  {
    displayMode: 'comparison',
    goodExample: guide.value.goodExample,
    badExample: guide.value.badExample,
    tips: guide.value.tips,
  },
  ...(guide.value.additionalExamples ?? []),
])
const currentExample = computed(() => guideExamples.value[exampleIndex.value] ?? guideExamples.value[0])

watch(
  () => props.guideKey,
  (key) => {
    selectedGuideKey.value = key
    exampleIndex.value = 0
  },
)

watch(selectedGuideKey, () => {
  exampleIndex.value = 0
})

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return
    await nextTick()
    clampPosition()
  },
)

function close() {
  emit('update:modelValue', false)
}

function showPreviousExample() {
  const count = guideExamples.value.length
  exampleIndex.value = (exampleIndex.value - 1 + count) % count
}

function showNextExample() {
  exampleIndex.value = (exampleIndex.value + 1) % guideExamples.value.length
}

function clampPosition() {
  const panel = panelRef.value
  const width = panel?.offsetWidth ?? 400
  const height = panel?.offsetHeight ?? 520
  const margin = 8
  const maxX = Math.max(margin, window.innerWidth - width - margin)
  const maxY = Math.max(56, window.innerHeight - height - margin)
  position.value = {
    x: Math.min(maxX, Math.max(margin, position.value.x)),
    y: Math.min(maxY, Math.max(56, position.value.y)),
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragState.value) return
  position.value = {
    x: dragState.value.originX + event.clientX - dragState.value.startX,
    y: dragState.value.originY + event.clientY - dragState.value.startY,
  }
  clampPosition()
}

function stopDrag() {
  dragState.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDrag)
}

function startDrag(event: PointerEvent) {
  dragState.value = {
    startX: event.clientX,
    startY: event.clientY,
    originX: position.value.x,
    originY: position.value.y,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDrag)
}

onBeforeUnmount(stopDrag)
</script>

<template>
  <Teleport to="body">
    <section
      v-if="modelValue"
      ref="panelRef"
      class="dw-guide-float"
      :style="{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }"
    >
      <header class="dw-guide-float__head" @pointerdown="startDrag">
        <div class="dw-guide-float__title">
          <IconGripVertical :size="18" />
          <div>
            <strong>标注教程示例</strong>
          </div>
        </div>
        <div class="dw-guide-float__head-actions">
          <button type="button" aria-label="关闭标注教程示例" @pointerdown.stop @click="close">
            <IconX :size="18" />
          </button>
        </div>
      </header>

      <div class="dw-guide-float__body">
        <el-select v-model="selectedGuideKey" size="small" class="dw-guide-float__select">
          <el-option
            v-for="item in annotationGuideList"
            :key="item.analysisType"
            :label="item.guideTitle"
            :value="item.analysisType"
          />
        </el-select>

        <div
          class="dw-guide-examples"
          :class="{ 'is-good-only': currentExample.displayMode === 'good-only' }"
        >
          <article class="dw-guide-example is-good">
            <div class="dw-guide-example__media">
              <img :src="currentExample.goodExample.image" :alt="currentExample.goodExample.title" />
              <span class="dw-guide-box" />
              <el-tag type="success" effect="dark" size="small">正确</el-tag>
            </div>
            <strong>{{ currentExample.goodExample.title }}</strong>
            <p>{{ currentExample.goodExample.description }}</p>
          </article>

          <article v-if="currentExample.badExample" class="dw-guide-example is-bad">
            <div class="dw-guide-example__media">
              <img :src="currentExample.badExample.image" :alt="currentExample.badExample.title" />
              <span class="dw-guide-box" />
              <el-tag type="danger" effect="dark" size="small">错误</el-tag>
            </div>
            <strong>{{ currentExample.badExample.title }}</strong>
            <p>{{ currentExample.badExample.description }}</p>
          </article>
        </div>

        <div class="dw-guide-tips">
          <span v-for="tip in currentExample.tips" :key="tip">{{ tip }}</span>
        </div>

        <div class="dw-guide-pager">
          <button type="button" aria-label="上一个标注示例" :disabled="guideExamples.length < 2" @click="showPreviousExample">
            <IconChevronLeft :size="17" />
          </button>
          <span>{{ exampleIndex + 1 }} / {{ guideExamples.length }}</span>
          <button type="button" aria-label="下一个标注示例" :disabled="guideExamples.length < 2" @click="showNextExample">
            <IconChevronRight :size="17" />
          </button>
        </div>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.dw-guide-float {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 2200;
  width: 400px;
  border-radius: 8px;
  border: 1px solid var(--dw-panel-border-strong);
  background: var(--dw-panel-fill);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.46),
    inset 0 0 0 1px var(--dw-outline-inner-glass);
  backdrop-filter: blur(var(--dw-panel-blur, 100px)) saturate(1.1);
  -webkit-backdrop-filter: blur(var(--dw-panel-blur, 100px)) saturate(1.1);
  color: var(--el-text-color-primary);
  overflow: hidden;
}

.dw-guide-float__head {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  cursor: move;
  user-select: none;
}

.dw-guide-float__title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dw-guide-float__title strong,
.dw-guide-example strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 20px;
}

.dw-guide-float__title span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dw-guide-float__head button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.dw-guide-float__head button:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.dw-guide-float__head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dw-guide-float__body {
  display: grid;
  gap: 12px;
  padding: 0 12px 14px;
}

.dw-guide-float__select {
  width: 100%;
}

.dw-guide-examples {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dw-guide-examples.is-good-only {
  grid-template-columns: 1fr;
}

.dw-guide-examples.is-good-only .dw-guide-example__media {
  aspect-ratio: 16 / 8;
}

.dw-guide-example {
  min-width: 0;
}

.dw-guide-example__media {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--el-fill-color-blank);
}

.dw-guide-example__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dw-guide-example__media :deep(.el-tag) {
  position: absolute;
  left: 8px;
  top: 8px;
}

.dw-guide-box {
  position: absolute;
  border: 2px solid var(--el-color-success);
  inset: 18% 13% 18% 13%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
}

.dw-guide-example.is-bad .dw-guide-box {
  border-color: var(--el-color-danger);
  inset: 34% 29% 28% 33%;
}

.dw-guide-example strong {
  margin-top: 8px;
}

.dw-guide-example p {
  margin: 2px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dw-guide-tips {
  display: grid;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dw-guide-tips span {
  position: relative;
  padding-left: 12px;
}

.dw-guide-tips span::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.dw-guide-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.dw-guide-pager button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.dw-guide-pager button:disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
