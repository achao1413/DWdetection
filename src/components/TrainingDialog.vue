<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconBulb, IconChevronDown, IconRefresh } from '@tabler/icons-vue'
import DatasetDetailDialog from '@/components/DatasetDetailDialog.vue'
import ProblemDiagnosisDialog from '@/components/ProblemDiagnosisDialog.vue'
import {
  createModelTraining,
  getNextModelVersionNumber,
  hasActiveModelTraining,
  suggestModelName,
  workflowState,
  type BaseModelType,
  type ModelParameters,
  type OverallQualityLevel,
} from '@/state/workflow'
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
  modelId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [versionId: string]
}>()

const recommendedParameters: ModelParameters = {
  epochs: 100,
  batchSize: 16,
  imageSize: 640,
  earlyStop: 15,
}

const router = useRouter()
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const form = reactive({
  modelSelection: '',
  datasetId: props.datasetId ?? '',
  baseModel: 'power' as BaseModelType,
  advancedOpen: false,
  parameters: { ...recommendedParameters },
})
const diagnosisOpen = ref(false)
const diagnosisReport = ref<DiagnosisReport | null>(null)
const qualityReportOpen = ref(false)
const precheckLoading = ref(false)
const modelNameTouched = ref(false)

const selectedDataset = computed(() => workflowState.datasets.find((item) => item.id === form.datasetId))
const selectedModel = computed(() => workflowState.models.find((item) => item.id === form.modelSelection))
const modelName = computed(() => selectedModel.value?.name ?? form.modelSelection.trim())
const suggestedModelName = computed(() => form.datasetId ? suggestModelName(form.datasetId) : '')
const nextVersionNumber = computed(() => getNextModelVersionNumber(selectedModel.value?.id, modelName.value))
const trainingBlocked = computed(() => hasActiveModelTraining())

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

function resetParameters() {
  Object.assign(form.parameters, recommendedParameters)
  ElMessage.success('已恢复系统推荐参数')
}

function resetForm() {
  form.datasetId = props.datasetId ?? workflowState.datasets[0]?.id ?? ''
  form.modelSelection = props.modelId ?? ''
  form.baseModel = 'power'
  form.advancedOpen = false
  Object.assign(form.parameters, recommendedParameters)
  modelNameTouched.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  },
  { immediate: true },
)

watch(
  () => form.modelSelection,
  () => {
    if (visible.value) modelNameTouched.value = true
  },
)

function useSuggestion() {
  if (!suggestedModelName.value) return
  const existing = workflowState.models.find((item) => item.name === suggestedModelName.value)
  form.modelSelection = existing?.id ?? suggestedModelName.value
  modelNameTouched.value = true
}

function validateForm() {
  if (!modelName.value) {
    ElMessage.warning('请选择已有模型或输入新模型名称')
    return false
  }
  if (!selectedDataset.value) {
    ElMessage.warning('请选择训练数据集')
    return false
  }
  return true
}

function createVersion() {
  if (!selectedDataset.value) return
  try {
    const result = createModelTraining({
      modelId: selectedModel.value?.id,
      modelName: modelName.value,
      datasetId: selectedDataset.value.id,
      baseModel: form.baseModel,
      parameters: { ...form.parameters },
    })
    ElMessage.success(`${result.model.name} V${result.version.versionNumber} 已开始训练`)
    emit('created', result.version.id)
    visible.value = false
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '暂时无法发起训练')
  }
}

async function startPreflight() {
  if (!validateForm() || precheckLoading.value || !selectedDataset.value) return
  if (trainingBlocked.value) {
    ElMessage.warning('当前已有模型正在训练，完成后才能发起新训练')
    return
  }
  precheckLoading.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
    const report = buildTrainingPreflightReport({
      algorithmId: selectedDataset.value.algorithmId,
      datasetId: selectedDataset.value.id,
      analysisTypeId: selectedDataset.value.analysisTypeId,
      mode: '新增子类',
    })
    if (report.status === 'pass') {
      createVersion()
      return
    }
    diagnosisReport.value = report
    diagnosisOpen.value = true
  } finally {
    precheckLoading.value = false
  }
}

function continueAfterDiagnosis() {
  diagnosisOpen.value = false
  createVersion()
}

function handleDiagnosisAction(actionKey: string, issue: DiagnosisIssue) {
  applyDiagnosisMockAction(actionKey)
  if (actionKey === 'continue-annotation' || actionKey === 'review-bbox' || actionKey === 'review-labels') {
    ElMessage.info(issue.title.includes('未标注') ? '已跳转到标注工具' : '已跳转到问题图片核验')
    diagnosisOpen.value = false
    visible.value = false
    router.push({ name: 'annotation-tool', params: { datasetId: form.datasetId } })
  }
}

