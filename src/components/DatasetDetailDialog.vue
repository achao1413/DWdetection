<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconCircleCheck, IconLoader2, IconPhotoPlus, IconSchool, IconSparkles, IconTag } from '@tabler/icons-vue'
import DatasetQualityPanel from '@/components/DatasetQualityPanel.vue'
import DatasetUploadDialog from '@/components/DatasetUploadDialog.vue'
import { deduplicateDatasetImages, getAlgorithm, getAnalysisType, getDataset } from '@/state/workflow'

const props = defineProps<{
  modelValue: boolean
  datasetId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  train: [datasetId: string]
}>()

const router = useRouter()
const uploadOpen = ref(false)
const dedupOpen = ref(false)
const dedupStage = ref<'confirm' | 'processing' | 'done'>('confirm')
const dedupRemoved = ref(0)
const dedupRemovedFiles = ref<string[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dataset = computed(() => (props.datasetId ? getDataset(props.datasetId) : null))
const analysisType = computed(() => (dataset.value ? getAnalysisType(dataset.value.analysisTypeId) : null))
const qualityExcellent = computed(() => dataset.value?.qualityStatus.overallLevel === 'excellent')
const dedupCandidates = computed(() => {
  if (!dataset.value) return []
  const duplicateStats = dataset.value.duplicateStats
  const knownFiles = [
    ...duplicateStats.duplicateFiles,
    ...duplicateStats.duplicateSamples.map((sample) => sample.fileName),
  ].filter((fileName, index, files) => fileName && files.indexOf(fileName) === index)

  return Array.from({ length: duplicateStats.duplicateCount }, (_, index) => (
    knownFiles[index]
      ?? `${dataset.value?.name ?? 'dataset'}_高相似冗余_${String(index + 1).padStart(2, '0')}.jpg`
  ))
})

const dedupPreviewCandidates = computed(() => {
  if (!dedupCandidates.value.length || !dataset.value) return []
  const mockFiles = [
    `${dataset.value.name}_重复样本_02.jpg`,
    `${dataset.value.name}_重复样本_03.jpg`,
    `${dataset.value.name}_高相似冗余_04.png`,
    `${dataset.value.name}_高相似冗余_05.jpg`,
    `${dataset.value.name}_连续帧_06.jpg`,
    `${dataset.value.name}_连续帧_07.jpg`,
    `${dataset.value.name}_同名副本_08.png`,
  ]
  return [...new Set([...dedupCandidates.value, ...mockFiles])].slice(0, 8)
})

function goAnnotation() {
  if (!dataset.value) return
  visible.value = false
  router.push({ name: 'annotation-tool', params: { datasetId: dataset.value.id } })
}

function train() {
  if (!dataset.value) return
  emit('train', dataset.value.id)
}

function handleQualityAction(action: 'add-images' | 'annotate' | 'deduplicate') {
  if (!dataset.value) return
  if (action === 'add-images') {
    uploadOpen.value = true
    return
  }
  if (action === 'annotate') {
    goAnnotation()
    return
  }
  dedupStage.value = 'confirm'
  dedupRemoved.value = 0
  dedupRemovedFiles.value = []
  dedupOpen.value = true
}

function startDeduplication() {
  if (!dataset.value) return
  const filesToRemove = [...dedupPreviewCandidates.value]
  dedupStage.value = 'processing'
  window.setTimeout(() => {
    if (!dataset.value) return
    dedupRemovedFiles.value = filesToRemove
    dedupRemoved.value = filesToRemove.length
    deduplicateDatasetImages(dataset.value.id)
    dedupStage.value = 'done'
  }, 1800)
}

function finishDeduplication() {
  dedupOpen.value = false
  ElMessage.success('样本质量已重新评估')
}
</script>

<template>
  <el-dialog v-model="visible" width="var(--dw-dialog-size-large)" align-center append-to-body class="dataset-detail-dialog">
    <template #header>
      <div v-if="dataset" class="dataset-detail__title">
        <strong>{{ dataset.name }}</strong>
      </div>
    </template>

    <div v-if="dataset" class="dataset-detail">
      <DatasetQualityPanel :dataset="dataset" contained @action="handleQualityAction">
        <template #radar-footer>
          <section class="dataset-detail__meta">
            <div>
              <span>上传时间</span>
              <strong>{{ dataset.uploadedAt }}</strong>
            </div>
            <div>
              <span>算法分析类型</span>
              <strong>{{ getAlgorithm(dataset.algorithmId).name }} / {{ analysisType?.name }}</strong>
            </div>
            <div>
              <span>数据描述</span>
              <strong>{{ dataset.description }}</strong>
            </div>
          </section>
        </template>
      </DatasetQualityPanel>
    </div>

    <template #footer>
      <div class="dataset-detail__footer">
        <el-button @click="uploadOpen = true">
          <span class="dw-btn-inner"><IconPhotoPlus :size="18" />添加图片</span>
        </el-button>
        <template v-if="qualityExcellent">
          <el-button @click="goAnnotation">
            <span class="dw-btn-inner"><IconTag :size="18" />进入标注</span>
          </el-button>
          <el-button type="primary" @click="train">
            <span class="dw-btn-inner"><IconSchool :size="18" />训练</span>
          </el-button>
        </template>
        <template v-else>
          <el-button @click="train">
            <span class="dw-btn-inner"><IconSchool :size="18" />训练</span>
          </el-button>
          <el-button type="primary" @click="goAnnotation">
            <span class="dw-btn-inner"><IconTag :size="18" />进入标注</span>
          </el-button>
        </template>
      </div>
    </template>

    <DatasetUploadDialog
      v-if="dataset"
      v-model="uploadOpen"
      :dataset-id="dataset.id"
    />

    <el-dialog
      v-model="dedupOpen"
      width="var(--dw-dialog-size-small)"
      align-center
      append-to-body
      class="dataset-dedup-dialog"
      :close-on-click-modal="dedupStage !== 'processing'"
      :show-close="dedupStage !== 'processing'"
    >
      <template #header>
        <div class="dataset-dedup__title">
          <IconSparkles :size="19" />
          <strong>{{ dedupStage === 'done' ? '图片去重完成' : '确认图片去重' }}</strong>
        </div>
      </template>

      <div class="dataset-dedup__body">
        <template v-if="dedupStage === 'confirm'">
          <p>系统将移除同名或高相似冗余图片，并立即重新计算样本质量。</p>
          <span>预计处理 {{ dedupPreviewCandidates.length }} 张重复图片，是否继续？</span>
          <section v-if="dedupPreviewCandidates.length" class="dataset-dedup__files">
            <header>待去重图片</header>
            <ul>
              <li v-for="fileName in dedupPreviewCandidates" :key="fileName">
                <span>{{ fileName }}</span>
              </li>
            </ul>
          </section>
        </template>
        <template v-else-if="dedupStage === 'processing'">
          <IconLoader2 class="is-spinning" :size="34" />
          <strong>正在扫描并移除重复图片</strong>
          <span>正在更新样本索引和质量评估，请稍候。</span>
        </template>
        <template v-else>
          <IconCircleCheck class="is-success" :size="36" />
          <strong>已完成图片去重</strong>
          <span>共移除 {{ dedupRemoved }} 张重复图片，样本质量结果已更新。</span>
          <section v-if="dedupRemovedFiles.length" class="dataset-dedup__files is-result">
            <header>已去重图片</header>
            <ul>
              <li v-for="fileName in dedupRemovedFiles" :key="fileName">
                <span>{{ fileName }}</span>
                <small>已移除</small>
              </li>
            </ul>
          </section>
        </template>
      </div>

      <template #footer>
        <div class="dataset-dedup__actions">
          <template v-if="dedupStage === 'confirm'">
            <el-button @click="dedupOpen = false">取消</el-button>
            <el-button type="primary" @click="startDeduplication">确认去重</el-button>
          </template>
          <el-button v-else-if="dedupStage === 'done'" type="primary" @click="finishDeduplication">完成</el-button>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
.dataset-detail__title,
.dataset-detail__footer,
.dataset-detail__meta {
  display: flex;
  align-items: center;
}

.dataset-detail__title {
  justify-content: space-between;
  gap: 16px;
}

.dataset-detail__title strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.dataset-detail__meta span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dataset-detail {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.dataset-detail__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 6px;
}

.dataset-detail__meta div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px;
}

