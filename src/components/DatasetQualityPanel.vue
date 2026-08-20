<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconInfoCircle, IconPhotoPlus, IconSparkles, IconTag } from '@tabler/icons-vue'
import QualityRadar from '@/components/QualityRadar.vue'
import type { DatasetItem, OverallQualityLevel, QualityDimension, QualityDimensionLevel, QualitySubMetric } from '@/state/workflow'

const props = defineProps<{
  dataset: DatasetItem
  compact?: boolean
  contained?: boolean
}>()

const emit = defineEmits<{
  action: [action: 'add-images' | 'annotate' | 'deduplicate']
}>()

const quality = computed(() => props.dataset.qualityStatus)
const priorityDimensions = computed(() => quality.value.dimensions
  .filter((dimension) => dimension.level !== 'excellent')
  .sort((left, right) => {
    const priority: Record<QualityDimensionLevel, number> = { poor: 0, normal: 1, notReady: 2, excellent: 3 }
    return priority[left.level] - priority[right.level]
  }))
const excellentDimensions = computed(() => quality.value.dimensions.filter((dimension) => dimension.level === 'excellent'))
const orderedDimensions = computed(() => [...priorityDimensions.value, ...excellentDimensions.value])
const activeDimension = ref('')

watch(() => props.dataset.id, () => {
  activeDimension.value = priorityDimensions.value[0]?.key ?? ''
}, { immediate: true })

watch(orderedDimensions, (dimensions) => {
  if (dimensions.some((dimension) => dimension.key === activeDimension.value)) return
  activeDimension.value = priorityDimensions.value[0]?.key ?? ''
})

function tagType(level: OverallQualityLevel | QualityDimensionLevel) {
  if (level === 'excellent') return 'success'
  if (level === 'normal') return 'warning'
  if (level === 'poor') return 'danger'
  return 'info'
}

function levelText(level: OverallQualityLevel | QualityDimensionLevel) {
  if (level === 'excellent') return '优秀'
  if (level === 'normal') return '一般'
  if (level === 'poor') return '待优化'
  return '待评估'
}

function conciseSuggestion(dimension: QualityDimension) {
  if (dimension.level === 'notReady') {
    if (dimension.key === 'annotation-quality') return '开始标注后即可评估。'
    return '完成标注后即可评估。'
  }
  if (dimension.key === 'sample-count') return dimension.level === 'poor' ? '样本不足，请补充图片。' : '建议补充至 100 张以上。'
  if (dimension.key === 'time-distribution') return '建议补充缺少时段的图片。'
  if (dimension.key === 'duplicate-ratio') return '存在重复样本，建议去重。'
  if (dimension.key === 'label-balance') return '部分标签样本不足，建议补充标注。'
  if (dimension.key === 'bbox-ratio') return '目标画幅偏小，建议核对标注。'
  if (dimension.key === 'annotation-quality') return '标注尚未完成，建议继续标注。'
  return dimension.suggestion
}

function metricGuidance(metric: QualitySubMetric) {
  if (metric.key === 'completeness') {
    return metric.level === 'excellent' ? '标注覆盖完整，可用于训练。' : '继续标注未完成图片，建议达到 90%。'
  }
  return metric.level === 'excellent' ? '未发现越界、重叠或冲突标签。' : '请核验越界、重复框和冲突标签。'
}

function dimensionAction(dimension: QualityDimension) {
  if (dimension.key === 'sample-count' || dimension.key === 'time-distribution') {
    return { key: 'add-images' as const, label: '添加图片', icon: IconPhotoPlus }
  }
  if (dimension.key === 'duplicate-ratio') {
    return { key: 'deduplicate' as const, label: '图片去重', icon: IconSparkles }
  }
  return { key: 'annotate' as const, label: '进入标注', icon: IconTag }
}
</script>