function goSelectedDatasetAnnotation() {
  diagnosisOpen.value = false
  visible.value = false
  router.push({ name: 'annotation-tool', params: { datasetId: form.datasetId } })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="var(--dw-dialog-size-medium)"
    align-center
    append-to-body
    class="dw-training-dialog"
  >
    <template #header>
      <div class="dw-dialog-title">新建训练</div>
    </template>

    <div class="dw-train-form">
      <label class="dw-form-line">
        <span>模型名称</span>
        <div class="dw-model-field">
          <el-select
            v-model="form.modelSelection"
            filterable
            allow-create
            default-first-option
            placeholder="搜索已有模型或输入新模型名称"
          >
            <el-option
              v-for="model in workflowState.models"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            >
              <div class="dw-model-option">
                <span>{{ model.name }}</span>
                <small>{{ model.versionIds.length }} 个版本</small>
              </div>
            </el-option>
          </el-select>
          <div v-if="modelName" class="dw-version-preview">
            <span>本次训练将创建 <strong>V{{ nextVersionNumber }}</strong>，历史版本不会被覆盖</span>
          </div>
        </div>
      </label>

      <label class="dw-form-line">
        <span>训练数据集</span>
        <div class="dw-dataset-field">
          <el-select v-model="form.datasetId" placeholder="请选择训练数据集">
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
            v-if="selectedDataset"
            class="dw-selected-quality"
            size="small"
            :type="qualityTagType(selectedDataset.qualityStatus.overallLevel)"
            effect="plain"
          >
            {{ qualityLabel(selectedDataset.qualityStatus.overallLevel) }}
          </el-tag>
        </div>
      </label>

      <div
        v-if="suggestedModelName && (!modelNameTouched || !modelName)"
        class="dw-model-suggestion"
      >
        <span><IconBulb :size="16" />根据数据集标签，推荐模型名称“{{ suggestedModelName }}”</span>
        <el-button link type="primary" @click="useSuggestion">使用推荐名称</el-button>
      </div>

      <div class="dw-form-line is-top">
        <span>基础模型</span>
        <el-radio-group v-model="form.baseModel" class="dw-base-models">
          <el-radio-button value="power">
            <strong>电力基础模型</strong>
            <small>使用行业特征进行微调训练</small>
          </el-radio-button>
          <el-radio-button value="generic">
            <strong>通用模型</strong>
            <small>不继承行业能力，从零训练</small>
          </el-radio-button>
        </el-radio-group>
      </div>

      <section class="dw-advanced">
        <button type="button" class="dw-advanced__head" @click="form.advancedOpen = !form.advancedOpen">
          <span>高级参数</span>
          <small>默认使用系统推荐值</small>
          <IconChevronDown :size="17" :class="{ 'is-open': form.advancedOpen }" />
        </button>
        <div v-show="form.advancedOpen" class="dw-advanced__body">
          <label><span>Epoch / 训练轮数</span><el-input-number v-model="form.parameters.epochs" :min="1" :max="500" /></label>
          <label><span>Batch Size</span><el-input-number v-model="form.parameters.batchSize" :min="1" :max="128" /></label>
          <label><span>Image Size / 图片尺寸</span><el-input-number v-model="form.parameters.imageSize" :min="320" :max="2048" :step="32" /></label>
          <label><span>Early Stop</span><el-input-number v-model="form.parameters.earlyStop" :min="0" :max="100" /></label>
          <el-button class="dw-ops-secondary" @click="resetParameters">
            <IconRefresh :size="15" />恢复推荐值
          </el-button>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dw-dialog-actions">
        <el-button @click="visible = false">取消</el-button>
        <el-tooltip
          :disabled="!trainingBlocked"
          content="当前已有模型正在训练，完成后才能发起新训练"
          placement="top"
        >
          <span>
            <el-button
              type="primary"
              :loading="precheckLoading"
              :disabled="trainingBlocked"
              @click="startPreflight"
            >开始训练</el-button>
          </span>
        </el-tooltip>
      </div>
    </template>
  </el-dialog>

  <ProblemDiagnosisDialog
    v-model="diagnosisOpen"
    :report="diagnosisReport"
    @continue="continueAfterDiagnosis"
    @action="handleDiagnosisAction"
    @quality-report="qualityReportOpen = true"
    @annotate="goSelectedDatasetAnnotation"
  />
  <DatasetDetailDialog
    v-if="selectedDataset"
    v-model="qualityReportOpen"
    :dataset-id="selectedDataset.id"
    @annotate="goSelectedDatasetAnnotation"
  />
</template>

<style scoped>
.dw-train-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dw-form-line {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: start;
  gap: 14px;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.dw-form-line > span {
  padding-top: 9px;
  font-weight: 600;
}

.dw-model-field,
.dw-dataset-field {
  position: relative;
  min-width: 0;
}

.dw-dataset-field :deep(.el-select__wrapper) {
  padding-right: 12px;
}

.dw-dataset-field :deep(.el-select__selection) {
  padding-right: 64px;
}

.dw-selected-quality {
  position: absolute;
  top: 8px;
  right: 36px;
  pointer-events: none;
}

.dw-model-option,
.dw-dataset-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dw-model-option small {
  color: var(--el-text-color-secondary);
}

.dw-version-preview,
.dw-model-suggestion {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.dw-version-preview strong {
  color: var(--el-color-primary);
}

.dw-model-suggestion {
  margin: -4px 0 0 118px;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.dw-model-suggestion > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dw-base-models {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dw-base-models :deep(.el-radio-button__inner) {
  width: 100%;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 7px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color) !important;
  border-radius: 6px !important;
  background: var(--el-fill-color-light);
  box-shadow: none !important;
  text-align: left;
}

.dw-base-models :deep(.el-radio-button.is-active .el-radio-button__inner) {
  border-color: var(--el-color-primary) !important;
  color: var(--el-text-color-primary);
  background: var(--el-color-primary-light-9);
}

.dw-base-models small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: normal;
}

.dw-advanced {
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.dw-advanced__head {
  width: 100%;
  min-height: 42px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: left;
}

.dw-advanced__head small {
  color: var(--el-text-color-secondary);
}

.dw-advanced__head svg {
  transition: transform 160ms ease;
}

.dw-advanced__head svg.is-open {
  transform: rotate(180deg);
}

.dw-advanced__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 4px 12px 12px;
}

.dw-advanced__body label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-advanced__body :deep(.el-input-number) {
  width: 100%;
}

.dw-advanced__body .el-button {
  justify-self: start;
  align-self: end;
}

.dw-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 680px) {
  .dw-form-line {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .dw-form-line > span {
    padding-top: 0;
  }

  .dw-model-suggestion {
    margin-left: 0;
  }
}
</style>
