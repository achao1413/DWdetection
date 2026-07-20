<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconArrowUpRight,
  IconBook,
  IconChartRadar,
  IconDeviceFloppy,
  IconPhotoPlus,
  IconPoint,
  IconPointer,
  IconSchool,
  IconSquare,
} from '@tabler/icons-vue'
import AnnotationGuideFloating from '@/components/AnnotationGuideFloating.vue'
import DatasetQualityPanel from '@/components/DatasetQualityPanel.vue'
import DatasetUploadDialog from '@/components/DatasetUploadDialog.vue'
import DwAppShell from '@/components/DwAppShell.vue'
import TrainingDialog from '@/components/TrainingDialog.vue'
import {
  getAlgorithm,
  getAnalysisType,
  getDataset,
  getDatasetImages,
  refreshDatasetQuality,
  saveAnnotation,
  workflowState,
} from '@/state/workflow'
import { getGuideKeyByAnalysisType } from '@/state/annotationGuides'

const route = useRoute()
const router = useRouter()
const datasetId = computed(() => String(route.params.datasetId ?? workflowState.datasets[0].id))
const dataset = computed(() => getDataset(datasetId.value))
const selectedAnalysisTypeId = ref(dataset.value.analysisTypeId)
const analysisType = computed(() => getAnalysisType(selectedAnalysisTypeId.value))
const images = computed(() => getDatasetImages(datasetId.value))
const currentImageId = ref(images.value[0]?.id ?? '')
const selectedTool = ref<'select' | 'rect' | 'arrow' | 'point'>('rect')
const selectedLabel = ref('')
const trainingOpen = ref(false)
const uploadOpen = ref(false)
const guideOpen = ref(false)
const guideAutoOpened = ref(false)
const guideHintVisible = ref(false)
let guideHintTimer: number | undefined

const currentImage = computed(() => images.value.find((item) => item.id === currentImageId.value) ?? images.value[0])
const progress = computed(() => Math.round((dataset.value.annotated / dataset.value.total) * 100))
const currentGuideKey = computed(() => getGuideKeyByAnalysisType(selectedAnalysisTypeId.value))

const tools = [
  { key: 'select', label: '选择', icon: IconPointer },
  { key: 'rect', label: '矩形', icon: IconSquare },
  { key: 'arrow', label: '箭头', icon: IconArrowUpRight },
  { key: 'point', label: '点位', icon: IconPoint },
] as const

function chooseLabel(label: string) {
  selectedLabel.value = label
}

function openGuide() {
  if (!selectedAnalysisTypeId.value) {
    ElMessage.warning('请先选择分析类型')
    return
  }
  guideHintVisible.value = false
  guideAutoOpened.value = false
  guideOpen.value = true
}

function guideSeenKey(analysisTypeId: string) {
  return `dw-annotation-guide-seen:${analysisTypeId}`
}

function guideHintKey(analysisTypeId: string) {
  return `dw-annotation-guide-hint:${analysisTypeId}`
}

function addMark(event: MouseEvent) {
  if (!currentImage.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 100)
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 100)
  const label = selectedLabel.value || analysisType.value.labels[0]
  if (selectedTool.value === 'point') {
    currentImage.value.points.push({ id: `pt-${Date.now()}`, label, x, y })
  } else if (selectedTool.value !== 'select') {
    currentImage.value.boxes.push({
      id: `box-${Date.now()}`,
      label,
      x: Math.max(4, x - 12),
      y: Math.max(4, y - 10),
      w: 24,
      h: 20,
    })
  }
}

function undo() {
  if (!currentImage.value) return
  if (currentImage.value.points.length) {
    currentImage.value.points.pop()
  } else {
    currentImage.value.boxes.pop()
  }
}

function save() {
  saveAnnotation(datasetId.value, currentImage.value.id)
  ElMessage.success('标注已保存')
}

watch(
  datasetId,
  (id) => {
    const nextDataset = getDataset(id)
    selectedAnalysisTypeId.value = nextDataset.analysisTypeId
    currentImageId.value = getDatasetImages(id)[0]?.id ?? ''
  },
)

