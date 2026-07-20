<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  createTraining,
  deployTraining,
  getAlgorithm,
  getDataset,
  workflowState,
  type OverallQualityLevel,
  type TrainingJob,
} from '@/state/workflow'
import DatasetDetailDialog from '@/components/DatasetDetailDialog.vue'
import ProblemDiagnosisDialog from '@/components/ProblemDiagnosisDialog.vue'
import TrainingQualityRiskDialog from '@/components/TrainingQualityRiskDialog.vue'
import {
  applyDiagnosisMockAction,
  buildTrainingPreflightReport,
  type DiagnosisIssue,
  type DiagnosisReport,
} from '@/state/preflightChecks'

const props = defineProps<{
  modelValue: boolean
  algorithmId?: string
  datasetId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [jobId: string]
}>()

const router = useRouter()
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const trainableAlgorithms = computed(() => {
  const powerAlgorithm = workflowState.algorithms.find((algorithm) => algorithm.id === 'meter')
  return powerAlgorithm
    ? [{ ...powerAlgorithm, name: '电力检测算法' }]
    : workflowState.algorithms.slice(0, 1)
})

function defaultTrainingAlgorithmId() {
  return trainableAlgorithms.value[0]?.id ?? workflowState.algorithms[0]?.id ?? ''
}

function versionNumber(version: string) {
  return Number.parseInt(version.replace(/\D/g, ''), 10) || 0
}

function resolveTrainingAlgorithmId(algorithmId?: string) {
  if (algorithmId && trainableAlgorithms.value.some((algorithm) => algorithm.id === algorithmId)) {
    return algorithmId
  }
  return defaultTrainingAlgorithmId()
}

function qualityTagType(level: OverallQualityLevel) {
  if (level === 'excellent') return 'success'
  if (level === 'normal') return 'warning'
  if (level === 'poor') return 'danger'
  return 'info'
}

function qualityLabel(level: OverallQualityLevel) {
  if (level === 'excellent') return '优秀'
  if (level === 'normal') return '一般'
  if (level === 'poor') return '待优化'
  return '待评估'
}

const form = reactive({
  algorithmId: resolveTrainingAlgorithmId(props.algorithmId),
  datasetId: props.datasetId ?? workflowState.datasets[0]?.id ?? '',
  mode: '新增子类' as TrainingJob['mode'],
  analysisTypeId: workflowState.analysisTypes[0]?.id ?? '',
  typeName: '',
  advanced: false,
})
const diagnosisOpen = ref(false)
const diagnosisReport = ref<DiagnosisReport | null>(null)
const qualityRiskOpen = ref(false)
const qualityReportOpen = ref(false)
const precheckLoading = ref(false)

const selectedDataset = computed(() => getDataset(form.datasetId))
const selectedAlgorithm = computed(() => getAlgorithm(form.algorithmId))
const selectedAnalysis = computed(() =>
  workflowState.analysisTypes.find((item) => item.id === form.analysisTypeId) ?? workflowState.analysisTypes[0],
)
const latestTrainingJob = computed(() => {
  const jobs = workflowState.trainingJobs
    .filter((job) => job.algorithmId === form.algorithmId && (job.status === '训练成功' || job.status === '已部署'))
    .sort((left, right) => versionNumber(right.version) - versionNumber(left.version))
  return jobs[0]
})
const hasNewerTrainingVersion = computed(() => {
  const latest = latestTrainingJob.value
  if (!latest) return false
  return versionNumber(latest.version) > versionNumber(selectedAlgorithm.value.version)
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.datasetId = props.datasetId ?? workflowState.datasets[0].id
    form.algorithmId = resolveTrainingAlgorithmId(props.algorithmId)
    form.analysisTypeId = selectedDataset.value.analysisTypeId
    form.typeName = selectedAnalysis.value?.name ?? ''
  },
  { immediate: true },
)

watch(
  () => form.datasetId,
  (datasetId) => {
    form.algorithmId = defaultTrainingAlgorithmId()
    form.analysisTypeId = getDataset(datasetId).analysisTypeId
    form.typeName = selectedAnalysis.value?.name ?? ''
  },
)

function createJob() {
  const job = createTraining({
    algorithmId: form.algorithmId,
    datasetId: form.datasetId,
    analysisTypeId: form.analysisTypeId,
    mode: form.mode,
    typeName: form.typeName || selectedAnalysis.value.name,
  })
  ElMessage.success('训练任务已创建')
  emit('created', job.id)
  visible.value = false
}

