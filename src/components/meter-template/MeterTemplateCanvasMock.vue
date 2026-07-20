<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  GuideLineDensity,
  MeterTemplateStepId,
  NormalizedPoint,
  NormalizedRect,
} from '@/state/meterTemplateConfiguration'
import MeterTemplateToolbar from './MeterTemplateToolbar.vue'

const props = defineProps<{
  currentStep: MeterTemplateStepId
  dialRect: NormalizedRect | null
  centerPoint: NormalizedPoint | null
  rangeVisible: boolean
  guideLineDensity: GuideLineDensity
  guideLineCount: number
}>()

const emit = defineEmits<{
  'update:dialRect': [value: NormalizedRect | null]
  'update:centerPoint': [value: NormalizedPoint | null]
  dialFinished: [valid: boolean]
  invalidCenter: []
  resetStep: []
}>()

const interactionRef = ref<HTMLElement | null>(null)
const dragStart = ref<NormalizedPoint | null>(null)
const dragging = ref(false)

const viewWidth = 1000
const viewHeight = 620
const minimumDialSize = 0.12

const dialSvg = computed(() => props.dialRect ? {
  x: props.dialRect.x * viewWidth,
  y: props.dialRect.y * viewHeight,
  width: props.dialRect.width * viewWidth,
  height: props.dialRect.height * viewHeight,
} : null)

const centerSvg = computed(() => props.centerPoint ? {
  x: props.centerPoint.x * viewWidth,
  y: props.centerPoint.y * viewHeight,
} : null)

const rayEndpoints = computed(() => {
  if (!centerSvg.value) return []
  const count = props.guideLineCount
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count
    const distance = 720
    return {
      x: centerSvg.value!.x + Math.cos(angle) * distance,
      y: centerSvg.value!.y + Math.sin(angle) * distance,
    }
  })
})

const rangePoints = computed(() => {
  if (!dialSvg.value) return []
  const rect = dialSvg.value
  return [
    { x: rect.x + rect.width * 0.05, y: rect.y + rect.height * 0.72 },
    { x: rect.x + rect.width * 0.14, y: rect.y + rect.height * 0.38 },
    { x: rect.x + rect.width * 0.42, y: rect.y + rect.height * 0.1 },
    { x: rect.x + rect.width * 0.68, y: rect.y + rect.height * 0.08 },
  ]
})

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function normalizedPoint(event: PointerEvent): NormalizedPoint | null {
  const element = interactionRef.value
  if (!element) return null
  const bounds = element.getBoundingClientRect()
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  }
}

function rectFromPoints(start: NormalizedPoint, end: NormalizedPoint): NormalizedRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function pointInDial(point: NormalizedPoint) {
  const rect = props.dialRect
  if (!rect) return false
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
}

function handlePointerDown(event: PointerEvent) {
  const point = normalizedPoint(event)
  if (!point) return

  if (props.currentStep === 'dial') {
    dragStart.value = point
    dragging.value = true
    if (interactionRef.value && event.isTrusted) {
      interactionRef.value.setPointerCapture(event.pointerId)
    }
    emit('update:dialRect', { ...point, width: 0, height: 0 })
    return
  }

  if (props.currentStep === 'center') {
    if (!pointInDial(point)) {
      emit('invalidCenter')
      return
    }
    emit('update:centerPoint', point)
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value || !dragStart.value || props.currentStep !== 'dial') return
  const point = normalizedPoint(event)
  if (!point) return
  emit('update:dialRect', rectFromPoints(dragStart.value, point))
}

function handlePointerUp(event: PointerEvent) {
  if (!dragging.value || !dragStart.value || props.currentStep !== 'dial') return
  const point = normalizedPoint(event)
  const nextRect = point ? rectFromPoints(dragStart.value, point) : null
  const valid = Boolean(
    nextRect
    && nextRect.width >= minimumDialSize
    && nextRect.height >= minimumDialSize,
  )

  dragging.value = false
  dragStart.value = null
  if (interactionRef.value?.hasPointerCapture(event.pointerId)) {
    interactionRef.value.releasePointerCapture(event.pointerId)
  }
  emit('update:dialRect', valid ? nextRect : null)
  emit('dialFinished', valid)
}

function sectorPath(startIndex: number, endIndex: number) {
  const center = centerSvg.value
  const start = rangePoints.value[startIndex]
  const end = rangePoints.value[endIndex]
  if (!center || !start || !end) return ''
  return `M ${center.x} ${center.y} L ${start.x} ${start.y} L ${end.x} ${end.y} Z`
}
</script>

