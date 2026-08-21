<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  IconArrowLeft,
  IconDownload,
  IconRocket,
  IconShieldCheck,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import ModelValidationDialog from '@/components/ModelValidationDialog.vue'
import {
  canPublishModelVersion,
  canValidateModelVersion,
  getModel,
  getModelVersion,
  publishModelVersion,
  type ModelVersion,
} from '@/state/workflow'
import { downloadModelVersionMock } from '@/utils/modelVersionDownload'

const route = useRoute()
const router = useRouter()
const validationOpen = ref(false)

const model = computed(() => getModel(String(route.params.modelId)))
const version = computed(() => getModelVersion(String(route.params.versionId)))
const validVersion = computed(() => version.value?.modelId === model.value?.id ? version.value : undefined)

function statusKey(item?: ModelVersion) {
  if (!item) return 'empty'
  if (item.publishStatus === 'publishing') return 'publishing'
  if (item.publishStatus === 'failed') return 'publishFailed'
  if (item.trainingStatus === 'queued') return 'queued'
  if (item.trainingStatus === 'training') return 'training'
  if (item.trainingStatus === 'failed') return 'failed'
  if (item.releaseRole === 'current') return 'current'
  if (item.releaseRole === 'historical') return 'historical'
  return 'unreleased'
}

function statusLabel(item?: ModelVersion) {
  return {
    empty: '暂无版本', queued: '排队中', training: '训练中', failed: '训练失败',
    unreleased: '训练完成（待发布）', publishing: '发布中', publishFailed: '发布失败',
    current: '已发布 / 当前生效', historical: '历史版本',
  }[statusKey(item)]
}

function statusType(item?: ModelVersion) {
  const key = statusKey(item)
  if (key === 'current') return 'success'
  if (key === 'failed' || key === 'publishFailed') return 'danger'
  if (key === 'queued' || key === 'training' || key === 'publishing') return 'warning'
  if (key === 'unreleased') return 'primary'
  return 'info'
}

function baseModelLabel(item: ModelVersion) {
  return item.baseModel === 'power' ? '电力基础模型' : '通用模型'
}

function trainingMethodLabel(item: ModelVersion) {
  return item.trainingMethod === 'fineTune' ? '微调训练' : '从零训练'
}