function deployLatestTrainingVersion() {
  const latest = latestTrainingJob.value
  if (!latest) return
  deployTraining(latest.id)
  ElMessage.success(`已部署最新算法版本 ${latest.version}`)
}

async function startPreflight() {
  if (precheckLoading.value) return
  precheckLoading.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    const report = buildTrainingPreflightReport({
      algorithmId: form.algorithmId,
      datasetId: form.datasetId,
      analysisTypeId: form.analysisTypeId,
      mode: form.mode,
    })
    if (report.status === 'pass') {
      createJob()
      return
    }
    diagnosisReport.value = report
    diagnosisOpen.value = true
  } finally {
    precheckLoading.value = false
  }
}

function submit() {
  startPreflight()
}

function continueAfterQualityRisk() {
  qualityRiskOpen.value = false
  createJob()
}

function continueAfterDiagnosis() {
  diagnosisOpen.value = false
  if (selectedDataset.value.qualityStatus.overallLevel === 'poor') {
    qualityRiskOpen.value = true
    return
  }
  createJob()
}

function handleDiagnosisAction(actionKey: string, issue: DiagnosisIssue) {
  applyDiagnosisMockAction(actionKey)
  if (actionKey === 'continue-annotation' || actionKey === 'review-bbox' || actionKey === 'review-labels') {
    ElMessage.info(issue.title.includes('未标注') ? '已跳转到标注工具' : '已跳转到问题图片核验')
    diagnosisOpen.value = false
    visible.value = false
    router.push({ name: 'annotation-tool', params: { datasetId: form.datasetId } })
    return
  }

  if (actionKey === 'upload-template') {
    diagnosisOpen.value = false
    visible.value = false
    router.push({ name: 'meter-template-settings' })
    return
  }

  if (actionKey === 'view-missed-images') {
    diagnosisOpen.value = false
    visible.value = false
    router.push({ name: 'meter-template-validation' })
  }
}

function goSelectedDatasetAnnotation() {
  diagnosisOpen.value = false
  visible.value = false
  router.push({ name: 'annotation-tool', params: { datasetId: form.datasetId } })
}
</script>