<template>
  <section class="meter-canvas-shell" aria-label="表计模板画布">
    <header class="meter-canvas-shell__head">
      <div class="meter-canvas-shell__title">画布区域</div>
    </header>
    <div class="meter-canvas">
      <img
        class="meter-canvas__image"
        src="/assets/meter-template/pointer-meter.png"
        alt="指针式表计模板底图"
        draggable="false"
      />
      <div class="meter-canvas__shade" aria-hidden="true" />

      <svg class="meter-canvas__overlay" viewBox="0 0 1000 620" aria-hidden="true">
        <g v-if="dialSvg" class="dial-layer" :class="{ 'is-drawing': dragging }">
          <rect
            :x="dialSvg.x"
            :y="dialSvg.y"
            :width="dialSvg.width"
            :height="dialSvg.height"
            rx="2"
          />
        </g>

        <g v-if="centerSvg" class="center-layer">
          <line
            v-for="(point, index) in rayEndpoints"
            :key="index"
            :x1="centerSvg.x"
            :y1="centerSvg.y"
            :x2="point.x"
            :y2="point.y"
          />
          <circle class="center-layer__outer" :cx="centerSvg.x" :cy="centerSvg.y" r="15" />
          <circle class="center-layer__inner" :cx="centerSvg.x" :cy="centerSvg.y" r="6" />
        </g>

        <g v-if="rangeVisible && centerSvg" class="range-layer">
          <path class="range-layer__sector range-layer__sector--one" :d="sectorPath(0, 1)" />
          <path class="range-layer__sector range-layer__sector--two" :d="sectorPath(1, 2)" />
          <path class="range-layer__sector range-layer__sector--three" :d="sectorPath(2, 3)" />
          <polyline :points="rangePoints.map((point) => `${point.x},${point.y}`).join(' ')" />
          <line
            v-for="(point, index) in rangePoints"
            :key="`range-line-${index}`"
            :x1="centerSvg.x"
            :y1="centerSvg.y"
            :x2="point.x"
            :y2="point.y"
          />
          <circle
            v-for="(point, index) in rangePoints"
            :key="`range-point-${index}`"
            :cx="point.x"
            :cy="point.y"
            r="10"
          />
        </g>
      </svg>

      <div class="meter-canvas__stage-note">
        <span class="meter-canvas__stage-dot" />
        <span v-if="currentStep === 'dial'">拖动框选表盘有效区域</span>
        <span v-else-if="currentStep === 'center'">点击表盘内的指针旋转轴心</span>
        <span v-else-if="currentStep === 'range'">核对预设角度与多段量程</span>
        <span v-else>画布配置已完成，填写模板信息</span>
      </div>

      <div
        ref="interactionRef"
        class="meter-canvas__interaction"
        :class="{
          'is-dial-tool': currentStep === 'dial',
          'is-center-tool': currentStep === 'center',
        }"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
      />

      <slot name="reference" />

      <MeterTemplateToolbar :current-step="currentStep" @redraw="emit('resetStep')" />
    </div>
  </section>
</template>

<style scoped>
.meter-canvas-shell {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 16px 16px;
  box-sizing: border-box;
  background: var(--el-fill-color-blank);
}

.meter-canvas-shell__head {
  flex: 0 0 auto;
  min-height: 32px;
  min-width: 0;
  display: flex;
  align-items: center;
}

.meter-canvas-shell__title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.meter-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
}

.meter-canvas__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 44%;
  filter: saturate(0.84) contrast(0.92) brightness(0.82);
  transform: scale(1.03);
  user-select: none;
}

.meter-canvas__shade {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 18%, transparent);
  pointer-events: none;
}

.meter-canvas__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.dial-layer rect {
  fill: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  stroke: var(--el-color-primary);
  stroke-width: 5;
}

.dial-layer.is-drawing rect {
  stroke-dasharray: 12 8;
}

.center-layer line {
  stroke: var(--el-color-success);
  stroke-width: 1.8;
  stroke-dasharray: 7 6;
  opacity: 0.88;
}

.center-layer__outer {
  fill: var(--el-color-warning);
  stroke: var(--el-text-color-primary);
  stroke-width: 4;
}

.center-layer__inner {
  fill: var(--el-color-danger);
}

.range-layer__sector {
  stroke: none;
}

.range-layer__sector--one {
  fill: color-mix(in srgb, var(--el-color-danger) 23%, transparent);
}

.range-layer__sector--two {
  fill: color-mix(in srgb, var(--el-color-warning) 23%, transparent);
}

.range-layer__sector--three {
  fill: color-mix(in srgb, var(--el-color-success) 23%, transparent);
}

.range-layer polyline,
.range-layer line {
  fill: none;
  stroke: var(--el-text-color-primary);
  stroke-width: 3;
}

.range-layer circle {
  fill: var(--el-color-success);
  stroke: var(--el-text-color-primary);
  stroke-width: 4;
}

.meter-canvas__stage-note {
  position: absolute;
  z-index: 4;
  top: 16px;
  left: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 84%, transparent);
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  font-size: 12px;
  pointer-events: none;
}

.meter-canvas__stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.meter-canvas__interaction {
  position: absolute;
  inset: 0;
  z-index: 3;
  touch-action: none;
}

.meter-canvas__interaction.is-dial-tool,
.meter-canvas__interaction.is-center-tool {
  cursor: crosshair;
}

</style>