watch(
  selectedAnalysisTypeId,
  (id) => {
    if (!id) return
    const nextAnalysisType = getAnalysisType(id)
    if (dataset.value.analysisTypeId !== id) {
      dataset.value.analysisTypeId = id
      refreshDatasetQuality(dataset.value.id)
    }
    selectedLabel.value = nextAnalysisType.labels[0] ?? ''
    if (!window.sessionStorage.getItem(guideSeenKey(id))) {
      window.sessionStorage.setItem(guideSeenKey(id), '1')
      guideAutoOpened.value = true
      guideOpen.value = true
    }
  },
  { immediate: true },
)

watch(guideOpen, (open, wasOpen) => {
  if (open || !wasOpen || !guideAutoOpened.value || !selectedAnalysisTypeId.value) return
  const key = guideHintKey(selectedAnalysisTypeId.value)
  guideAutoOpened.value = false
  if (window.sessionStorage.getItem(key)) return
  window.sessionStorage.setItem(key, '1')
  guideHintVisible.value = true
  window.clearTimeout(guideHintTimer)
  guideHintTimer = window.setTimeout(() => {
    guideHintVisible.value = false
  }, 6000)
})

onBeforeUnmount(() => window.clearTimeout(guideHintTimer))
</script>

<template>
  <DwAppShell>
    <div class="dw-annot-tool">
      <div class="dw-tool-top dw-ops-surface">
        <div class="dw-tool-left">
          <button type="button" class="dw-back-btn" @click="router.push({ name: 'annotation-list' })">
            <IconArrowLeft :size="18" />
            <span>标注工具</span>
          </button>
          <el-button @click="uploadOpen = true">
            <span class="dw-btn-inner"><IconPhotoPlus :size="18" />添加图片</span>
          </el-button>
        </div>

        <div class="dw-tool-title">
          <strong>{{ dataset.name }}</strong>
          <span class="dw-analysis-line">
            分析类型：
            <el-select v-model="selectedAnalysisTypeId" size="small" class="dw-analysis-select">
              <el-option
                v-for="type in workflowState.analysisTypes"
                :key="type.id"
                :label="type.name"
                :value="type.id"
              />
            </el-select>
          </span>
        </div>

        <div class="dw-tool-actions">
          <span class="dw-annotation-summary">
            <span>已标注/总图片数</span>
            <el-progress :percentage="progress" :stroke-width="6" :show-text="false" />
            <strong>{{ dataset.annotated }}/{{ dataset.total }}</strong>
          </span>
          <el-popover
            trigger="click"
            placement="bottom-end"
            width="780"
            popper-class="dw-quality-popover"
          >
            <DatasetQualityPanel :dataset="dataset" contained>
              <template #radar-footer>
                <section class="dw-quality-popover__meta">
                  <div>
                    <span>上传时间</span>
                    <strong>{{ dataset.uploadedAt }}</strong>
                  </div>
                  <div>
                    <span>算法分析类型</span>
                    <strong>{{ getAlgorithm(dataset.algorithmId).name }} / {{ analysisType.name }}</strong>
                  </div>
                  <div>
                    <span>数据描述</span>
                    <strong>{{ dataset.description }}</strong>
                  </div>
                </section>
              </template>
            </DatasetQualityPanel>
            <template #reference>
              <el-button class="dw-ops-secondary" @click="guideOpen = false">
                <span class="dw-btn-inner"><IconChartRadar :size="17" />样本质量</span>
              </el-button>
            </template>
          </el-popover>
          <el-button @click="save">
            <span class="dw-btn-inner"><IconDeviceFloppy :size="18" />保存</span>
          </el-button>
          <el-button type="primary" @click="trainingOpen = true">
            <span class="dw-btn-inner"><IconSchool :size="18" />训练</span>
          </el-button>
        </div>
      </div>

      <div class="dw-tool-body">
        <aside class="dw-toolbox dw-ops-surface">
          <button
            v-for="tool in tools"
            :key="tool.key"
            type="button"
            :title="tool.label"
            :class="{ 'is-active': selectedTool === tool.key }"
            @click="selectedTool = tool.key"
          >
            <component :is="tool.icon" :size="20" />
          </button>
          <button type="button" title="撤销" @click="undo">
            <IconArrowBackUp :size="20" />
          </button>
          <el-popover
            :visible="guideHintVisible"
            placement="right"
            width="220"
            content="可随时从这里重新打开标注教程示例"
            popper-class="dw-guide-entry-popover"
          >
            <template #reference>
              <button type="button" class="dw-toolbox__guide" title="教程示例" @click="openGuide">
                <IconBook :size="20" />
              </button>
            </template>
          </el-popover>
        </aside>

        <section class="dw-canvas-wrap dw-ops-surface">
          <div class="dw-canvas" @click="addMark">
            <img :src="currentImage.image" :alt="currentImage.name" />
            <div
              v-for="box in currentImage.boxes"
              :key="box.id"
              class="dw-mark-box"
              :style="{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }"
            >
              <span>{{ box.label }}</span>
            </div>
            <div
              v-for="point in currentImage.points"
              :key="point.id"
              class="dw-mark-point"
              :style="{ left: `${point.x}%`, top: `${point.y}%` }"
            >
              <span>{{ point.label }}</span>
            </div>
          </div>
        </section>

        <aside class="dw-label-panel dw-ops-surface">
          <div class="dw-label-head">
            <h2>标签配置</h2>
            <span>{{ analysisType.labels.length }} 项</span>
          </div>
          <button
            v-for="label in analysisType.labels"
            :key="label"
            type="button"
            class="dw-label-item"
            :class="{ 'is-active': selectedLabel === label }"
            @click="chooseLabel(label)"
          >
            <span>{{ label }}</span>
            <small>{{ currentImage.boxes.filter((box) => box.label === label).length + currentImage.points.filter((point) => point.label === label).length }}</small>
          </button>
        </aside>
      </div>

      <div class="dw-thumb-strip dw-ops-surface">
        <button
          v-for="image in images"
          :key="image.id"
          type="button"
          class="dw-thumb-item"
          :class="{ 'is-active': currentImage.id === image.id }"
          @click="currentImageId = image.id"
        >
          <img :src="image.image" :alt="image.name" />
          <el-tag class="dw-thumb-state" size="small" :type="image.annotated ? 'info' : 'warning'" effect="dark">
            {{ image.annotated ? '已标注' : '待标注' }}
          </el-tag>
          <span>{{ image.name }}</span>
        </button>
      </div>
    </div>

    <TrainingDialog v-model="trainingOpen" :dataset-id="datasetId" @created="router.push({ name: 'training-list' })" />
    <DatasetUploadDialog v-model="uploadOpen" :dataset-id="datasetId" />
    <AnnotationGuideFloating
      v-model="guideOpen"
      :guide-key="currentGuideKey"
    />
  </DwAppShell>
