<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  IconBulb,
  IconChevronLeft,
  IconChevronRight,
  IconGripVertical,
  IconX,
} from '@tabler/icons-vue'
import type { MeterTemplateStepId } from '@/state/meterTemplateConfiguration'

type ExampleTone = 'success' | 'danger'
type ReferenceVisual =
  | 'dial-good'
  | 'dial-large'
  | 'dial-small'
  | 'center-good'
  | 'center-bad'
  | 'range-good'
  | 'range-bad'

type ReferenceExample = {
  id: string
  tone: ExampleTone
  title: string
  description: string
  visual: ReferenceVisual
}

const props = defineProps<{
  currentStep: MeterTemplateStepId
}>()

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const currentSlideIndex = ref(0)
const panelOffset = ref({ x: 0, y: 0 })
const topBoundary = ref(8)
let dragState: {
  startX: number
  startY: number
  startOffsetX: number
  startOffsetY: number
  panelLeft: number
  panelTop: number
  panelWidth: number
  panelHeight: number
} | null = null

const stepTitle = computed(() => {
  if (props.currentStep === 'dial') return '表盘定位'
  if (props.currentStep === 'center') return '指针轴心定位'
  return '角度和量程配置'
})

const examples = computed<ReferenceExample[]>(() => {
  if (props.currentStep === 'dial') {
    return [
      {
        id: 'dial-good',
        tone: 'success',
        title: '完整覆盖指针与量程',
        description: '框选指针活动区域和完整量程刻度，尽量减少无关背景。',
        visual: 'dial-good',
      },
      {
        id: 'dial-large',
        tone: 'danger',
        title: '无关区域过多',
        description: '范围过大会引入反光、设备边缘和环境干扰。',
        visual: 'dial-large',
      },
      {
        id: 'dial-small',
        tone: 'danger',
        title: '刻度覆盖不完整',
        description: '未覆盖完整量程，可能造成指针位置无法正确换算。',
        visual: 'dial-small',
      },
    ]
  }

  if (props.currentStep === 'center') {
    return [
      {
        id: 'center-good',
        tone: 'success',
        title: '辅助线与刻度对齐',
        description: '中心点应位于指针旋转轴心，辅助线应尽量与主要刻度方向一致。',
        visual: 'center-good',
      },
      {
        id: 'center-offset',
        tone: 'danger',
        title: '轴心存在偏移',
        description: '轴心偏移会导致角度和量程换算产生系统性误差。',
        visual: 'center-bad',
      },
      {
        id: 'center-edge',
        tone: 'danger',
        title: '辅助线与刻度错位',
        description: '越靠近表盘边缘，偏移轴心造成的方向误差越明显。',
        visual: 'center-bad',
      },
    ]
  }

  return [
    {
      id: 'range-good',
      tone: 'success',
      title: '完整覆盖首尾量程',
      description: '角度范围覆盖最小值到最大值，分段衔接连续。',
      visual: 'range-good',
    },
    {
      id: 'range-endpoint',
      tone: 'danger',
      title: '量程端点缺失',
      description: '首尾刻度未完整覆盖，会造成读数区间换算不准确。',
      visual: 'range-bad',
    },
    {
      id: 'range-gap',
      tone: 'danger',
      title: '分段衔接不连续',
      description: '非均匀刻度分段需要连续，避免出现读数空档。',
      visual: 'range-bad',
    },
  ]
})

const slides = computed(() => {
  const correct = examples.value.find((item) => item.tone === 'success')
  const incorrect = examples.value.filter((item) => item.tone === 'danger')
  if (!correct) return incorrect.map((item) => [item])
  return incorrect.map((item) => [correct, item])
})

const currentExamples = computed(() => slides.value[currentSlideIndex.value] ?? [])

const guidance = computed(() => {
  if (props.currentStep === 'dial') {
    return [
      '覆盖指针活动范围、首尾刻度和完整量程区域。',
      '尽量排除反光、设备背景和相邻仪表。',
    ]
  }
  if (props.currentStep === 'center') {
    return [
      '观察放射辅助线与表盘刻度和对称轴的重合情况。',
      '如位置偏移，可在表盘框内再次点击调整。',
    ]
  }
  return [
    '角度范围应覆盖最小量程和最大量程。',
    '非均匀刻度使用多段量程，并保持相邻区间连续。',
  ]
})

const referenceRays = Array.from({ length: 16 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 16
  return {
    x: 160 + Math.cos(angle) * 185,
    y: 118 + Math.sin(angle) * 185,
  }
})

watch(() => props.currentStep, () => {
  currentSlideIndex.value = 0
})

function previousExample() {
  currentSlideIndex.value = currentSlideIndex.value === 0
    ? slides.value.length - 1
    : currentSlideIndex.value - 1
}

function nextExample() {
  currentSlideIndex.value = (currentSlideIndex.value + 1) % slides.value.length
}

function resolveTopBoundary() {
  const titleBar = document.querySelector('.meter-template-page__bar')
  topBoundary.value = Math.max(8, (titleBar?.getBoundingClientRect().bottom ?? 0) + 8)
  return topBoundary.value
}