<template>
  <section class="quality-panel" :class="{ 'is-compact': compact, 'is-contained': contained }">
    <div v-if="compact" class="quality-panel__summary">
      <span class="quality-panel__summary-label">样本质量</span>
      <el-tag class="quality-panel__overall" :type="tagType(quality.overallLevel)" effect="dark">
        {{ levelText(quality.overallLevel) }}
      </el-tag>
    </div>

    <div v-if="!compact" class="quality-panel__body">
      <div class="quality-panel__radar-column">
        <div class="quality-panel__summary">
          <span class="quality-panel__summary-label">样本质量</span>
          <el-tag class="quality-panel__overall" :type="tagType(quality.overallLevel)" effect="dark">
            {{ levelText(quality.overallLevel) }}
          </el-tag>
          <el-popover trigger="hover" placement="bottom-start" :width="360" popper-class="quality-standard-popover">
            <template #reference>
              <button type="button" class="quality-panel__standard-trigger" aria-label="查看样本质量评估标准">
                <IconInfoCircle :size="18" />
              </button>
            </template>
            <div class="quality-panel__standards">
              <strong>样本质量评估标准</strong>
              <dl>
                <div><dt>样本数量</dt><dd>优秀 &gt;100张；一般 20-100张；差 &lt;20张</dd></div>
                <div><dt>样本时间</dt><dd>优秀需上午、正午、下午均覆盖且占比均 &gt;20%</dd></div>
                <div><dt>样本重复</dt><dd>优秀 &lt;10%；一般 10%-20%；差 ≥20%</dd></div>
                <div><dt>类别均衡</dt><dd>依据各标签数量与占比综合评估</dd></div>
                <div><dt>目标画幅</dt><dd>BBox &lt;5% 的占比为 0 时优秀，≥20% 时为差</dd></div>
                <div><dt>标注质量</dt><dd>按标注完整性和规范性中的较低等级评定</dd></div>
              </dl>
            </div>
          </el-popover>
        </div>
        <QualityRadar :dimensions="quality.dimensions" />
        <slot name="radar-footer" />
      </div>
      <div class="quality-panel__dimensions">
        <div class="quality-panel__priority-head">
          <strong>六维质量诊断</strong>
          <span>{{ priorityDimensions.length ? `${priorityDimensions.length} 项待关注` : '全部达到优秀' }}</span>
        </div>
        <div class="quality-panel__dimension-scroll">
          <el-collapse v-model="activeDimension" accordion class="quality-panel__accordion">
            <el-collapse-item
              v-for="dimension in orderedDimensions"
              :key="dimension.key"
              :name="dimension.key"
              :class="`is-${dimension.level}`"
            >
              <template #title>
                <span class="quality-panel__dimension-title">
                  <strong>{{ dimension.name }}</strong>
                </span>
                <el-tag class="quality-panel__dimension-level" size="small" :type="tagType(dimension.level)" effect="plain">
                  {{ levelText(dimension.level) }}
                </el-tag>
                <small v-if="dimension.level !== 'notReady'" class="quality-panel__dimension-status">{{ dimension.status }}</small>
              </template>
              <div class="quality-panel__dimension-content">
                <small v-if="!dimension.subMetrics?.length">{{ conciseSuggestion(dimension) }}</small>
                <div v-if="dimension.subMetrics?.length" class="quality-panel__submetrics">
                  <div v-for="metric in dimension.subMetrics" :key="metric.key" class="quality-panel__submetric">
                    <span>{{ metric.key === 'completeness' ? '完整性' : '规范性' }}</span>
                    <div v-if="metric.key === 'completeness'" class="quality-panel__annotation-progress">
                      <el-progress :percentage="metric.rate" :stroke-width="6" :show-text="false" />
                      <span>已标注 <strong>{{ dataset.annotated }}/{{ dataset.total }}</strong></span>
                    </div>
                    <p v-if="metric.key === 'standardization'" class="quality-panel__metric-result">{{ metricGuidance(metric) }}</p>
                    <small v-else>{{ metricGuidance(metric) }}</small>
                  </div>
                </div>
                <div v-if="dimension.level !== 'excellent'" class="quality-panel__dimension-action">
                  <el-button
                    class="dw-ops-secondary"
                    size="small"
                    @click.stop="emit('action', dimensionAction(dimension).key)"
                  >
                    <span class="dw-btn-inner">
                      <component :is="dimensionAction(dimension).icon" :size="14" />
                      {{ dimensionAction(dimension).label }}
                    </span>
                  </el-button>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </div>

    <div v-else class="quality-panel__compact-note">
      <span>{{ quality.issueCount }}项待优化</span>
    </div>
  </section>
</template>

<style scoped>
.quality-panel {
  padding: 14px;
}

