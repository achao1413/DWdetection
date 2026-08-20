<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconBox,
  IconDots,
  IconDownload,
  IconEdit,
  IconEye,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import ModelVersionDetailDialog from '@/components/ModelVersionDetailDialog.vue'
import ModelValidationDialog from '@/components/ModelValidationDialog.vue'
import TrainingDialog from '@/components/TrainingDialog.vue'
import {
  canPublishModelVersion,
  canValidateModelVersion,
  deleteModel,
  getModel,
  getModelVersion,
  getModelVersions,
  hasActiveModelTraining,
  publishModelVersion,
  trainingSchedulerConfig,
  updateModelProfile,
  workflowState,
  type ModelItem,
  type ModelTrainingStatus,
  type ModelVersion,
} from '@/state/workflow'
import { downloadModelVersionMock } from '@/utils/modelVersionDownload'

type TrainingTab = 'models' | 'tasks'

const activeTab = ref<TrainingTab>('models')
const showTrainingTaskTab = false
const router = useRouter()
const route = useRoute()
const keyword = ref('')
const taskStatus = ref<ModelTrainingStatus | ''>('')
const trainingOpen = ref(false)
const trainingModelId = ref<string>()
const validationOpen = ref(false)
const validationVersion = ref<ModelVersion>()
const detailOpen = ref(false)
const detailVersion = ref<ModelVersion>()
const expandedModelId = ref<string>()
const guidedVersionId = ref<string>()
const modelPage = ref(1)
const modelPageSize = 10
const editModelOpen = ref(false)
const editingModelId = ref('')
const editModelForm = reactive({ name: '', description: '' })
const validationModel = computed(() => validationVersion.value ? getModel(validationVersion.value.modelId) : undefined)
const detailModel = computed(() => detailVersion.value ? getModel(detailVersion.value.modelId) : undefined)
const trainingBlocked = computed(() => hasActiveModelTraining())

const filteredModels = computed(() => workflowState.models.filter((model) => {
  return !keyword.value || model.name.toLowerCase().includes(keyword.value.trim().toLowerCase())
}))

const pagedModels = computed(() => {
  const start = (modelPage.value - 1) * modelPageSize
  return filteredModels.value.slice(start, start + modelPageSize)
})

const taskRows = computed(() => workflowState.modelVersions
  .filter((version) => ['queued', 'training', 'failed'].includes(version.trainingStatus))
  .filter((version) => {
    const model = workflowState.models.find((item) => item.id === version.modelId)
    const matchesKeyword = !keyword.value
      || model?.name.toLowerCase().includes(keyword.value.toLowerCase())
      || `V${version.versionNumber}`.toLowerCase().includes(keyword.value.toLowerCase())
    const matchesStatus = !taskStatus.value || version.trainingStatus === taskStatus.value
    return matchesKeyword && matchesStatus
  })
  .sort((left, right) => {
    const rank: Record<ModelTrainingStatus, number> = { training: 0, queued: 1, failed: 2, completed: 3 }
    return rank[left.trainingStatus] - rank[right.trainingStatus]
  }))

watch(keyword, () => {
  modelPage.value = 1
})

watch(
  pagedModels,
  (models) => {
    if (!models.length) {
      expandedModelId.value = undefined
      return
    }
    if (!models.some((model) => model.id === expandedModelId.value)) {
      expandedModelId.value = models[0].id
    }
  },
  { immediate: true },
)

watch(
  () => route.query.guideVersionId,
  (versionId) => {
    const normalizedId = Array.isArray(versionId) ? versionId[0] : versionId
    if (normalizedId) handleCreated(normalizedId)
  },
  { immediate: true, flush: 'post' },
)

function toggleModel(modelId: string) {
  expandedModelId.value = expandedModelId.value === modelId ? undefined : modelId
}

