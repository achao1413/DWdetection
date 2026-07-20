<script setup lang="ts">
import { computed } from 'vue'
import type { QualityDimension } from '@/state/workflow'

const props = defineProps<{
  dimensions: QualityDimension[]
}>()

const size = 250
const center = size / 2
const radius = 78
const labelOffset = 24
const labelWidth = 54
const labelHeight = 18

function clampLabelX(value: number) {
  return Math.min(size - labelWidth / 2 - 2, Math.max(labelWidth / 2 + 2, value))
}

function clampLabelY(value: number) {
  return Math.min(size - labelHeight / 2 - 2, Math.max(labelHeight / 2 + 2, value))
}

const axes = computed(() =>
  props.dimensions.map((dimension, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / props.dimensions.length
    const x = center + Math.cos(angle) * radius
    const y = center + Math.sin(angle) * radius
    const valueRadius = dimension.score == null ? radius * 0.18 : radius * (dimension.score / 100)
    const scoreRadius = dimension.score == null ? radius * 0.32 : Math.max(26, valueRadius - 12)
    return {
      ...dimension,
      x,
      y,
      labelX: clampLabelX(center + Math.cos(angle) * (radius + labelOffset)),
      labelY: clampLabelY(center + Math.sin(angle) * (radius + labelOffset)),
      valueX: center + Math.cos(angle) * valueRadius,
      valueY: center + Math.sin(angle) * valueRadius,
      scoreX: center + Math.cos(angle) * scoreRadius,
      scoreY: center + Math.sin(angle) * scoreRadius,
    }
  }),
)

const gridPolygons = computed(() =>
  [0.33, 0.66, 1].map((scale) =>
    axes.value.map((axis) => `${center + (axis.x - center) * scale},${center + (axis.y - center) * scale}`).join(' '),
  ),
)

const valuePolygon = computed(() =>
  axes.value
    .filter((axis) => axis.score != null)
    .map((axis) => `${axis.valueX},${axis.valueY}`)
    .join(' '),
)
</script>

<template>
  <div class="quality-radar">
    <svg :viewBox="`0 0 ${size} ${size}`" role="img" aria-label="数据集质量雷达图">
      <polygon
        v-for="polygon in gridPolygons"
        :key="polygon"
        :points="polygon"
        class="quality-radar__grid"
      />
      <line
        v-for="axis in axes"
        :key="axis.key"
        :x1="center"
        :y1="center"
        :x2="axis.x"
        :y2="axis.y"
        class="quality-radar__axis"
      />
      <polygon v-if="valuePolygon" :points="valuePolygon" class="quality-radar__value" />
      <circle
        v-for="axis in axes"
        :key="`${axis.key}-point`"
        :cx="axis.score == null ? axis.x : axis.valueX"
        :cy="axis.score == null ? axis.y : axis.valueY"
        r="4"
        class="quality-radar__point"
        :class="`is-${axis.level}`"
      />
      <text
        v-for="axis in axes"
        :key="`${axis.key}-score`"
        :x="axis.scoreX"
        :y="axis.scoreY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="quality-radar__score"
        :class="{ 'is-not-ready': axis.score == null }"
      >
        {{ axis.score ?? '--' }}
      </text>
      <rect
        v-for="axis in axes"
        :key="`${axis.key}-label-bg`"
        :x="axis.labelX - labelWidth / 2"
        :y="axis.labelY - labelHeight / 2"
        :width="labelWidth"
        :height="labelHeight"
        rx="9"
        class="quality-radar__label-bg"
      />
      <text
        v-for="axis in axes"
        :key="`${axis.key}-label`"
        :x="axis.labelX"
        :y="axis.labelY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="quality-radar__label"
      >
        {{ axis.name.slice(0, 4) }}
      </text>
    </svg>
  </div>
</template>

<style scoped>
.quality-radar {
  width: min(100%, 320px);
  aspect-ratio: 1;
  justify-self: center;
  margin: 0 auto;
  color: var(--el-text-color-secondary);
}

.quality-radar svg {
  width: 100%;
  height: 100%;
  display: block;
}

.quality-radar__grid,
.quality-radar__axis {
  fill: none;
  stroke: var(--el-border-color);
  stroke-width: 1;
}

.quality-radar__value {
  fill: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  stroke: var(--el-color-primary);
  stroke-width: 2;
}

.quality-radar__point {
  fill: var(--el-color-primary);
  stroke: var(--el-bg-color);
  stroke-width: 2;
}

.quality-radar__point.is-excellent {
  fill: var(--el-color-success);
}

.quality-radar__point.is-normal {
  fill: var(--el-color-warning);
}

.quality-radar__point.is-poor {
  fill: var(--el-color-danger);
}

.quality-radar__point.is-notReady {
  fill: var(--el-text-color-placeholder);
}

.quality-radar__label-bg {
  fill: var(--el-bg-color-overlay);
}

.quality-radar__label {
  fill: var(--el-text-color-secondary);
  font-size: 9px;
  font-weight: 500;
}

.quality-radar__score {
  fill: var(--el-text-color-primary);
  font-size: 10px;
  font-weight: 700;
}

.quality-radar__score.is-not-ready {
  fill: var(--el-text-color-placeholder);
  font-weight: 600;
}
</style>