async function placePanelAtCenter() {
  await nextTick()
  if (!panelRef.value) return
  const minTop = resolveTopBoundary()
  const rect = panelRef.value.getBoundingClientRect()
  const maxLeft = Math.max(8, window.innerWidth - rect.width - 8)
  const maxTop = Math.max(minTop, window.innerHeight - rect.height - 8)
  panelOffset.value = {
    x: Math.min(maxLeft, Math.max(8, (window.innerWidth - rect.width) / 2)),
    y: Math.min(maxTop, Math.max(minTop, (window.innerHeight - rect.height) / 2)),
  }
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || !panelRef.value) return
  const rect = panelRef.value.getBoundingClientRect()
  dragState = {
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: panelOffset.value.x,
    startOffsetY: panelOffset.value.y,
    panelLeft: rect.left,
    panelTop: rect.top,
    panelWidth: rect.width,
    panelHeight: rect.height,
  }
  window.addEventListener('pointermove', handleDrag)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function handleDrag(event: PointerEvent) {
  if (!dragState) return
  const minTop = resolveTopBoundary()
  const deltaX = event.clientX - dragState.startX
  const deltaY = event.clientY - dragState.startY
  const nextLeft = Math.min(
    window.innerWidth - dragState.panelWidth - 8,
    Math.max(8, dragState.panelLeft + deltaX),
  )
  const nextTop = Math.min(
    Math.max(minTop, window.innerHeight - dragState.panelHeight - 8),
    Math.max(minTop, dragState.panelTop + deltaY),
  )
  panelOffset.value = {
    x: dragState.startOffsetX + nextLeft - dragState.panelLeft,
    y: dragState.startOffsetY + nextTop - dragState.panelTop,
  }
}

function stopDrag() {
  dragState = null
  window.removeEventListener('pointermove', handleDrag)
}

onMounted(() => {
  placePanelAtCenter()
  window.addEventListener('resize', placePanelAtCenter)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleDrag)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('resize', placePanelAtCenter)
})
</script>

<template>
  <Teleport to="body">
    <aside
      ref="panelRef"
      class="meter-reference"
      :style="{
        transform: `translate3d(${panelOffset.x}px, ${panelOffset.y}px, 0)`,
        maxHeight: `calc(100vh - ${topBoundary + 8}px)`,
      }"
      aria-label="操作参考"
    >
    <header class="meter-reference__head" @pointerdown="startDrag">
      <IconGripVertical class="meter-reference__grip" :size="18" stroke="1.8" />
      <div>
        <span>{{ stepTitle }}</span>
        <h3>操作参考</h3>
      </div>
      <div class="meter-reference__head-actions" @pointerdown.stop>
        <el-button link aria-label="关闭操作参考" @click="emit('close')">
          <IconX :size="19" stroke="1.8" />
        </el-button>
      </div>
    </header>

    <div class="meter-reference__scroll">
      <div class="meter-reference__comparison">
        <article
          v-for="example in currentExamples"
          :key="example.id"
          class="meter-reference__card"
          :class="`is-${example.tone}`"
        >
          <div class="meter-reference__visual">
            <img src="/assets/meter-template/pointer-meter.png" alt="" draggable="false" />
            <svg viewBox="0 0 320 180" aria-hidden="true">
              <template v-if="example.visual.startsWith('dial')">
                <rect
                  v-if="example.visual === 'dial-good'"
                  class="example-success"
                  x="108" y="35" width="118" height="108"
                />
                <rect
                  v-else-if="example.visual === 'dial-large'"
                  class="example-danger"
                  x="24" y="14" width="272" height="150"
                />
                <rect v-else class="example-danger" x="135" y="67" width="70" height="56" />
              </template>

              <template v-else-if="example.visual.startsWith('center')">
                <g :class="example.visual === 'center-good' ? 'example-success' : 'example-danger'">
                  <line
                    v-for="(point, index) in referenceRays"
                    :key="index"
                    :x1="example.visual === 'center-good' ? 160 : 135"
                    :y1="example.visual === 'center-good' ? 118 : 96"
                    :x2="point.x"
                    :y2="point.y"
                  />
                  <circle
                    :cx="example.visual === 'center-good' ? 160 : 135"
                    :cy="example.visual === 'center-good' ? 118 : 96"
                    r="7"
                  />
                </g>
              </template>

              <template v-else>
                <g :class="example.visual === 'range-good' ? 'example-success' : 'example-danger'">
                  <path
                    :d="example.visual === 'range-good'
                      ? 'M 160 120 L 86 136 L 105 62 L 176 34 L 222 71 Z'
                      : 'M 160 120 L 112 103 L 132 64 L 176 51 Z'"
                  />
                  <line x1="160" y1="120" x2="86" y2="136" />
                  <line
                    x1="160" y1="120"
                    :x2="example.visual === 'range-good' ? 222 : 176"
                    :y2="example.visual === 'range-good' ? 71 : 51"
                  />
                  <circle cx="160" cy="120" r="6" />
                </g>
              </template>
            </svg>
            <el-tag :type="example.tone" size="small" effect="dark">
              {{ example.tone === 'success' ? '正确' : '错误' }}
            </el-tag>
          </div>
          <div class="meter-reference__copy">
            <strong>{{ example.title }}</strong>
            <p>{{ example.description }}</p>
          </div>
        </article>
      </div>

      <div class="meter-reference__guidance">
        <strong>操作要点</strong>
        <p v-for="item in guidance" :key="item">{{ item }}</p>
      </div>

      <div class="meter-reference__tip">
        <IconBulb :size="17" stroke="1.7" />
        <span v-if="currentStep === 'center'">可调整辅助线密度，观察辅助线与刻度之间的细微偏差。</span>
        <span v-else-if="currentStep === 'range'">非均匀刻度需要使用多段量程，注意相邻区间连续衔接。</span>
        <span v-else>先识别完整刻度范围，再收紧矩形框减少背景干扰。</span>
      </div>
    </div>

    <footer class="meter-reference__footer">
      <el-button
        class="dw-ops-secondary"
        circle
        aria-label="上一个示例"
        :disabled="slides.length <= 1"
        @click="previousExample"
      >
        <IconChevronLeft :size="17" />
      </el-button>
      <span>{{ currentSlideIndex + 1 }} / {{ slides.length }}</span>
      <el-button
        class="dw-ops-secondary"
        circle
        aria-label="下一个示例"
        :disabled="slides.length <= 1"
        @click="nextExample"
      >
        <IconChevronRight :size="17" />
      </el-button>
    </footer>
    </aside>
  </Teleport>