function handleVersionWheel(event: WheelEvent) {
  const versionList = event.currentTarget as HTMLElement
  const outerList = versionList.closest<HTMLElement>('.table-scroll')
  if (!outerList || event.deltaY === 0) return

  const atTop = versionList.scrollTop <= 0
  const atBottom = Math.ceil(versionList.scrollTop + versionList.clientHeight) >= versionList.scrollHeight
  const reachedBoundary = event.deltaY < 0 ? atTop : atBottom
  if (!reachedBoundary) return

  event.preventDefault()
  outerList.scrollTop += event.deltaY
}

function scrollWithinContainer(element: HTMLElement, container: HTMLElement, align: 'start' | 'center') {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const alignmentOffset = align === 'center'
    ? (container.clientHeight - elementRect.height) / 2
    : 0
  const targetTop = container.scrollTop + elementRect.top - containerRect.top - alignmentOffset
  container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
}

function modelName(modelId: string) {
  return workflowState.models.find((item) => item.id === modelId)?.name ?? '--'
}

function versionName(versionId?: string) {
  const version = versionId ? getModelVersion(versionId) : undefined
  return version ? `V${version.versionNumber}` : '--'
}

function trainingStatusLabel(version?: ModelVersion) {
  if (!version) return '暂无训练'
  if (version.trainingStatus === 'failed') return '训练失败'
  if (version.trainingStatus === 'completed') return '训练完成'
  return '训练中'
}

function trainingStatusType(version?: ModelVersion) {
  if (version?.trainingStatus === 'failed') return 'danger'
  if (version?.trainingStatus === 'completed') return 'success'
  if (version?.trainingStatus === 'training' || version?.trainingStatus === 'queued') return 'warning'
  return 'info'
}

function isMeterVersion(version: ModelVersion) {
  return version.datasetLabelType === 'pointerMeter' || version.datasetLabelType === 'digitalMeter'
}

function validationDisabled(version: ModelVersion) {
  return !isMeterVersion(version) || !canValidateModelVersion(version)
}

function validationTooltip(version: ModelVersion) {
  if (!isMeterVersion(version)) return '非表计类模型验证功能即将上线'
  return '模型发布后才可进行效果验证'
}

function openDataset(version: ModelVersion) {
  const datasetExists = workflowState.datasets.some((dataset) => dataset.id === version.datasetId)
  if (!datasetExists) {
    ElMessage.warning('数据集已删除，无法跳转')
    return
  }
  router.push({ name: 'annotation-list', query: { datasetId: version.datasetId } })
}

async function handleVersionAction(action: string, version: ModelVersion) {
  const model = getModel(version.modelId)
  if (!model) return

  if (action === 'detail') {
    detailVersion.value = version
    detailOpen.value = true
    return
  }

  if (action === 'publish') {
    if (!canPublishModelVersion(version)) return
    const active = model.currentVersionId ? getModelVersion(model.currentVersionId) : undefined
    const message = active
      ? `发布V${version.versionNumber}后，当前生效的V${active.versionNumber}将变为历史版本。是否继续？`
      : `确定发布V${version.versionNumber}并设为当前生效版本吗？`
    try {
      await ElMessageBox.confirm(message, '发布模型版本', {
        confirmButtonText: '继续发布', cancelButtonText: '取消', type: 'warning', customClass: 'dw-ops-message-box',
      })
      await publishModelVersion(version.id)
      ElMessage.success(`V${version.versionNumber} 已发布并设为当前生效版本`)
    } catch (error) {
      if (error instanceof Error) ElMessage.error(error.message)
    }
    return
  }

  if (action === 'validate') {
    if (!isMeterVersion(version) || !canValidateModelVersion(version)) return
    if (version.datasetLabelType === 'pointerMeter') {
      router.push({
        name: 'meter-configuration-home',
        query: {
          modelId: model.id,
          modelName: model.name,
          versionId: version.id,
          versionName: `V${version.versionNumber}`,
          source: 'model-validation',
        },
      })
      return
    }
    validationVersion.value = version
    validationOpen.value = true
    return
  }

  if (action === 'download') {
    downloadModelVersionMock(model, version)
    ElMessage.success(`已生成 ${model.name} V${version.versionNumber} 下载文件`)
  }
}

