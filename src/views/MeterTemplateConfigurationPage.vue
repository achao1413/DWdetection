<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconPhotoPlus,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import MeterTemplateCanvasMock from '@/components/meter-template/MeterTemplateCanvasMock.vue'
import MeterTemplateConfigPanel from '@/components/meter-template/MeterTemplateConfigPanel.vue'
import MeterConfigReferencePanel from '@/components/meter-template/MeterConfigReferencePanel.vue'
import MeterTemplateTaskBar from '@/components/meter-template/MeterTemplateTaskBar.vue'
import {
  meterTaskSteps,
  type GuideLineDensity,
  type MeterStepPhase,
  type MeterTemplateStepId,
  type NormalizedPoint,
  type NormalizedRect,
} from '@/state/meterTemplateConfiguration'

const route = useRoute()
const router = useRouter()

const currentStepIndex = ref(0)
const dialRect = ref<NormalizedRect | null>(null)
const centerPoint = ref<NormalizedPoint | null>(null)
const rangePresetApplied = ref(false)
const templateName = ref('')
const analysisType = ref('')
const dialAttempted = ref(false)
const guideLineDensity = ref<GuideLineDensity>('high')
const guideLineCount = ref(36)
const referenceVisible = ref(true)
const referenceHintVisible = ref(false)
const referenceHintStorageKey = 'dw-meter-reference-reopen-hint-shown'
const referenceHintShown = ref(sessionStorage.getItem(referenceHintStorageKey) === 'true')
const unsavedDialogVisible = ref(false)
const savedDialogVisible = ref(false)
const savedDialogMode = ref<'manual' | 'automatic'>('manual')
const templateSaved = ref(false)
const referenceSeenSteps = new Set<MeterTemplateStepId>(['dial'])
let referenceHintTimer: number | undefined

const currentTask = computed(() => meterTaskSteps[currentStepIndex.value])
const currentStep = computed(() => currentTask.value.id)

const dialValid = computed(() => Boolean(
  dialRect.value
  && dialRect.value.width >= 0.12
  && dialRect.value.height >= 0.12,
))

const canSubmit = computed(() => (
  currentStep.value === 'details'
  && templateName.value.trim().length > 0
  && analysisType.value.length > 0
))

const currentPhase = computed<MeterStepPhase>(() => {
  if (currentStep.value === 'dial') return dialValid.value ? 'ready' : 'active'
  if (currentStep.value === 'center') return centerPoint.value ? 'ready' : 'active'
  if (currentStep.value === 'range') return rangePresetApplied.value ? 'ready' : 'active'
  return canSubmit.value ? 'ready' : 'active'
})

const rangeVisible = computed(() => rangePresetApplied.value || currentStep.value === 'details')
const allOperationsComplete = computed(() => canSubmit.value)

watch(currentStep, (step) => {
  referenceHintVisible.value = false
  if (step === 'details') {
    referenceVisible.value = false
    return
  }

  if (!referenceSeenSteps.has(step)) {
    referenceSeenSteps.add(step)
    referenceVisible.value = true
  }
})

function showReference() {
  referenceHintVisible.value = false
  referenceVisible.value = true
}

function closeReference() {
  referenceVisible.value = false
  if (referenceHintShown.value) return
  referenceHintShown.value = true
  sessionStorage.setItem(referenceHintStorageKey, 'true')
  window.clearTimeout(referenceHintTimer)
  referenceHintTimer = window.setTimeout(() => {
    referenceHintVisible.value = true
    referenceHintTimer = window.setTimeout(() => {
      referenceHintVisible.value = false
    }, 6000)
  }, 120)
}

onBeforeUnmount(() => window.clearTimeout(referenceHintTimer))

function goBack() {
  router.push({
    name: 'meter-template-validation',
    query: route.query.algorithmId ? { algorithmId: String(route.query.algorithmId) } : undefined,
  })
}

function requestBack() {
  if (templateSaved.value) {
    goBack()
    return
  }

  if (allOperationsComplete.value) {
    templateSaved.value = true
    savedDialogMode.value = 'automatic'
    savedDialogVisible.value = true
    return
  }
  unsavedDialogVisible.value = true
}