.dataset-detail__meta div:first-child {
  border-right: 1px solid var(--el-border-color);
}

.dataset-detail__meta div:last-child {
  grid-column: 1 / -1;
}

.dataset-detail__meta strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.dataset-detail__footer {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
}

.dataset-dedup__title,
.dataset-dedup__actions {
  display: flex;
  align-items: center;
}

.dataset-dedup__title {
  gap: 8px;
  color: var(--el-text-color-primary);
}

.dataset-dedup__body {
  min-height: 116px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0;
  text-align: center;
}

.dataset-dedup__body p,
.dataset-dedup__body span {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 20px;
}

.dataset-dedup__body strong {
  color: var(--el-text-color-primary);
}

.dataset-dedup__files {
  width: 100%;
  overflow: hidden;
  text-align: left;
}

.dataset-dedup__files header {
  padding: 7px 0;
  border-bottom: 1px solid var(--el-border-color);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.dataset-dedup__files ul {
  display: grid;
  max-height: 168px;
  gap: 2px;
  margin: 0;
  padding: 6px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  list-style: none;
}

.dataset-dedup__files li {
  display: flex;
  min-height: 26px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.dataset-dedup__files li > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-dedup__files li small {
  flex: 0 0 auto;
  color: var(--el-color-success);
}

.dataset-dedup__body .is-success {
  color: var(--el-color-success);
}

.dataset-dedup__body .is-spinning {
  color: var(--el-color-primary);
  animation: dataset-dedup-spin 900ms linear infinite;
}

.dataset-dedup__actions {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
}

@keyframes dataset-dedup-spin {
  to { transform: rotate(360deg); }
}

:global(.dataset-detail-dialog .el-dialog__body) {
  overflow: hidden !important;
}

:global(.dataset-detail-dialog.el-dialog) {
  height: min(var(--dw-dialog-max-height, 600px), calc(100vh - 32px));
}

</style>