</template>

<style scoped>
.dw-annot-tool {
  --dw-annotation-chrome-bg: rgba(71, 71, 71, 0.5);
  height: calc(100% + 72px);
  min-height: 0;
  margin: -30px -30px -42px;
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr) 108px;
  gap: 0;
  overflow: hidden;
}

.dw-tool-top {
  padding: 0 14px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto minmax(360px, 1fr);
  align-items: center;
  gap: 12px;
  overflow: hidden;
  border-bottom: 1px solid var(--el-border-color);
  border-radius: 0;
  background: var(--dw-annotation-chrome-bg);
}

.dw-tool-left,
.dw-tool-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dw-tool-actions {
  justify-content: flex-end;
}

.dw-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}

.dw-tool-title {
  min-width: 260px;
  max-width: 520px;
  display: grid;
  gap: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.dw-tool-title strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-tool-title span {
  display: block;
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-analysis-line {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.dw-analysis-select {
  width: 126px;
}

.dw-analysis-select :deep(.el-select__wrapper) {
  min-height: 24px;
  background: transparent;
}

.dw-annotation-summary {
  display: grid;
  grid-template-columns: 72px 40px;
  align-items: center;
  gap: 4px 8px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.dw-annotation-summary > span:first-child {
  grid-column: 1 / -1;
}

.dw-annotation-summary :deep(.el-progress) {
  width: 72px;
}

.dw-annotation-summary strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.dw-quality-summary {
  width: 248px;
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 20px 18px;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
  padding: 2px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.dw-quality-summary:hover {
  background: var(--el-fill-color-light);
}

.dw-quality-summary__label {
  justify-self: start;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.dw-annotation-progress {
  grid-column: 1 / 2;
  display: grid;
  grid-template-columns: 76px auto;
  align-items: center;
  gap: 8px;
}

.dw-quality-summary :deep(.el-tag) {
  justify-self: end;
  align-self: center;
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  height: 32px;
  padding: 0 12px;
  line-height: 30px;
  font-size: 12px;
}

.dw-annotation-progress strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.dw-annotation-progress :deep(.el-progress) {
  width: 76px;
}

.dw-quality-summary :deep(.el-progress-bar__outer) {
  background-color: color-mix(in srgb, var(--el-text-color-primary) 24%, transparent);
}

.dw-tool-left :deep(.el-button),
.dw-tool-actions :deep(.el-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: 2px;
}

.dw-tool-left :deep(.el-button + .el-button),
.dw-tool-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.dw-tool-body {
  min-height: 0;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 260px;
  gap: 0;
  overflow: hidden;
}

.dw-toolbox,
.dw-label-panel,
.dw-canvas-wrap,
.dw-thumb-strip {
  overflow: hidden;
}

.dw-toolbox {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
  border-radius: 0;
  background: var(--dw-annotation-chrome-bg);
}

.dw-toolbox button {
  width: 44px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: pointer;
}

.dw-toolbox button.is-active {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.dw-toolbox .dw-toolbox__guide {
  margin-top: auto;
  box-shadow: 0 -1px 0 var(--el-border-color);
}

.dw-canvas-wrap {
  padding: 0;
  display: grid;
  place-items: stretch start;
  border-radius: 0;
  background: transparent;
}

.dw-canvas {
  position: relative;
  width: auto;
  height: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  background: transparent;
  overflow: hidden;
  cursor: crosshair;
}

.dw-canvas img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dw-mark-box {
  position: absolute;
  border: 2px solid var(--el-color-primary);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}

.dw-mark-box span,
.dw-mark-point span {
  position: absolute;
  left: -2px;
  top: -22px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.dw-mark-point {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: var(--el-color-warning);
  border: 2px solid var(--el-text-color-primary);
}

.dw-label-panel {
  padding: 14px 8px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 0;
  background: var(--dw-annotation-chrome-bg);
}

.dw-label-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.dw-label-head h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.dw-label-head span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-label-item {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
  border-radius: 2px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.dw-label-item.is-active {
  background: var(--el-fill-color-light);
}

.dw-label-item small {
  color: var(--el-text-color-secondary);
}

.dw-thumb-strip {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 6px 44px;
  overflow-x: auto;
  scrollbar-width: thin;
  border-radius: 0;
  background: var(--el-fill-color-blank);
}

.dw-thumb-item {
  position: relative;
  width: 132px;
  height: 96px;
  flex: 0 0 auto;
  padding: 0;
  border: 5px solid var(--el-border-color);
  border-radius: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  overflow: hidden;
}

.dw-thumb-item.is-active {
  border-color: var(--el-color-primary);
}

.dw-thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dw-thumb-state {
  position: absolute;
  left: 4px;
  top: 4px;
  pointer-events: none;
}

.dw-thumb-item span {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -24px;
  display: none;
  padding: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-quality-popover__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.dw-quality-popover__meta div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px;
}

.dw-quality-popover__meta div:first-child {
  border-right: 1px solid var(--el-border-color);
}

.dw-quality-popover__meta div:last-child {
  grid-column: 1 / -1;
}

.dw-quality-popover__meta span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-quality-popover__meta strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 18px;
}

:global(.dw-quality-popover.el-popper) {
  max-width: calc(100vw - 24px);
  height: min(480px, calc(100vh - 32px));
  max-height: 480px;
  box-sizing: border-box;
  overflow: hidden;
}

:global(.dw-quality-popover .quality-panel.is-contained) {
  height: 100%;
  max-height: 100%;
}
</style>