function openTraining(modelId?: string) {
  if (trainingBlocked.value) {
    ElMessage.warning('当前已有模型正在训练，完成后才能发起新训练')
    return
  }
  trainingModelId.value = modelId
  trainingOpen.value = true
}

function openEditModel(model: ModelItem) {
  editingModelId.value = model.id
  editModelForm.name = model.name
  editModelForm.description = model.description ?? ''
  editModelOpen.value = true
}

function saveModelProfile() {
  try {
    updateModelProfile(editingModelId.value, editModelForm)
    editModelOpen.value = false
    ElMessage.success('模型信息已更新')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '模型信息更新失败')
  }
}

async function removeModel(model: ModelItem) {
  try {
    await ElMessageBox.confirm(
      `删除“${model.name}”后，其全部模型版本将一并删除，且无法恢复。是否继续？`,
      '删除模型',
      {
        confirmButtonText: '删除模型',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dw-ops-message-box',
      },
    )
    deleteModel(model.id)
    const maxPage = Math.max(1, Math.ceil(filteredModels.value.length / modelPageSize))
    modelPage.value = Math.min(modelPage.value, maxPage)
    ElMessage.success('模型已删除')
  } catch (error) {
    if (error instanceof Error) ElMessage.warning(error.message)
  }
}

function handleModelAction(command: string, model: ModelItem) {
  if (command === 'edit') openEditModel(model)
  if (command === 'delete') removeModel(model)
}

async function handleCreated(versionId: string) {
  activeTab.value = 'models'
  const version = getModelVersion(versionId)
  if (!version) return
  keyword.value = ''
  const modelIndex = workflowState.models.findIndex((model) => model.id === version.modelId)
  modelPage.value = Math.floor(Math.max(modelIndex, 0) / modelPageSize) + 1
  expandedModelId.value = version.modelId
  await nextTick()
  await new Promise((resolve) => window.setTimeout(resolve, 320))
  guidedVersionId.value = version.id
  await nextTick()
  const versionRow = document.querySelector<HTMLElement>(`[data-version-id="${version.id}"]`)
  const versionList = versionRow?.closest<HTMLElement>('.version-list')
  const modelBlock = versionRow?.closest<HTMLElement>('.model-block')
  const modelRow = modelBlock?.querySelector<HTMLElement>(':scope > .model-row')
  const outerList = versionRow?.closest<HTMLElement>('.table-scroll')

  if (versionRow && versionList) scrollWithinContainer(versionRow, versionList, 'center')
  if (modelRow && outerList) scrollWithinContainer(modelRow, outerList, 'start')
  window.setTimeout(() => {
    if (guidedVersionId.value === version.id) guidedVersionId.value = undefined
  }, 3000)
}
</script>