function abandonConfiguration() {
  unsavedDialogVisible.value = false
  goBack()
}

function handleUploadTemplate() {
  savedDialogVisible.value = false
  ElMessage.success('模板已上传')
  goBack()
}

function handleUploadLater() {
  savedDialogVisible.value = false
  goBack()
}

function confirmCurrentStep() {
  if (currentPhase.value !== 'ready' || currentStepIndex.value >= meterTaskSteps.length - 1) return

  if (currentStep.value === 'center') {
    rangePresetApplied.value = true
  }
  currentStepIndex.value += 1
}

function resetCurrentStep() {
  if (currentStep.value === 'dial') {
    dialRect.value = null
    centerPoint.value = null
    rangePresetApplied.value = false
    dialAttempted.value = false
    return
  }
  if (currentStep.value === 'center') {
    centerPoint.value = null
    rangePresetApplied.value = false
  }
}

function previousStep() {
  if (currentStepIndex.value === 0) return

  if (currentStep.value === 'center') {
    centerPoint.value = null
    rangePresetApplied.value = false
  } else if (currentStep.value === 'range') {
    rangePresetApplied.value = false
  } else if (currentStep.value === 'details') {
    templateName.value = ''
    analysisType.value = ''
  }

  currentStepIndex.value -= 1
}

function handleDialFinished(valid: boolean) {
  dialAttempted.value = true
  if (!valid) ElMessage.warning('框选范围过小，请覆盖完整表盘后重试')
}

function handleInvalidCenter() {
  ElMessage.warning('请在已确认的表盘区域内选择指针轴心')
}

function confirmConfiguration() {
  if (!canSubmit.value) return
  templateSaved.value = true
  savedDialogMode.value = 'manual'
  savedDialogVisible.value = true
}

function handleGuideLineCount(value: number) {
  guideLineCount.value = value
  if (value <= 16) guideLineDensity.value = 'low'
  else if (value <= 30) guideLineDensity.value = 'medium'
  else guideLineDensity.value = 'high'
}
</script>