</template>

<style scoped>
.meter-reference {
  position: fixed;
  z-index: 2200;
  top: 0;
  left: 0;
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  background: var(--dw-panel-fill);
  border: 1px solid var(--dw-panel-border-strong);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.46),
    inset 0 0 0 1px var(--dw-outline-inner-glass);
  backdrop-filter: blur(var(--dw-panel-blur, 100px)) saturate(1.1);
  -webkit-backdrop-filter: blur(var(--dw-panel-blur, 100px)) saturate(1.1);
}

.meter-reference__head {
  flex: 0 0 56px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  box-sizing: border-box;
  cursor: move;
  touch-action: none;
  user-select: none;
}

.meter-reference__grip {
  color: var(--el-text-color-secondary);
}

.meter-reference__head span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-reference__head h3 {
  margin: 1px 0 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.meter-reference__head-actions,
.meter-reference__footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meter-reference__scroll {
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 12px;
  scrollbar-width: thin;
}

.meter-reference__comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.meter-reference__card {
  min-width: 0;
  overflow: hidden;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.meter-reference__card.is-success { border-color: var(--el-color-success-light-3); }
.meter-reference__card.is-danger { border-color: var(--el-color-danger-light-3); }

.meter-reference__visual {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--el-fill-color-darker);
}

.meter-reference__visual img,
.meter-reference__visual svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.meter-reference__visual img {
  object-fit: cover;
  object-position: center 46%;
  filter: saturate(0.8) brightness(0.72);
}

.meter-reference__visual svg { fill: none; }
.meter-reference__visual rect {
  fill: color-mix(in srgb, currentColor 10%, transparent);
  stroke: currentColor;
  stroke-width: 4;
}
.meter-reference__visual line {
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.9;
}
.meter-reference__visual path {
  fill: color-mix(in srgb, currentColor 18%, transparent);
  stroke: currentColor;
  stroke-width: 3;
}
.meter-reference__visual circle {
  fill: currentColor;
  stroke: var(--el-text-color-primary);
  stroke-width: 2;
}
.meter-reference__visual .example-success { color: var(--el-color-success); }
.meter-reference__visual .example-danger { color: var(--el-color-danger); }
.meter-reference__visual :deep(.el-tag) {
  position: absolute;
  top: 8px;
  left: 8px;
}

.meter-reference__copy {
  min-height: 88px;
  padding: 9px 11px 11px;
  box-sizing: border-box;
}

.meter-reference__copy strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.meter-reference__copy p {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 18px;
}

.meter-reference__guidance {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  padding: 10px 11px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 18px;
}

.meter-reference__guidance strong { color: var(--el-text-color-primary); }
.meter-reference__guidance p {
  position: relative;
  margin: 0;
  padding-left: 12px;
}
.meter-reference__guidance p::before {
  content: '';
  position: absolute;
  top: 7px;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.meter-reference__tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 11px;
  color: var(--el-text-color-regular);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-fill-color-light));
  font-size: 12px;
  line-height: 18px;
}

.meter-reference__tip svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--el-color-primary);
}

.meter-reference__footer {
  flex: 0 0 38px;
  justify-content: center;
  padding: 5px 10px;
  border-top: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  box-sizing: border-box;
}

.meter-reference__footer :deep(.el-button) {
  width: 26px;
  height: 26px;
  min-height: 26px;
  padding: 0;
  border-radius: 4px;
}

@media (max-width: 680px) {
  .meter-reference {
    position: fixed;
    top: 188px;
    right: 12px;
    bottom: 12px;
    width: min(440px, calc(100vw - 24px));
    max-width: none;
    max-height: none;
  }
}
</style>
