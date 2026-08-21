<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type UploadUserFile } from 'element-plus'
import { IconCircleCheck, IconFile, IconInfoCircle, IconUpload, IconX } from '@tabler/icons-vue'
import {
  getDataset,
  uploadDatasetImages,
  workflowState,
  type CaptureTimePeriod,
  type DatasetUploadResult,
} from '@/state/workflow'

const props = defineProps<{
  modelValue: boolean
  datasetId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  uploaded: [datasetId: string]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const fileList = ref<UploadUserFile[]>([])
const result = ref<DatasetUploadResult | null>(null)
const pendingUploadedDatasetId = ref<string>()
type AutoFixDetail = {
  type: 'damaged-images'
  title: string
  files: Array<{ before: string; after?: string }>
}
const autoFixDetails = ref<AutoFixDetail[]>([])
const autoResultOpen = ref(false)
const selectedImageCount = computed(() => expandUploadFiles().length)
const form = reactive({
  name: '',
  algorithmId: workflowState.algorithms[0]?.id ?? '',
  analysisTypeId: workflowState.algorithms[0]?.defaultAnalysisTypeId ?? workflowState.analysisTypes[0]?.id ?? '',
  description: '',
})

const editingDataset = computed(() => (props.datasetId ? getDataset(props.datasetId) : null))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    result.value = null
    fileList.value = []
    pendingUploadedDatasetId.value = undefined
    autoFixDetails.value = []
    autoResultOpen.value = false
    const dataset = editingDataset.value
    const defaultAlgorithm = workflowState.algorithms[0]
    form.name = dataset?.name ?? ''
    form.algorithmId = dataset?.algorithmId ?? defaultAlgorithm?.id ?? ''
    form.analysisTypeId = dataset?.analysisTypeId ?? defaultAlgorithm?.defaultAnalysisTypeId ?? workflowState.analysisTypes[0]?.id ?? ''
    form.description = dataset?.description ?? ''
  },
  { immediate: true },
)

function fillMockFiles() {
  const prefix = props.datasetId ? editingDataset.value?.id ?? 'dataset' : 'new_dataset'
  const names = [
    `${prefix}_001.jpg`,
    `${prefix}_002.low.jpg`,
    `${prefix}_003.jpg`,
    `${prefix}_003.jpg`,
    `${prefix}_broken_004.jpg`,
    `${prefix}_005.4k.jpg`,
    `${prefix}_corrupt_006.png`,
    `${prefix}_damaged_007.jpg`,
    `${prefix}_0kb_008.jpg`,
    `${prefix}_bad-format_009.png`,
    `${prefix}_broken_010.jpg`,
    `${prefix}_corrupt_011.jpg`,
    `${prefix}_damaged_012.png`,
  ]
  fileList.value = names.map((name, index) => ({ name, uid: Date.now() + index }) as UploadUserFile)
  resetPreparation()
}

function resetPreparation() {
  autoFixDetails.value = []
  result.value = null
}

function removeFile(uid: string | number | undefined) {
  fileList.value = fileList.value.filter((file) => file.uid !== uid)
  resetPreparation()
}

function expandUploadFiles() {
  const periods: CaptureTimePeriod[] = ['morning', 'noon', 'afternoon']
  return fileList.value.map((file, fileIndex) => ({
    fileName: file.name,
    captureTimePeriod: periods[fileIndex % periods.length],
  }))
}

function downloadExampleFile() {
  const link = document.createElement('a')
  link.href = workflowState.algorithms[0]?.image ?? ''
  link.download = 'DWdetection-导入示例.jpg'
  link.click()
}

function finishUploadFlow() {
  const datasetId = pendingUploadedDatasetId.value
  pendingUploadedDatasetId.value = undefined
  visible.value = false
  if (datasetId) emit('uploaded', datasetId)
}