function durationText(item: ModelVersion) {
  if (!item.trainingStartedAt || !item.trainingFinishedAt) return '--'
  const start = new Date(item.trainingStartedAt.replace(' ', 'T')).getTime()
  const end = new Date(item.trainingFinishedAt.replace(' ', 'T')).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '--'
  const totalMinutes = Math.round((end - start) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`
}

async function handlePublish(item: ModelVersion) {
  if (!canPublishModelVersion(item) || !model.value) return
  const active = model.value.currentVersionId ? getModelVersion(model.value.currentVersionId) : undefined
  const message = active
    ? `发布V${item.versionNumber}后，当前生效的V${active.versionNumber}将变为未发布状态，是否继续？`
    : `确定发布V${item.versionNumber}并设为当前生效版本吗？`
  try {
    await ElMessageBox.confirm(message, '发布模型版本', {
      confirmButtonText: '继续发布', cancelButtonText: '取消', type: 'warning', customClass: 'dw-ops-message-box',
    })
    await publishModelVersion(item.id)
    ElMessage.success(`V${item.versionNumber} 已发布并设为当前生效版本`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

function openValidation(item: ModelVersion) {
  if (!model.value || !canValidateModelVersion(item)) return
  if (item.datasetLabelType === 'pointerMeter') {
    router.push({
      name: 'meter-configuration-home',
      query: {
        modelId: model.value.id,
        modelName: model.value.name,
        versionId: item.id,
        versionName: `V${item.versionNumber}`,
        source: 'model-validation',
      },
    })
    return
  }
  validationOpen.value = true
}

function download(item: ModelVersion) {
  if (!model.value) return
  downloadModelVersionMock(model.value, item)
  ElMessage.success(`已生成 ${model.value.name} V${item.versionNumber} 下载文件`)
}
</script>

<template>
  <DwAppShell>
    <div v-if="model && validVersion" class="version-detail-page">
      <header class="version-detail-head">
        <button type="button" class="page-back" @click="router.push({ name: 'model-detail', params: { modelId: model.id } })">
          <IconArrowLeft :size="17" />返回模型详情
        </button>
        <div class="version-detail-title">
          <h1>{{ model.name }} / V{{ validVersion.versionNumber }}</h1>
          <el-tag :type="statusType(validVersion)" size="large">{{ statusLabel(validVersion) }}</el-tag>
        </div>
        <div class="version-detail-actions">
          <el-button class="dw-ops-secondary" @click="download(validVersion)">
            <IconDownload :size="16" />下载
          </el-button>
          <el-tooltip :disabled="canValidateModelVersion(validVersion)" content="模型发布后才可进行效果验证" placement="bottom">
            <span>
              <el-button class="dw-ops-secondary" :disabled="!canValidateModelVersion(validVersion)" @click="openValidation(validVersion)">
                <IconShieldCheck :size="16" />验证
              </el-button>
            </span>
          </el-tooltip>
          <el-button
            v-if="validVersion.releaseRole !== 'current'"
            type="primary"
            :loading="validVersion.publishStatus === 'publishing'"
            :disabled="!canPublishModelVersion(validVersion)"
            @click="handlePublish(validVersion)"
          >
            <IconRocket :size="16" />{{ validVersion.releaseRole === 'historical' ? '重新发布' : '发布' }}
          </el-button>
        </div>
      </header>

      <section v-if="validVersion.trainingStatus === 'training'" class="training-progress">
        <div><strong>训练进度</strong><span>{{ validVersion.progress ?? 0 }}%</span></div>
        <el-progress :percentage="validVersion.progress ?? 0" :stroke-width="8" />
      </section>

      <section class="version-information">
        <h2>版本信息</h2>
        <dl>
          <div><dt>模型名称</dt><dd>{{ model.name }}</dd></div>
          <div><dt>版本</dt><dd>V{{ validVersion.versionNumber }}</dd></div>
          <div><dt>当前状态</dt><dd>{{ statusLabel(validVersion) }}</dd></div>
          <div><dt>训练数据集</dt><dd>{{ validVersion.datasetName }}</dd></div>
          <div><dt>数据集标签</dt><dd>{{ validVersion.datasetLabelType ?? '--' }}</dd></div>
          <div><dt>基础模型</dt><dd>{{ baseModelLabel(validVersion) }}</dd></div>
          <div><dt>训练方式</dt><dd>{{ trainingMethodLabel(validVersion) }}</dd></div>
          <div><dt>Epoch / 训练轮数</dt><dd>{{ validVersion.parameters.epochs }}</dd></div>
          <div><dt>Batch Size</dt><dd>{{ validVersion.parameters.batchSize }}</dd></div>
          <div><dt>Image Size / 图片尺寸</dt><dd>{{ validVersion.parameters.imageSize }}</dd></div>
          <div><dt>Early Stop</dt><dd>{{ validVersion.parameters.earlyStop }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ validVersion.createdAt }}</dd></div>
          <div><dt>训练开始时间</dt><dd>{{ validVersion.trainingStartedAt ?? '--' }}</dd></div>
          <div><dt>训练结束时间</dt><dd>{{ validVersion.trainingFinishedAt ?? '--' }}</dd></div>
          <div><dt>训练耗时</dt><dd>{{ durationText(validVersion) }}</dd></div>
          <div><dt>发布状态</dt><dd>{{ validVersion.publishStatus === 'publishing' ? '发布中' : validVersion.releaseRole === 'unreleased' ? '未发布' : '已发布' }}</dd></div>
          <div><dt>发布时间</dt><dd>{{ validVersion.publishedAt ?? '--' }}</dd></div>
        </dl>
      </section>
    </div>

    <div v-else class="version-not-found">
      <strong>未找到模型版本</strong>
      <el-button type="primary" @click="router.push('/training')">返回训练</el-button>
    </div>

    <ModelValidationDialog v-model="validationOpen" :model="model" :version="validVersion" />
  </DwAppShell>
</template>

<style scoped>
.version-detail-page {
  height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 16px; overflow: hidden;
}
.version-detail-head {
  flex: 0 0 auto; min-height: 66px; display: grid; grid-template-columns: 180px minmax(0, 1fr) auto; align-items: center; gap: 20px;
}
.page-back {
  display: inline-flex; align-items: center; gap: 7px; padding: 0; border: 0; background: transparent; color: var(--el-text-color-regular); cursor: pointer;
}
.version-detail-title, .version-detail-actions, .training-progress > div { display: flex; align-items: center; }
.version-detail-title { gap: 14px; }
.version-detail-title h1, .version-information h2 { margin: 0; color: var(--el-text-color-primary); letter-spacing: 0; }
.version-detail-title h1 { font-size: 22px; }
.version-detail-actions { justify-content: flex-end; gap: var(--dw-button-group-gap, 8px); }
.training-progress, .version-information {
  border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
}
.training-progress { flex: 0 0 auto; padding: 16px 20px; }
.training-progress > div { justify-content: space-between; margin-bottom: 10px; color: var(--el-text-color-regular); }
.version-information { flex: 1; min-height: 0; padding: 20px 24px; overflow: auto; }
.version-information h2 { margin-bottom: 18px; font-size: 17px; }
.version-information dl { display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 0; margin: 0; }
.version-information dl > div { min-height: 76px; padding: 14px 16px; border-bottom: 1px solid var(--el-border-color-lighter); box-sizing: border-box; }
.version-information dt { color: var(--el-text-color-secondary); font-size: 12px; }
.version-information dd { margin: 7px 0 0; color: var(--el-text-color-primary); font-size: 14px; }
.version-not-found { height: 100%; display: grid; place-content: center; justify-items: center; gap: 16px; color: var(--el-text-color-primary); }
@media (max-width: 960px) {
  .version-detail-head { grid-template-columns: 150px minmax(0, 1fr); }
  .version-detail-actions { grid-column: 1 / -1; }
  .version-information dl { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
}
</style>
