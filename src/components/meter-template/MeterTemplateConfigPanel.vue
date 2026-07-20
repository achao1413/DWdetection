<script setup lang="ts">
import { computed } from 'vue'
import {
  IconArrowLeft,
  IconBook,
  IconCircleCheck,
  IconInfoCircle,
  IconMinus,
  IconPlus,
} from '@tabler/icons-vue'
import {
  meterRangeSegments,
  type GuideLineDensity,
  type MeterStepPhase,
  type MeterTemplateStepId,
  type NormalizedPoint,
  type NormalizedRect,
} from '@/state/meterTemplateConfiguration'

const props = defineProps<{
  currentStep: MeterTemplateStepId
  dialRect: NormalizedRect | null
  centerPoint: NormalizedPoint | null
  templateName: string
  analysisType: string
  currentStepIndex: number
  phase: MeterStepPhase
  taskDescription: string
  confirmLabel?: string
  guideLineDensity: GuideLineDensity
  guideLineCount: number
  referenceHintVisible?: boolean
}>()

const emit = defineEmits<{
  'update:templateName': [value: string]
  'update:analysisType': [value: string]
  'update:guideLineDensity': [value: GuideLineDensity]
  'update:guideLineCount': [value: number]
  showReference: []
  previousStep: []
  confirmStep: []
}>()

const panelTitle = computed(() => {
  if (props.currentStep === 'dial') return '表盘定位结果'
  if (props.currentStep === 'center') return '指针轴心结果'
  if (props.currentStep === 'range') return '角度和量程'
  return '表计模板配置信息'
})

const dialSizeText = computed(() => {
  if (!props.dialRect) return '等待框选'
  return `宽 ${(props.dialRect.width * 100).toFixed(0)}% · 高 ${(props.dialRect.height * 100).toFixed(0)}%`
})

const centerText = computed(() => {
  if (!props.centerPoint) return '等待选择'
  return `X ${(props.centerPoint.x * 100).toFixed(1)}% · Y ${(props.centerPoint.y * 100).toFixed(1)}%`
})

function updateAnalysisType(value: string | number | boolean | object | undefined) {
  emit('update:analysisType', typeof value === 'string' ? value : '')
}

function updateGuideLineCount(value: number | number[]) {
  const count = Array.isArray(value) ? value[0] : value
  emit('update:guideLineCount', count)
  emit('update:guideLineDensity', count >= 30 ? 'high' : count >= 20 ? 'medium' : 'low')
}
</script>

<template>
  <aside class="meter-config" aria-label="表计模板配置信息">
    <header class="meter-config__head">
      <div>
        <h2>{{ panelTitle }}</h2>
        <p>{{ taskDescription }}</p>
      </div>
      <el-popover
        v-if="currentStep !== 'details' && referenceHintVisible"
        :visible="true"
        placement="left"
        width="220"
        content="操作参考可从这里重新打开"
        popper-class="dw-meter-reference-hint"
      >
        <template #reference>
          <el-button
            class="meter-config__reference dw-ops-secondary"
            circle
            aria-label="查看图示"
            @click="emit('showReference')"
          >
            <IconBook :size="17" stroke="1.8" />
          </el-button>
        </template>
      </el-popover>
      <el-tooltip
        v-else-if="currentStep !== 'details'"
        content="查看图示"
        placement="left"
        effect="dark"
        popper-class="dw-ops-tooltip"
      >
        <el-button
          class="meter-config__reference dw-ops-secondary"
          circle
          aria-label="查看图示"
          @click="emit('showReference')"
        >
          <IconBook :size="17" stroke="1.8" />
        </el-button>
      </el-tooltip>
    </header>

    <div class="meter-config__scroll">
      <template v-if="currentStep === 'dial'">
        <section class="meter-config__result" :class="{ 'is-ready': dialRect }">
          <IconCircleCheck v-if="dialRect" :size="20" />
          <span v-else class="meter-config__result-dot" />
          <div>
            <strong>{{ dialRect ? '已识别表盘区域' : '尚未框选表盘' }}</strong>
            <p>{{ dialSizeText }}</p>
          </div>
        </section>
      </template>

      <template v-else-if="currentStep === 'center'">
        <section class="meter-config__result" :class="{ 'is-ready': centerPoint }">
          <IconCircleCheck v-if="centerPoint" :size="20" />
          <span v-else class="meter-config__result-dot" />
          <div>
            <strong>{{ centerPoint ? '已选择指针轴心' : '尚未选择指针轴心' }}</strong>
            <p>{{ centerText }}</p>
          </div>
        </section>
        <section class="meter-config__density-section">
          <div class="meter-config__density-heading">
            <div>
              <strong>辅助线密度</strong>
              <small>调整线数观察刻度对齐的细微偏差</small>
            </div>
            <span>{{ guideLineCount }} 条</span>
          </div>
          <el-slider
            :model-value="guideLineCount"
            :min="12"
            :max="48"
            :step="2"
            aria-label="辅助线密度"
            @update:model-value="updateGuideLineCount"
          />
        </section>
      </template>

      <section v-else-if="currentStep === 'range'" class="meter-config__ranges">
        <header>
          <div>
            <h3>角度和量程</h3>
            <span>共 {{ meterRangeSegments.length }} 段</span>
          </div>
          <div class="meter-config__range-actions">
            <el-button size="small" class="dw-ops-secondary" disabled aria-label="减少量程段">
              <IconMinus :size="15" />
            </el-button>
            <el-button size="small" class="dw-ops-secondary" disabled aria-label="增加量程段">
              <IconPlus :size="15" />
            </el-button>
          </div>
        </header>
        <p class="meter-config__range-note">预设量程覆盖最小值到最大值，非均匀刻度采用多段表达。</p>
        <div class="meter-config__range-list">
          <article v-for="segment in meterRangeSegments" :key="segment.id" class="meter-config__range-card">
            <div class="meter-config__range-title">
              <strong>{{ segment.name }}</strong>
              <span>{{ segment.angle }}</span>
            </div>
            <div class="meter-config__range-grid">
              <label>
                <span>起始量程</span>
                <el-input :model-value="segment.startValue" readonly />
              </label>
              <label>
                <span>终止量程</span>
                <el-input :model-value="segment.endValue" readonly />
              </label>
            </div>
          </article>
        </div>
      </section>

      <template v-else>
        <label class="meter-config__field">
          <span><b>*</b> 模板名称</span>
          <el-input
            :model-value="templateName"
            maxlength="32"
            show-word-limit
            placeholder="请输入模板名称"
            @update:model-value="emit('update:templateName', $event)"
          />
        </label>

        <label class="meter-config__field">
          <span class="meter-config__label-with-help">
            <span><b>*</b> 指针类型</span>
            <el-tooltip
              content="指针类型代表用于当前模板推理的算法分析类型"
              placement="top"
              effect="dark"
              popper-class="dw-ops-tooltip"
            >
              <IconInfoCircle :size="16" stroke="1.7" />
            </el-tooltip>
          </span>
          <el-select
            :model-value="analysisType"
            placeholder="请选择指针类型"
            @update:model-value="updateAnalysisType"
          >
            <el-option label="表计读数" value="meter-reading" />
            <el-option label="指针状态识别" value="pointer-status" />
          </el-select>
          <small>用于当前模板推理的算法分析类型</small>
        </label>

      </template>
    </div>

    <footer v-if="currentStepIndex > 0 || confirmLabel" class="meter-config__footer">
      <div class="meter-config__footer-actions">
        <el-button
          v-if="currentStepIndex > 0"
          class="dw-ops-secondary"
          @click="emit('previousStep')"
        >
          <span class="dw-btn-inner"><IconArrowLeft :size="16" />上一步</span>
        </el-button>
        <el-button
          v-if="confirmLabel"
          type="primary"
          :disabled="phase !== 'ready'"
          @click="emit('confirmStep')"
        >
          {{ confirmLabel }}
        </el-button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.meter-config {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-blank);
  border-left: 1px solid var(--el-border-color);
}