<template>
  <DwAppShell full-bleed>
    <div class="meter-template-page">
      <header class="meter-template-page__bar">
        <div class="meter-template-page__bar-left">
          <button type="button" class="meter-template-page__back" @click="requestBack">
            <IconArrowLeft :size="18" stroke="1.8" />
            <span>指针模板</span>
          </button>
          <el-button class="dw-ops-secondary">
            <span class="dw-btn-inner"><IconPhotoPlus :size="17" />更换模板图</span>
          </el-button>
        </div>
        <div class="meter-template-page__bar-actions">
          <el-button class="dw-ops-secondary" @click="requestBack">取消</el-button>
          <el-button type="primary" :disabled="!canSubmit" @click="confirmConfiguration">
            <span class="dw-btn-inner"><IconCheck :size="17" />保存</span>
          </el-button>
        </div>
      </header>

      <div class="meter-template-page__body">
        <div class="meter-template-page__main">
          <MeterTemplateTaskBar
            :steps="meterTaskSteps"
            :current-step-index="currentStepIndex"
          />
          <MeterTemplateCanvasMock
            :current-step="currentStep"
            :dial-rect="dialRect"
            :center-point="centerPoint"
            :range-visible="rangeVisible"
            :guide-line-density="guideLineDensity"
            :guide-line-count="guideLineCount"
            @update:dial-rect="dialRect = $event"
            @update:center-point="centerPoint = $event"
            @dial-finished="handleDialFinished"
            @invalid-center="handleInvalidCenter"
            @reset-step="resetCurrentStep"
          >
            <template #reference>
              <MeterConfigReferencePanel
                v-if="referenceVisible && currentStep !== 'details'"
                :current-step="currentStep"
                @close="closeReference"
              />
            </template>
          </MeterTemplateCanvasMock>
        </div>
        <MeterTemplateConfigPanel
          :current-step="currentStep"
          :current-step-index="currentStepIndex"
          :phase="currentPhase"
          :task-description="currentTask.description"
          :confirm-label="currentTask.confirmLabel"
          :guide-line-density="guideLineDensity"
          :guide-line-count="guideLineCount"
          :reference-hint-visible="referenceHintVisible"
          :dial-rect="dialRect"
          :center-point="centerPoint"
          :template-name="templateName"
          :analysis-type="analysisType"
          @show-reference="showReference"
          @previous-step="previousStep"
          @confirm-step="confirmCurrentStep"
          @update:guide-line-density="guideLineDensity = $event"
          @update:guide-line-count="handleGuideLineCount"
          @update:template-name="templateName = $event"
          @update:analysis-type="analysisType = $event"
        />
      </div>

      <el-dialog
        v-model="unsavedDialogVisible"
        width="400px"
        align-center
        append-to-body
        class="meter-unsaved-dialog"
        :close-on-click-modal="false"
      >
        <template #header>
          <div class="meter-unsaved-dialog__title">
            <IconAlertTriangle :size="20" stroke="1.8" />
            <span>模板未保存</span>
          </div>
        </template>
        <div class="meter-unsaved-dialog__content">
          <p>当前配置尚未完成。继续创建可保留当前进度；不再创建将放弃当前内容并返回。</p>
        </div>
        <template #footer>
          <el-button class="dw-ops-secondary" @click="abandonConfiguration">不创建了</el-button>
          <el-button type="primary" @click="unsavedDialogVisible = false">继续创建</el-button>
        </template>
      </el-dialog>

      <el-dialog
        v-model="savedDialogVisible"
        width="400px"
        align-center
        append-to-body
        class="meter-saved-dialog"
        :close-on-click-modal="false"
        :show-close="false"
      >
        <template #header>
          <div class="meter-saved-dialog__title">
            <IconCircleCheck :size="20" stroke="1.8" />
            <span>{{ savedDialogMode === 'automatic' ? '模板已自动保存' : '模板保存成功' }}</span>
          </div>
        </template>
        <div class="meter-saved-dialog__content">
          <strong>配置内容已保存</strong>
          <p>是否立即上传模板？上传后可在推理时选择该模板。</p>
        </div>
        <template #footer>
          <el-button class="dw-ops-secondary" @click="handleUploadLater">稍后上传</el-button>
          <el-button type="primary" @click="handleUploadTemplate">立即上传</el-button>
        </template>
      </el-dialog>
    </div>
  </DwAppShell>
</template>

<style scoped>
.meter-template-page {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.meter-template-page__bar {
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 16px;
  box-sizing: border-box;
  background: var(--el-fill-color-blank);
  border-bottom: 1px solid var(--el-border-color);
}

.meter-template-page__bar-left,
.meter-template-page__bar-actions,
.meter-template-page__back {
  display: flex;
  align-items: center;
}

.meter-template-page__bar-left,
.meter-template-page__bar-actions {
  gap: 8px;
}

.meter-template-page__back {
  min-height: 36px;
  gap: 8px;
  padding: 0 10px 0 4px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.meter-template-page__back:hover {
  color: var(--el-color-primary);
}

.meter-template-page__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 336px;
  gap: 0;
  overflow: hidden;
}

.meter-template-page__main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.meter-template-page :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 1100px) {
  .meter-template-page__body {
    grid-template-columns: minmax(0, 1fr) 308px;
  }

  .meter-template-page__bar {
    padding: 0 12px;
  }

}

:global(.meter-unsaved-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 12px 12px;
}

:global(.meter-unsaved-dialog .el-dialog__header) {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  box-sizing: border-box;
}

.meter-unsaved-dialog__title,
.meter-saved-dialog__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.meter-unsaved-dialog__title svg {
  flex: 0 0 auto;
  color: var(--el-color-warning);
}

.meter-saved-dialog__title svg {
  flex: 0 0 auto;
  color: var(--el-color-success);
}

:global(.meter-unsaved-dialog .el-dialog__body) {
  padding: 2px 12px 10px;
}

:global(.meter-saved-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.meter-unsaved-dialog__content {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 22px;
}

.meter-unsaved-dialog__content p {
  margin: 0;
}

.meter-saved-dialog__content {
  color: var(--el-text-color-regular);
}

.meter-saved-dialog__content strong {
  color: var(--el-text-color-primary);
}

.meter-saved-dialog__content p {
  margin: 5px 0 0;
  line-height: 1.6;
}
</style>