function cleanDamagedFiles(files: Array<{ fileName: string }>) {
  const fileNames = files.map((file) => file.fileName)
  const damagedFiles = fileNames.filter((name) => /broken|corrupt|damaged|0kb|bad-format/i.test(name))
  if (!damagedFiles.length) return

  autoFixDetails.value = [
    {
      type: 'damaged-images',
      title: '已清理异常图片',
      files: damagedFiles.map((name) => ({ before: name, after: '已移除' })),
    },
  ]
  fileList.value = fileList.value.filter((file) => !damagedFiles.includes(file.name))
}

async function prepareUpload() {
  const files = expandUploadFiles()
  if (!files.length) {
    ElMessage.warning('请先选择图片')
    return
  }

  autoFixDetails.value = []
  cleanDamagedFiles(files)
  commitUpload()
}

function commitUpload() {
  const files = expandUploadFiles()
  result.value = uploadDatasetImages({
    datasetId: props.datasetId,
    name: form.name,
    algorithmId: form.algorithmId,
    analysisTypeId: form.analysisTypeId,
    description: form.description,
    files,
    duplicatePolicy: 'keep',
  })
  ElMessage.success('上传完成，已生成样本质量报告')
  pendingUploadedDatasetId.value = result.value.dataset.id
  if (autoFixDetails.value.length) {
    autoResultOpen.value = true
    return
  }
  finishUploadFlow()
}

async function submit() {
  await prepareUpload()
}
</script>

<template>
  <el-dialog v-model="visible" width="var(--dw-dialog-size-small)" align-center append-to-body class="dataset-upload-dialog">
    <template #header>
      <div class="dataset-upload__title">
        <span>导入数据</span>
        <el-tooltip content="参考最新版本数据要求说明" placement="right" popper-class="dw-ops-tooltip">
          <button type="button" class="dataset-upload__requirements" aria-label="查看数据要求说明">
            <IconInfoCircle :size="17" />
          </button>
        </el-tooltip>
      </div>
    </template>

    <div class="dataset-upload">
      <div v-if="!datasetId" class="dataset-upload__form">
        <label>
          <span>数据集名称</span>
          <el-input v-model="form.name" placeholder="请输入数据集名称" />
        </label>
        <label>
          <span>数据集描述</span>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="100"
            show-word-limit
            placeholder="请输入数据来源、采集场景或使用说明"
          />
        </label>
      </div>

      <div class="dataset-upload__scroll">
        <el-upload
          v-model:file-list="fileList"
          drag
          multiple
          :auto-upload="false"
          :show-file-list="false"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          @change="resetPreparation"
        >
          <div class="dataset-upload__drop">
            <IconUpload :size="28" />
            <strong>拖拽或选择图片</strong>
            <span>上传时会自动识别并清理无法解析的异常图片。</span>
          </div>
        </el-upload>
        <el-button class="dataset-upload__example" link type="primary" @click="downloadExampleFile">
          示例文件下载
        </el-button>

        <div v-if="fileList.length" class="dataset-upload__file-summary">
          <strong>图片列表</strong>
          <span>共 {{ selectedImageCount }} 张</span>
        </div>
        <ul v-if="fileList.length" class="dataset-upload__file-list">
          <li v-for="file in fileList" :key="file.uid">
            <IconFile :size="16" />
            <span>{{ file.name }}</span>
            <button type="button" title="移除文件" @click="removeFile(file.uid)">
              <IconX :size="14" />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="dataset-upload__actions">
        <el-button @click="fillMockFiles">生成异常模拟样本</el-button>
        <el-button type="primary" @click="submit">导入数据</el-button>
      </div>
    </template>

    <el-dialog
      v-model="autoResultOpen"
      width="var(--dw-dialog-size-small)"
      align-center
      append-to-body
      class="dataset-auto-result-dialog"
      @closed="finishUploadFlow"
    >
      <template #header>
        <div class="dataset-upload__title">
          <IconCircleCheck :size="20" class="dataset-auto-result__success" />
          <span>自动处理完成</span>
        </div>
      </template>

      <div class="dataset-auto-result">
        <p>上传已完成，系统已自动处理以下异常文件。</p>
        <section v-for="detail in autoFixDetails" :key="detail.type" class="dataset-auto-result__group">
          <header>
            <strong>{{ detail.title }}</strong>
            <span>{{ detail.files.length }} 项</span>
          </header>
          <ul>
            <li v-for="file in detail.files" :key="`${detail.type}-${file.before}`">
              <IconFile :size="16" />
              <span>{{ file.before }}</span>
              <small v-if="file.after">{{ file.after }}</small>
            </li>
          </ul>
        </section>
      </div>

      <template #footer>
        <div class="dataset-upload__actions">
          <el-button type="primary" @click="autoResultOpen = false">查看样本质量</el-button>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
