<script setup lang="ts">
import { computed } from 'vue'
import { IconChartBar, IconDatabase, IconInfoCircle } from '@tabler/icons-vue'
import {
  workflowState,
  type ModelItem,
  type ModelVersion,
} from '@/state/workflow'

const props = defineProps<{
  modelValue: boolean
  model?: ModelItem
  version?: ModelVersion
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'open-dataset': [version: ModelVersion]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dataset = computed(() => workflowState.datasets.find((item) => item.id === props.version?.datasetId))

const statusLabel = computed(() => {
  const version = props.version
  if (!version) return '--'
  if (version.publishStatus === 'publishing') return '发布中'
  if (version.publishStatus === 'failed') return '发布失败'
  if (version.trainingStatus === 'queued') return '排队中'
  if (version.trainingStatus === 'training') return '训练中'
  if (version.trainingStatus === 'failed') return '训练失败'
  return '训练完成'
})

const publishStatusLabel = computed(() => {
  const version = props.version
  if (!version || version.releaseRole === 'unreleased') return '未发布'
  if (version.publishStatus === 'publishing') return '发布中'
  if (version.publishStatus === 'failed') return '发布失败'
  return '已发布'
})

const statusType = computed(() => {
  const version = props.version
  if (!version) return 'info'
  if (version.trainingStatus === 'failed') return 'danger'
  if (version.trainingStatus === 'training' || version.trainingStatus === 'queued') return 'warning'
  return 'success'
})

function baseModelLabel(version?: ModelVersion) {
  if (!version) return '--'
  return version.baseModel === 'power' ? '电力基础模型' : '通用模型'
}

function trainingMethodLabel(version?: ModelVersion) {
  if (!version) return '--'
  return version.trainingMethod === 'fineTune' ? '微调训练' : '从零训练'
}

function datasetLabelTypeLabel(version?: ModelVersion) {
  const labels: Record<ModelVersion['datasetLabelType'], string> = {
    pointerMeter: '指针表',
    digitalMeter: '数字表',
    status: '状态识别',
    defect: '缺陷识别',
    generic: '通用',
  }
  return version?.datasetLabelType ? labels[version.datasetLabelType] : '--'
}

function trainingDuration(version?: ModelVersion) {
  if (!version?.trainingStartedAt || !version.trainingFinishedAt) return version?.trainingStatus === 'training' ? '进行中' : '--'
  const duration = new Date(version.trainingFinishedAt).getTime() - new Date(version.trainingStartedAt).getTime()
  if (!Number.isFinite(duration) || duration <= 0) return '--'
  const minutes = Math.floor(duration / 60000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="var(--dw-dialog-size-medium)"
    align-center
    append-to-body
    class="model-version-detail-dialog"
  >
    <template #header>
      <div class="version-dialog-title">
        <div>
          <strong>版本详情</strong>
          <span v-if="model && version">{{ model.name }} / V{{ version.versionNumber }}</span>
        </div>
      </div>
    </template>

    <div v-if="version" class="version-dialog-body">
      <section v-if="version.trainingStatus === 'training'" class="version-progress">
        <div><span>当前训练进度</span><strong>{{ version.progress ?? 0 }}%</strong></div>
        <el-progress :percentage="version.progress ?? 0" :stroke-width="7" />
      </section>

      <section class="version-section">
        <h3><IconInfoCircle :size="17" />版本信息</h3>
        <dl class="version-grid">
          <div><dt>模型名称</dt><dd>{{ model?.name ?? '--' }}</dd></div>
          <div><dt>版本</dt><dd>V{{ version.versionNumber }}</dd></div>
          <div><dt>发布状态</dt><dd>{{ publishStatusLabel }}</dd></div>
          <div><dt>发布时间</dt><dd>{{ version.publishedAt ?? '--' }}</dd></div>
        </dl>
      </section>

      <section class="version-section">
        <h3><IconDatabase :size="17" />训练数据</h3>
        <dl class="version-grid">
          <div>
            <dt>训练数据集</dt>
            <dd>
              <button type="button" class="version-dialog-dataset-link" @click="emit('open-dataset', version)">
                {{ version.datasetName }}
              </button>
            </dd>
          </div>
          <div><dt>数据集标签</dt><dd>{{ datasetLabelTypeLabel(version) }}</dd></div>
          <div><dt>图片数量</dt><dd>{{ dataset?.total ?? '--' }} 张</dd></div>
          <div><dt>已标注图片</dt><dd>{{ dataset ? `${dataset.annotated}/${dataset.total}` : '--' }}</dd></div>
        </dl>
      </section>

      <section class="version-section">
        <h3><IconChartBar :size="17" />训练配置</h3>
        <dl class="version-grid">
          <div><dt>训练状态</dt><dd><el-tag size="small" :type="statusType">{{ statusLabel }}</el-tag></dd></div>
          <div><dt>基础模型</dt><dd>{{ baseModelLabel(version) }}</dd></div>
          <div><dt>训练方式</dt><dd>{{ trainingMethodLabel(version) }}</dd></div>
          <div><dt>Epoch / 训练轮数</dt><dd>{{ version.parameters.epochs }}</dd></div>
          <div><dt>Batch Size</dt><dd>{{ version.parameters.batchSize }}</dd></div>
          <div><dt>Image Size / 图片尺寸</dt><dd>{{ version.parameters.imageSize }}</dd></div>
          <div><dt>Early Stop</dt><dd>{{ version.parameters.earlyStop }}</dd></div>
          <div><dt>训练开始时间</dt><dd>{{ version.trainingStartedAt ?? '--' }}</dd></div>
          <div><dt>训练结束时间</dt><dd>{{ version.trainingFinishedAt ?? '--' }}</dd></div>
          <div><dt>训练耗时</dt><dd>{{ trainingDuration(version) }}</dd></div>
        </dl>
      </section>
    </div>

    <template #footer>
      <div class="version-dialog-actions">
        <el-button type="primary" @click="visible = false">知道了</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.version-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-primary);
}

.version-dialog-title div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-dialog-title strong {
  font-size: 16px;
}

.version-dialog-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.version-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-progress,
.version-section {
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.version-progress > div {
  display: flex;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.version-progress strong {
  color: var(--el-color-primary);
}

.version-section h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.version-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.version-grid > div {
  min-width: 0;
  padding: 7px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.version-grid dt {
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.version-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 20px;
}

.version-dialog-actions {
  display: flex;
  justify-content: flex-end;
}

.version-dialog-dataset-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.version-dialog-dataset-link:hover {
  text-decoration: underline;
}

:global(.model-version-detail-dialog.el-dialog) {
  max-height: min(600px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
}

:global(.model-version-detail-dialog .el-dialog__header),
:global(.model-version-detail-dialog .el-dialog__footer) {
  flex: 0 0 auto;
}

:global(.model-version-detail-dialog .el-dialog__header) {
  padding: 14px 16px 10px;
}

:global(.model-version-detail-dialog .el-dialog__body) {
  min-height: 0;
  padding: 0 16px;
  overflow-y: auto !important;
  scrollbar-width: thin;
}

:global(.model-version-detail-dialog .el-dialog__footer) {
  padding: 10px 16px 14px;
}

@media (max-width: 640px) {
  .version-grid {
    grid-template-columns: 1fr;
  }
}
</style>