<template>
  <el-dialog v-model="visible" width="var(--dw-dialog-size-small)" align-center class="dw-training-dialog" append-to-body>
    <template #header>
      <div class="dw-dialog-title">新建训练</div>
    </template>

    <div class="dw-train-form">
      <label class="dw-form-line">
        <span>训练算法</span>
        <div class="dw-algorithm-select">
          <el-select v-model="form.algorithmId" size="default">
            <el-option
              v-for="algorithm in trainableAlgorithms"
              :key="algorithm.id"
              :label="algorithm.name"
              :value="algorithm.id"
            >
              <div class="dw-algorithm-option">
                <span>{{ algorithm.name }}</span>
                <small>{{ getAlgorithm(algorithm.id).version }}</small>
              </div>
            </el-option>
          </el-select>
          <span class="dw-algorithm-version">{{ selectedAlgorithm.version }}</span>
        </div>
      </label>
      <div v-if="hasNewerTrainingVersion && latestTrainingJob" class="dw-version-alert">
        <span>注意：训练列表中最新算法版本为 {{ latestTrainingJob.version }}</span>
        <el-button link type="primary" @click="deployLatestTrainingVersion">先部署最新算法</el-button>
      </div>

      <label class="dw-form-line">
        <span>标注数据集</span>
        <div class="dw-dataset-select">
          <el-select v-model="form.datasetId" size="default">
            <el-option
              v-for="dataset in workflowState.datasets"
              :key="dataset.id"
              :label="dataset.name"
              :value="dataset.id"
            >
              <div class="dw-dataset-option">
                <span>{{ dataset.name }}</span>
                <el-tag size="small" :type="qualityTagType(dataset.qualityStatus.overallLevel)" effect="plain">
                  {{ qualityLabel(dataset.qualityStatus.overallLevel) }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
          <el-tag
            class="dw-dataset-select__quality"
            size="small"
            :type="qualityTagType(selectedDataset.qualityStatus.overallLevel)"
            effect="plain"
          >
            {{ qualityLabel(selectedDataset.qualityStatus.overallLevel) }}
          </el-tag>
        </div>
      </label>

      <div class="dw-form-line">
        <span>训练方式</span>
        <el-radio-group v-model="form.mode">
          <el-radio-button label="新增子类" value="新增子类" />
          <el-radio-button label="更新子类" value="更新子类" />
        </el-radio-group>
      </div>

      <div class="dw-form-line">
        <span>分析类型</span>
        <el-radio-group v-model="form.analysisTypeId">
          <el-radio-button
            v-for="type in workflowState.analysisTypes"
            :key="type.id"
            :label="type.name"
            :value="type.id"
          />
        </el-radio-group>
      </div>

      <label class="dw-form-line">
        <span>类型名称</span>
        <el-input v-model="form.typeName" maxlength="32" show-word-limit placeholder="请输入类型名称" />
      </label>

      <div class="dw-label-map">
        <div class="dw-label-map__head">
          <span>标签映射</span>
          <span>{{ selectedAnalysis.labels.length }} 个标签</span>
        </div>
        <div v-for="label in selectedAnalysis.labels" :key="label" class="dw-label-map__row">
          <span>{{ label }}</span>
          <el-tag size="small" effect="dark">{{ label }}</el-tag>
        </div>
      </div>

      <el-collapse v-model="form.advanced" class="dw-advanced">
        <el-collapse-item title="高级设置" name="advanced">
          <div class="dw-advanced-grid">
            <span>训练轮次</span><el-input-number :model-value="120" :min="1" size="small" />
            <span>置信度</span><el-slider :model-value="72" :show-tooltip="false" />
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <template #footer>
      <div class="dw-dialog-footer">
        <span class="dw-precheck-target">训前静态自检目标 &lt;20秒</span>
        <el-button @click="visible = false">上一步</el-button>
        <el-button type="primary" :loading="precheckLoading" :disabled="precheckLoading" @click="submit">
          {{ precheckLoading ? '正在自检' : '开始训练' }}
        </el-button>
      </div>
    </template>

    <ProblemDiagnosisDialog
      v-model="diagnosisOpen"
      :report="diagnosisReport"
      @continue="continueAfterDiagnosis"
      @action="handleDiagnosisAction"
      @quality-report="qualityReportOpen = true"
      @annotate="goSelectedDatasetAnnotation"
    />
    <TrainingQualityRiskDialog
      v-model="qualityRiskOpen"
      :dataset="selectedDataset"
      @continue="continueAfterQualityRisk"
    />
    <DatasetDetailDialog
      v-model="qualityReportOpen"
      :dataset-id="selectedDataset.id"
      @train="qualityReportOpen = false"
    />
  </el-dialog>
</template>

<style scoped>
.dw-dialog-title {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.dw-precheck-target {
  margin-right: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-train-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dw-form-line {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.dw-algorithm-select {
  position: relative;
  min-width: 0;
}

.dw-algorithm-select .el-select {
  width: 100%;
}

.dw-algorithm-select :deep(.el-select__wrapper),
.dw-dataset-select :deep(.el-select__wrapper) {
  position: relative;
}

.dw-algorithm-select :deep(.el-select__wrapper) {
  padding-right: 76px;
}

.dw-algorithm-select :deep(.el-select__suffix),
.dw-dataset-select :deep(.el-select__suffix) {
  position: absolute;
  right: 12px;
}

.dw-algorithm-version {
  position: absolute;
  top: 50%;
  right: 38px;
  z-index: 1;
  transform: translateY(-50%);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  pointer-events: none;
}

.dw-algorithm-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.dw-algorithm-option small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-dataset-select {
  position: relative;
  min-width: 0;
}

.dw-dataset-select .el-select {
  width: 100%;
}

.dw-dataset-select :deep(.el-select__wrapper) {
  padding-right: 118px;
}

.dw-dataset-select__quality {
  position: absolute;
  top: 50%;
  right: 38px;
  z-index: 1;
  max-width: 82px;
  transform: translateY(-50%);
  pointer-events: none;
}

.dw-dataset-option {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dw-dataset-option > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-version-alert {
  min-height: 32px;
  margin: -8px 0 0 96px;
  padding: 6px 10px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-radius: 2px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  font-size: 12px;
  line-height: 18px;
}

.dw-version-alert :deep(.el-button) {
  height: 20px;
  padding: 0;
  font-size: 12px;
}

.dw-label-map {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.dw-label-map__head,
.dw-label-map__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.dw-label-map__row:last-child {
  border-bottom: 0;
}

.dw-advanced {
  --el-collapse-border-color: var(--el-border-color);
}

.dw-advanced-grid {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