.dataset-upload__title,
.dataset-upload__actions,
.dataset-upload__result-head,
.dataset-upload__stats,
.dataset-upload__duplicate-title,
.dataset-upload__auto-results strong {
  display: flex;
  align-items: center;
}

.dataset-upload__title {
  gap: 8px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dataset-upload__requirements {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.dataset-upload__requirements:hover {
  color: var(--el-color-primary);
}

.dataset-upload {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.dataset-upload__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.dataset-upload__form label {
  display: grid;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dataset-upload__drop {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 72px;
  color: var(--el-text-color-secondary);
}

.dataset-upload__drop strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.dataset-upload__drop span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.dataset-upload__example {
  align-self: flex-start;
  height: 28px;
  margin-top: 4px;
  padding-inline: 0;
}

.dataset-upload__actions {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
}

.dataset-upload__result {
  margin-top: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  padding: 12px;
}

.dataset-upload__auto-results {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--el-color-success) 38%, var(--el-border-color));
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-color-success) 10%, var(--el-fill-color-light));
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.dataset-upload__auto-results strong {
  gap: 6px;
  color: var(--el-color-success);
  font-size: 12px;
}

.dataset-upload__auto-results small {
  color: var(--el-text-color-secondary);
}

.dataset-upload__duplicate-alert {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 8px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 42%, var(--el-border-color));
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--el-fill-color-light));
  color: var(--el-color-warning);
  font-size: 11px;
}

.dataset-upload__file-list {
  display: grid;
  flex: 1 1 96px;
  gap: 2px;
  min-height: 64px;
  max-height: 140px;
  margin: 6px 0 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  list-style: none;
}

.dataset-upload__file-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dataset-upload__file-summary strong {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dataset-upload__file-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--el-text-color-regular);
}

.dataset-upload__file-list li.is-duplicate {
  background: color-mix(in srgb, var(--el-color-warning) 9%, transparent);
}

.dataset-upload__file-list li.is-excluded {
  opacity: 0.68;
}

.dataset-upload__file-list li > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.dataset-upload__file-list button {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.dataset-upload__result-head,
.dataset-upload__stats {
  justify-content: space-between;
  gap: 10px;
}

.dataset-upload__result-head {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dataset-upload__stats {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dataset-upload__duplicate-title {
  gap: 6px;
}

.dataset-upload__duplicates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

:global(.dataset-upload-dialog.el-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.dataset-upload-dialog .el-dialog__body) {
  overflow: hidden !important;
}

.dataset-upload :deep(.el-upload-dragger) {
  padding: 10px 12px;
}

.dataset-upload__scroll {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 4px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.dataset-auto-result {
  display: grid;
  gap: 10px;
  min-height: 0;
  max-height: min(420px, calc(100vh - 220px));
  padding-right: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  color: var(--el-text-color-secondary);
}

.dataset-auto-result > p {
  margin: 0;
  font-size: 12px;
}

.dataset-auto-result__success {
  color: var(--el-color-success);
}

.dataset-auto-result__group {
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.dataset-auto-result__group header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.dataset-auto-result__group header span {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.dataset-auto-result__group ul {
  max-height: 224px;
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0 10px 8px;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: thin;
}

.dataset-auto-result__group li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.dataset-auto-result__group li > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-auto-result__group li small {
  color: var(--el-color-success);
  white-space: nowrap;
}
</style>