.quality-panel__summary,
.quality-panel__compact-note {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quality-panel__compact-note {
  justify-content: space-between;
}

.quality-panel__summary {
  justify-content: flex-start;
}

.quality-panel__standard-trigger {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.quality-panel__standard-trigger:hover {
  color: var(--el-color-primary);
}

.quality-panel__summary-label {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.quality-panel__compact-note,
.quality-panel__dimension-content small,
.quality-panel__dimension-content p {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.quality-panel__overall {
  min-width: 64px;
  height: 34px;
  padding: 0 14px;
  font-size: 16px;
  font-weight: 600;
}

.quality-panel__body {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(240px, 0.95fr);
  align-items: start;
  gap: 18px;
}

.quality-panel__dimensions {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.quality-panel__radar-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.quality-panel__dimension-scroll {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.quality-panel__priority-head,
.quality-panel__annotation-progress {
  display: flex;
  align-items: center;
}

.quality-panel__priority-head {
  flex: 0 0 auto;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.quality-panel__priority-head span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.quality-panel__dimension-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.quality-panel__dimension-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.quality-panel__dimension-title strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.quality-panel__dimension-status {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-panel__dimension-content p {
  margin: 6px 0 2px;
}

.quality-panel__dimension-content small {
  line-height: 18px;
}

.quality-panel__submetrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.quality-panel__submetric {
  min-width: 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--el-fill-color);
}

.quality-panel__submetric > span {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.quality-panel__submetric p {
  margin: 6px 0 2px;
}

.quality-panel__metric-result {
  line-height: 18px;
}

.quality-panel__annotation-progress {
  display: grid;
  grid-template-columns: minmax(48px, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}

.quality-panel__annotation-progress span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.quality-panel__annotation-progress .el-progress {
  flex: 1;
  min-width: 0;
}

.quality-panel__annotation-progress strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.quality-panel__accordion {
  border-top: 0;
  border-bottom: 0;
}

.quality-panel__accordion :deep(.el-collapse-item) {
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.quality-panel__accordion :deep(.el-collapse-item.is-excellent) {
  border-color: color-mix(in srgb, var(--el-color-success) 38%, var(--el-border-color));
}

.quality-panel__accordion :deep(.el-collapse-item.is-normal) {
  border-color: color-mix(in srgb, var(--el-color-warning) 42%, var(--el-border-color));
}

.quality-panel__accordion :deep(.el-collapse-item.is-poor) {
  border-color: color-mix(in srgb, var(--el-color-danger) 46%, var(--el-border-color));
}

.quality-panel__accordion :deep(.el-collapse-item__header) {
  min-height: 42px;
  height: auto;
  padding: 0 10px;
  border-bottom: 0;
  background: transparent;
}

.quality-panel__accordion :deep(.el-collapse-item__title) {
  display: contents;
}

.quality-panel__accordion :deep(.el-collapse-item__arrow) {
  order: 3;
  flex: 0 0 auto;
  margin-left: 8px;
}

.quality-panel__accordion :deep(.el-collapse-item__header:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.quality-panel__accordion :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
  background: transparent;
}

.quality-panel__accordion :deep(.el-collapse-item__content) {
  padding: 0 10px 10px;
}

.quality-panel__dimension-level {
  order: 1;
  flex: 0 0 auto;
  margin-left: 8px;
}

.quality-panel__dimension-status {
  order: 2;
  flex: 0 1 auto;
  max-width: 150px;
  margin-left: auto;
}

.quality-panel__dimension-content {
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color);
}

.quality-panel.is-compact {
  padding: 10px;
}

.quality-panel.is-compact .quality-panel__overall {
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
}

.quality-panel.is-contained {
  height: 100%;
  min-height: 0;
  padding: 0;
}

.quality-panel.is-contained .quality-panel__body {
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

.quality-panel.is-contained .quality-panel__radar-column,
.quality-panel.is-contained .quality-panel__dimensions {
  min-height: 0;
  overflow: hidden;
}

.quality-panel.is-contained .quality-panel__radar-column :deep(.quality-radar) {
  flex: 0 0 auto;
  width: min(100%, 280px);
}

.quality-panel.is-contained .quality-panel__dimension-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 4px 8px 0;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

:global(.quality-standard-popover .quality-panel__standards > strong) {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

:global(.quality-standard-popover .quality-panel__standards dl) {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;
}

:global(.quality-standard-popover .quality-panel__standards dl > div) {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 8px;
}

:global(.quality-standard-popover .quality-panel__standards dt),
:global(.quality-standard-popover .quality-panel__standards dd) {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}

:global(.quality-standard-popover .quality-panel__standards dt) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

:global(.quality-standard-popover .quality-panel__standards dd) {
  color: var(--el-text-color-secondary);
}

@media (max-width: 760px) {
  .quality-panel__body {
    grid-template-columns: 1fr;
  }

  .quality-panel.is-contained {
    overflow-y: auto;
  }

  .quality-panel.is-contained .quality-panel__body {
    height: auto;
  }

  .quality-panel.is-contained .quality-panel__radar-column,
  .quality-panel.is-contained .quality-panel__dimensions {
    overflow: visible;
  }

  .quality-panel.is-contained .quality-panel__dimension-scroll {
    overflow: visible;
  }

  .quality-panel__dimension-status {
    display: none;
  }

  .quality-panel__submetrics {
    grid-template-columns: 1fr;
  }
}
</style>