<template>
  <DwAppShell>
    <div class="training-page">
      <header class="training-toolbar">
        <div class="training-title">
          <h1>模型训练</h1>
          <el-tabs v-if="showTrainingTaskTab" v-model="activeTab" class="training-tabs">
            <el-tab-pane label="模型管理" name="models" />
            <el-tab-pane label="训练任务" name="tasks" />
          </el-tabs>
        </div>
        <div class="training-actions">
          <el-input v-model="keyword" clearable placeholder="搜索模型名称">
            <template #prefix><IconSearch :size="16" /></template>
          </el-input>
          <el-select v-if="showTrainingTaskTab && activeTab === 'tasks'" v-model="taskStatus" clearable placeholder="任务状态">
            <el-option label="排队中" value="queued" />
            <el-option label="训练中" value="training" />
            <el-option label="训练失败" value="failed" />
          </el-select>
          <el-tooltip :disabled="!trainingBlocked" content="当前已有模型正在训练，完成后才能发起新训练" placement="bottom">
            <span>
              <el-button type="primary" :disabled="trainingBlocked" @click="openTraining()">
                <span class="dw-btn-inner"><IconPlus :size="18" />新建训练</span>
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </header>

      <section v-if="activeTab === 'models'" class="model-table" aria-label="模型管理">
        <div class="table-scroll">
          <template v-for="model in pagedModels" :key="model.id">
            <article class="model-block" :class="{ 'is-expanded': expandedModelId === model.id }">
              <div class="model-row" @click="toggleModel(model.id)">
                <button class="model-row__toggle" type="button" :aria-label="expandedModelId === model.id ? '收起版本' : '展开版本'">
                  <component :is="expandedModelId === model.id ? IconChevronDown : IconChevronRight" :size="18" />
                </button>
                <div class="model-row__identity">
                  <span class="model-row__icon"><IconBox :size="19" /></span>
                  <strong>{{ model.name }}</strong>
                </div>
                <p class="model-row__description" :title="model.description">{{ model.description || '暂无模型描述' }}</p>
                <div class="model-row__created">
                  <span>创建时间</span>
                  <strong>{{ model.createdAt }}</strong>
                </div>
                <div class="model-row__actions" @click.stop>
                  <el-tooltip :disabled="!trainingBlocked" content="当前已有模型正在训练" placement="top">
                    <span>
                      <el-button link type="primary" :disabled="trainingBlocked" @click="openTraining(model.id)">
                        <IconPlus :size="16" />训练新版本
                      </el-button>
                    </span>
                  </el-tooltip>
                  <el-dropdown trigger="click" @command="(command: string) => handleModelAction(command, model)">
                    <el-button link type="primary">更多<IconDots :size="16" /></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="edit"><IconEdit :size="15" />编辑模型</el-dropdown-item>
                        <el-dropdown-item command="delete" divided><IconTrash :size="15" />删除模型</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>

              <div v-if="expandedModelId === model.id" class="version-group">
                <div class="version-table__head">
                  <span>版本</span><span>训练数据集</span><span>训练状态</span><span>训练时间</span><span>操作</span>
                </div>
                <div class="version-list" aria-label="模型版本列表" @wheel="handleVersionWheel">
                  <div
                    v-for="version in getModelVersions(model.id)"
                    :key="version.id"
                    class="version-row"
                    :class="{ 'is-guided': guidedVersionId === version.id }"
                    :data-version-id="version.id"
                  >
                    <span class="version-row__version">V{{ version.versionNumber }}</span>
                    <span class="truncate">
                      <button type="button" class="version-dataset-link" @click.stop="openDataset(version)">
                        {{ version.datasetName }}
                      </button>
                    </span>
                    <span>
                      <el-tag size="small" :type="trainingStatusType(version)">{{ trainingStatusLabel(version) }}</el-tag>
                      <el-progress
                        v-if="version.trainingStatus === 'training'"
                        :percentage="version.progress ?? 0"
                        :show-text="false"
                        :stroke-width="4"
                      />
                      <small v-if="version.trainingStatus === 'queued'">队列第 {{ version.queuePosition }} 位</small>
                    </span>
                    <span>{{ version.createdAt }}</span>
                    <span class="version-actions">
                      <el-button
                        v-if="version.releaseRole !== 'current'"
                        link
                        type="primary"
                        :loading="version.publishStatus === 'publishing'"
                        :disabled="!canPublishModelVersion(version)"
                        @click.stop="handleVersionAction('publish', version)"
                      >
                        发布
                      </el-button>
                      <span v-else class="version-published"><IconCircleCheck :size="14" />已发布</span>
                      <el-tooltip
                        :disabled="!validationDisabled(version)"
                        :content="validationTooltip(version)"
                        placement="top"
                      >
                        <span>
                          <el-button
                            link
                            type="primary"
                            :disabled="validationDisabled(version)"
                            @click.stop="handleVersionAction('validate', version)"
                          >
                            验证
                          </el-button>
                        </span>
                      </el-tooltip>
                      <el-dropdown trigger="click" @command="(command: string) => handleVersionAction(command, version)">
                        <el-button link type="primary" @click.stop>
                          更多<IconDots :size="15" />
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="download"><IconDownload :size="15" />下载</el-dropdown-item>
                            <el-dropdown-item command="detail"><IconEye :size="15" />查看详情</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </template>
          <div v-if="!filteredModels.length" class="table-empty">未找到匹配模型</div>
        </div>
      </section>

      <section v-else class="task-table" aria-label="训练任务">
        <div class="task-summary">
          <span>调度并行数 {{ trainingSchedulerConfig.concurrencyLimit }}</span>
          <span>{{ taskRows.filter((item) => item.trainingStatus === 'training').length }} 个训练中</span>
          <span>{{ taskRows.filter((item) => item.trainingStatus === 'queued').length }} 个排队中</span>
        </div>
        <div class="table-scroll">
          <div class="task-table__head">
            <span>模型版本</span><span>任务状态</span><span>训练数据集</span><span>训练进度</span><span>创建时间</span><span>操作</span>
          </div>
          <div v-for="version in taskRows" :key="version.id" class="task-row">
            <span><strong>{{ modelName(version.modelId) }}</strong><small>V{{ version.versionNumber }}</small></span>
            <span><el-tag size="small" :type="trainingStatusType(version)">{{ trainingStatusLabel(version) }}</el-tag></span>
            <span class="truncate">{{ version.datasetName }}</span>
            <span>
              <el-progress
                v-if="version.trainingStatus === 'training'"
                :percentage="version.progress ?? 0"
                :stroke-width="6"
              />
              <small v-else-if="version.trainingStatus === 'queued'">队列第 {{ version.queuePosition }} 位</small>
              <small v-else>训练未完成</small>
            </span>
            <span>{{ version.createdAt }}</span>
            <span><el-button link type="primary" @click="handleVersionAction('detail', version)">查看任务</el-button></span>
          </div>
          <div v-if="!taskRows.length" class="table-empty">当前没有进行中或失败的训练任务</div>
        </div>
      </section>

      <footer class="training-footer">
        <span v-if="activeTab === 'models'">共 {{ filteredModels.length }} 个模型</span>
        <span v-else>共 {{ taskRows.length }} 个任务</span>
        <el-pagination
          v-if="activeTab === 'models'"
          v-model:current-page="modelPage"
          background
          small
          layout="prev, pager, next"
          :total="filteredModels.length"
          :page-size="modelPageSize"
        />
      </footer>
    </div>

    <TrainingDialog v-model="trainingOpen" :model-id="trainingModelId" @created="handleCreated" />
    <ModelValidationDialog
      v-model="validationOpen"
      :model="validationModel"
      :version="validationVersion"
    />
    <ModelVersionDetailDialog
      v-model="detailOpen"
      :model="detailModel"
      :version="detailVersion"
      @open-dataset="openDataset"
    />

    <el-dialog
      v-model="editModelOpen"
      width="var(--dw-dialog-size-small)"
      align-center
      append-to-body
      title="编辑模型"
      class="edit-model-dialog"
    >
      <div class="edit-model-form">
        <label>
          <span>模型名称</span>
          <el-input v-model="editModelForm.name" maxlength="32" show-word-limit />
        </label>
        <label>
          <span>详细描述</span>
          <el-input
            v-model="editModelForm.description"
            type="textarea"
            :rows="4"
            maxlength="160"
            show-word-limit
            placeholder="请输入模型用途、识别对象或适用场景"
          />
        </label>
      </div>
      <template #footer>
        <div class="edit-model-actions">
          <el-button @click="editModelOpen = false">取消</el-button>
          <el-button type="primary" :disabled="!editModelForm.name.trim()" @click="saveModelProfile">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </DwAppShell>
