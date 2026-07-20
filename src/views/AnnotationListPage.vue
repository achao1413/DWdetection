<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IconDatabaseImport, IconDots, IconInfoCircle, IconSearch } from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import DatasetDetailDialog from '@/components/DatasetDetailDialog.vue'
import DatasetUploadDialog from '@/components/DatasetUploadDialog.vue'
import TrainingDialog from '@/components/TrainingDialog.vue'
import { getAlgorithm, getAnalysisType, workflowState, type OverallQualityLevel } from '@/state/workflow'

const router = useRouter()
const keyword = ref('')
const trainingOpen = ref(false)
const uploadOpen = ref(false)
const detailOpen = ref(false)
const presetDatasetId = ref<string>()
const activeDatasetId = ref<string>()

const filteredDatasets = computed(() => {
  const value = keyword.value.trim()
  if (!value) return workflowState.datasets
  return workflowState.datasets.filter((item) => item.name.includes(value) || item.description.includes(value))
})

function openTraining(datasetId?: string) {
  presetDatasetId.value = datasetId
  trainingOpen.value = true
}

function importData() {
  uploadOpen.value = true
}

function openDetail(datasetId: string) {
  activeDatasetId.value = datasetId
  detailOpen.value = true
}

function handleMoreCommand(command: string, datasetId: string) {
  if (command === 'training') openTraining(datasetId)
}

function onUploaded(datasetId: string) {
  activeDatasetId.value = datasetId
  detailOpen.value = true
}

function qualityType(level: OverallQualityLevel) {
  if (level === 'excellent') return 'success'
  if (level === 'normal') return 'warning'
  if (level === 'poor') return 'danger'
  return 'info'
}

function qualityText(level: OverallQualityLevel) {
  if (level === 'excellent') return '优秀'
  if (level === 'normal') return '一般'
  if (level === 'poor') return '待优化'
  return '待评估'
}
</script>

<template>
  <DwAppShell>
    <div class="dw-list-page dw-ops-surface">
      <div class="dw-list-toolbar">
        <div>
          <h1>标注数据集</h1>
        </div>
        <div class="dw-list-actions">
          <el-input v-model="keyword" placeholder="搜索数据集" clearable>
            <template #prefix><IconSearch :size="16" /></template>
          </el-input>
          <el-button type="primary" @click="importData">
            <span class="dw-btn-inner"><IconDatabaseImport :size="18" />导入数据</span>
          </el-button>
        </div>
      </div>

      <div class="dw-data-table">
        <div class="dw-table-layout">
          <div class="dw-table-head">
            <span>数据名称</span><span>分析类型</span><span>上传时间</span><span>描述</span><span>已标注/总图片数</span>
            <span class="dw-quality-head">
              样本质量评估
              <el-popover trigger="hover" placement="bottom" :width="340" popper-class="dw-list-quality-standard">
                <template #reference>
                  <button type="button" aria-label="查看样本质量评估标准">
                    <IconInfoCircle :size="14" />
                  </button>
                </template>
                <div class="dw-quality-standard">
                  <strong>样本质量评估标准</strong>
                  <span>样本数量：优秀 &gt;100 张；一般 20-100 张；差 &lt;20 张</span>
                  <span>样本时间：三个时段均覆盖且占比均 &gt;20% 为优秀</span>
                  <span>样本重复：优秀 &lt;10%；一般 10%-20%；差 ≥20%</span>
                  <span>类别均衡：按各标签数量与占比综合评估</span>
                  <span>目标画幅：BBox &lt;5% 的占比为 0 时优秀</span>
                  <span>标注质量：按完整性和规范性的较低等级评定</span>
                </div>
              </el-popover>
            </span>
            <span>操作</span>
          </div>
          <div class="dw-table-body">
            <div v-for="dataset in filteredDatasets" :key="dataset.id" class="dw-table-row">
              <span class="dw-name">{{ dataset.name }}</span>
              <span>{{ getAnalysisType(dataset.analysisTypeId).name }}</span>
              <span>{{ dataset.uploadedAt }}</span>
              <span class="dw-desc">{{ dataset.description }}</span>
              <span class="dw-progress-cell">
                <el-progress
                  :percentage="Math.round((dataset.annotated / dataset.total) * 100)"
                  :stroke-width="6"
                  :show-text="false"
                />
                <strong>{{ dataset.annotated }}/{{ dataset.total }}</strong>
              </span>
              <button type="button" class="dw-quality-cell" @click="openDetail(dataset.id)">
                <el-tag size="small" :type="qualityType(dataset.qualityStatus.overallLevel)" effect="dark">
                  {{ qualityText(dataset.qualityStatus.overallLevel) }}
                </el-tag>
                <small>{{ dataset.qualityStatus.issueCount }}项待优化</small>
              </button>
              <span class="dw-row-actions">
                <el-button link type="primary" @click="openDetail(dataset.id)">详情</el-button>
                <el-button link type="primary" @click="router.push({ name: 'annotation-tool', params: { datasetId: dataset.id } })">标注</el-button>
                <el-dropdown trigger="click" @command="(command: string) => handleMoreCommand(command, dataset.id)">
                  <el-button link type="primary">
                    <span class="dw-btn-inner">更多<IconDots :size="15" /></span>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="training">训练</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="dw-list-footer">
        <span>共 {{ filteredDatasets.length }} 条，当前算法覆盖 {{ new Set(filteredDatasets.map((item) => getAlgorithm(item.algorithmId).id)).size }} 类</span>
        <el-pagination background small layout="prev, pager, next, jumper" :total="filteredDatasets.length" :page-size="10" />
      </div>
    </div>

    <TrainingDialog v-model="trainingOpen" :dataset-id="presetDatasetId" @created="router.push({ name: 'training-list' })" />
    <DatasetUploadDialog v-model="uploadOpen" @uploaded="onUploaded" />
    <DatasetDetailDialog
      v-model="detailOpen"
      :dataset-id="activeDatasetId"
      @train="openTraining"
    />
  </DwAppShell>