.meter-config__head {
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--el-border-color);
}

.meter-config h2,
.meter-config h3,
.meter-config p {
  margin: 0;
}

.meter-config h2 {
  font-size: 15px;
  line-height: 22px;
}

.meter-config__head p {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 17px;
}

.meter-config__reference {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
}

.meter-config__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
  scrollbar-width: thin;
}

.meter-config__result {
  min-height: 68px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
}

.meter-config__result.is-ready {
  border-color: var(--el-color-success);
  color: var(--el-color-success);
}

.meter-config__result-dot {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 50%;
  border: 2px solid var(--el-border-color);
}

.meter-config__result div {
  min-width: 0;
}

.meter-config__result strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.meter-config__result p {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.meter-config__density-section {
  display: grid;
  gap: 12px;
  margin-top: 20px;
  padding: 14px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.meter-config__density-heading,
.meter-config__density-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meter-config__density-heading > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.meter-config__density-heading strong,
.meter-config__density-custom span {
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.meter-config__density-heading small,
.meter-config__density-heading > span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-config__density-section :deep(.el-radio-group) {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.meter-config__density-section :deep(.el-radio-button__inner) {
  width: 100%;
}

.meter-config__density-custom :deep(.el-input-number) {
  width: 118px;
}

.meter-config__field {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.meter-config__field b {
  color: var(--el-color-danger);
}

.meter-config__field small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-config__label-with-help {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meter-config__ranges > header,
.meter-config__ranges > header > div:first-child,
.meter-config__range-actions,
.meter-config__range-title {
  display: flex;
  align-items: center;
}

.meter-config__ranges > header {
  justify-content: space-between;
  gap: 12px;
}

.meter-config__ranges > header > div:first-child {
  gap: 8px;
}

.meter-config__ranges h3 {
  font-size: 14px;
}

.meter-config__ranges > header span,
.meter-config__range-title span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-config__range-actions {
  gap: 8px;
}

.meter-config__range-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.meter-config__range-note {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.55;
}

.meter-config__range-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.meter-config__range-card {
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.meter-config__range-title {
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 12px;
}

.meter-config__range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meter-config__range-grid label {
  display: grid;
  gap: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-config__footer {
  flex: 0 0 auto;
  padding: 12px 16px;
  background: var(--el-fill-color-blank);
  border-top: 1px solid var(--el-border-color);
}

.meter-config__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meter-config__footer-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.meter-config__footer-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 1100px) {
  .meter-config__footer-actions .el-button {
    padding-inline: 9px;
  }
}
</style>