</template>

<style scoped>
.training-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.training-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}

.training-title {
  display: flex;
  align-items: center;
  gap: 28px;
}

.training-title h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 28px;
  letter-spacing: 0;
}

.training-tabs {
  width: 220px;
}

.training-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.training-tabs :deep(.el-tabs__content) {
  display: none;
}

.training-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.training-actions > .el-input {
  width: 220px;
}

.model-table,
.task-table {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.task-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-scroll {
  height: 100%;
  overflow: auto;
  scrollbar-width: thin;
}

.model-row {
  min-width: 980px;
  display: grid;
  grid-template-columns: 28px minmax(180px, 1.2fr) minmax(210px, 1.6fr) 168px 220px;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
}

.version-table__head,
.task-table__head {
  min-height: 48px;
  background: var(--el-fill-color-darker);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}

.model-row {
  min-height: 72px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.model-block:nth-child(even) > .model-row {
  background: color-mix(in srgb, var(--el-bg-color-overlay) 45%, var(--el-bg-color));
}

.model-row:hover {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
}

.model-block.is-expanded > .model-row {
  background: var(--el-bg-color);
  box-shadow: inset 0 -1px var(--el-border-color);
}

.model-row__toggle {
  width: 28px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.model-row__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-primary);
}

.model-row__identity strong,
.model-row__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-row__identity strong {
  font-size: 14px;
  font-weight: 600;
}

.model-row__icon {
  width: 30px;
  height: 30px;
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.model-row__description {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.model-row__created {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.model-row__created strong {
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
}

.model-row__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.model-row__actions .el-button + .el-button {
  margin-left: 0;
}

.version-group {
  min-width: 980px;
  padding: 0 18px 14px 56px;
  background: var(--el-bg-color-overlay);
}

.version-list {
  max-height: 264px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.version-table__head,
.version-row {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1.35fr) 180px 168px 280px;
  align-items: center;
  gap: 14px;
  padding: 0 14px;
}

.version-table__head {
  min-height: 38px;
  background: var(--dw-table-header-bg);
}

.version-row {
  min-height: 66px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  transition: background-color 180ms ease, box-shadow 180ms ease;
}

.version-row:nth-child(even) {
  background: var(--el-fill-color-light);
}

.version-row.is-guided {
  background: color-mix(in srgb, var(--el-color-primary) 18%, var(--el-bg-color-overlay));
  box-shadow: inset 3px 0 var(--el-color-primary);
}

.version-row__version {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.version-row > span,
.task-row > span {
  min-width: 0;
}

.version-row small,
.task-row small {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.version-row :deep(.el-progress) {
  width: 92px;
  margin-top: 6px;
}

.version-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.version-published {
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  color: var(--el-color-success);
  font-size: 14px;
  font-weight: 500;
}

.version-dataset-link {
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.version-dataset-link:hover {
  text-decoration: underline;
}

.version-actions .el-button + .el-button {
  margin-left: 0;
}

.version-actions .el-button,
.version-actions :deep(.el-dropdown) {
  flex: 0 0 auto;
}

.task-summary {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.task-table .table-scroll {
  min-height: 0;
}

.task-table__head,
.task-row {
  min-width: 960px;
  display: grid;
  grid-template-columns: minmax(180px, 1.25fr) 120px minmax(170px, 1.2fr) minmax(150px, 1fr) 168px 90px;
  align-items: center;
  gap: 18px;
  padding: 0 18px;
}

.task-row {
  min-height: 70px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.task-row:nth-child(odd) {
  background: var(--el-fill-color);
}

.task-row strong {
  color: var(--el-text-color-primary);
}

.task-row :deep(.el-progress) {
  max-width: 180px;
}

.training-footer {
  flex: 0 0 auto;
  min-height: 48px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.edit-model-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit-model-form label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.edit-model-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.edit-model-actions .el-button + .el-button {
  margin-left: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-empty {
  min-width: 960px;
  padding: 48px 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

@media (max-width: 760px) {
  .training-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .training-title {
    justify-content: space-between;
  }

  .training-actions {
    width: 100%;
  }

  .training-actions > .el-input {
    width: 100%;
  }
}
</style>