</template>

<style scoped>
.dw-list-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border-radius: 0;
  background: transparent;
}

.dw-list-toolbar,
.dw-list-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 28px;
}

.dw-list-actions {
  display: grid;
  grid-template-columns: 220px auto;
  gap: 8px;
}

.dw-data-table {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
  border: 0;
  border-radius: 0;
  overflow-x: auto;
  overflow-y: hidden;
  background: transparent;
  scrollbar-width: thin;
}

.dw-table-layout {
  --dw-table-columns: 1.4fr 0.75fr 1.1fr 1.35fr 1.1fr 1fr 1.25fr;
  width: 100%;
  min-width: 1080px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
}

.dw-table-head,
.dw-table-row {
  display: grid;
  grid-template-columns: var(--dw-table-columns);
  align-items: center;
  gap: 0;
  width: 100%;
  padding: 0;
  box-sizing: border-box;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.dw-table-head > *,
.dw-table-row > * {
  min-width: 0;
  padding-inline: 12px;
  box-sizing: border-box;
}

.dw-table-head {
  flex: 0 0 40px;
  height: 40px;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--dw-table-header-bg);
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.dw-table-body {
  flex: 0 0 auto;
  min-height: 0;
  overflow: visible;
}

.dw-table-row {
  min-height: 58px;
  border: 0;
}

.dw-table-row:nth-child(odd) {
  background: var(--el-fill-color-blank);
}

.dw-table-row:nth-child(even) {
  background: var(--el-fill-color-light);
}

.dw-name {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dw-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.dw-row-actions :deep(.el-button) {
  margin: 0;
  padding-inline: 0;
}

@media (max-width: 760px) {
  .dw-table-layout {
    --dw-table-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(0, 1.15fr) minmax(0, 1.3fr);
    min-width: 0;
  }

  .dw-table-head > :nth-child(2),
  .dw-table-head > :nth-child(3),
  .dw-table-head > :nth-child(4),
  .dw-table-row > :nth-child(2),
  .dw-table-row > :nth-child(3),
  .dw-table-row > :nth-child(4) {
    display: none;
  }

  .dw-table-head > *,
  .dw-table-row > * {
    padding-inline: 8px;
  }
}

.dw-quality-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.dw-quality-head button {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.dw-quality-head button:hover {
  color: var(--el-color-primary);
}

.dw-quality-standard {
  display: grid;
  gap: 7px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dw-quality-standard strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.dw-progress-cell {
  display: grid;
  grid-template-columns: minmax(64px, 96px) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dw-progress-cell strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.dw-quality-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
  padding-inline: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.dw-quality-cell:hover small {
  color: var(--el-color-primary);
}

.dw-quality-cell small {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.dw-list-footer {
  height: 52px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
