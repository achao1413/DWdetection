<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  IconArrowLeft,
  IconDownload,
  IconEye,
  IconRocket,
  IconShieldCheck,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import ModelValidationDialog from '@/components/ModelValidationDialog.vue'
import {
  canPublishModelVersion,
  canValidateModelVersion,
  getLatestModelValidation,
  getModel,
  getModelVersion,
  getModelVersions,
  publishModelVersion,
  type ModelVersion,
} from '@/state/workflow'
import { downloadModelVersionMock } from '@/utils/modelVersionDownload'

const route = useRoute()
const router = useRouter()
const validationOpen = ref(false)
const validationVersion = ref<ModelVersion>()

const model = computed(() => getModel(String(route.params.modelId)))
const versions = computed(() => model.value ? getModelVersions(model.value.id) : [])
const currentVersion = computed(() => model.value?.currentVersionId
  ? getModelVersion(model.value.currentVersionId)
  : undefined)

function statusKey(version?: ModelVersion) {
  if (!version) return 'empty'
  if (version.publishStatus === 'publishing') return 'publishing'
  if (version.publishStatus === 'failed') return 'publishFailed'
  if (version.trainingStatus === 'queued') return 'queued'
  if (version.trainingStatus === 'training') return 'training'
  if (version.trainingStatus === 'failed') return 'failed'
  if (version.releaseRole === 'current') return 'current'
  if (version.releaseRole === 'historical') return 'historical'
  return 'unreleased'
}

function statusLabel(version?: ModelVersion) {
  return {
    empty: '暂无版本', queued: '排队中', training: '训练中', failed: '训练失败',
    unreleased: '训练完成（待发布）', publishing: '发布中', publishFailed: '发布失败',
    current: '已发布 / 当前生效', historical: '历史版本',
  }[statusKey(version)]
}

function statusType(version?: ModelVersion) {
  const key = statusKey(version)
  if (key === 'current') return 'success'
  if (key === 'failed' || key === 'publishFailed') return 'danger'
  if (key === 'queued' || key === 'training' || key === 'publishing') return 'warning'
  if (key === 'unreleased') return 'primary'
  return 'info'
}

function baseModelLabel(version?: ModelVersion) {
  return version?.baseModel === 'power' ? '电力基础模型' : '通用模型'
}

function trainingMethodLabel(version?: ModelVersion) {
  return version?.trainingMethod === 'fineTune' ? '微调训练' : '从零训练'
}

function openVersion(version: ModelVersion) {
  router.push({
    name: 'model-version-detail',
    params: { modelId: version.modelId, versionId: version.id },
  })
}

async function handlePublish(version: ModelVersion) {
  if (!canPublishModelVersion(version)) return
  const active = currentVersion.value
  const message = active
    ? `发布V${version.versionNumber}后，当前生效的V${active.versionNumber}将变为历史版本。是否继续？`
    : `确定发布V${version.versionNumber}并设为当前生效版本吗？`
  try {
    await ElMessageBox.confirm(message, '发布模型版本', {
      confirmButtonText: '继续发布',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dw-ops-message-box',
    })
    await publishModelVersion(version.id)
    ElMessage.success(`V${version.versionNumber} 已发布并设为当前生效版本`)
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

function openValidation(version: ModelVersion) {
  if (!model.value || !canValidateModelVersion(version)) return
  if (version.datasetLabelType === 'pointerMeter') {
    router.push({
      name: 'meter-configuration-home',
      query: {
        modelId: model.value.id,
        modelName: model.value.name,
        versionId: version.id,
        versionName: `V${version.versionNumber}`,
        source: 'model-validation',
      },
    })
    return
  }
  validationVersion.value = version
  validationOpen.value = true
}

function download(version: ModelVersion) {
  if (!model.value) return
  downloadModelVersionMock(model.value, version)
  ElMessage.success(`已生成 ${model.value.name} V${version.versionNumber} 下载文件`)
}
</script>

<template>
  <DwAppShell>
    <div v-if="model" class="model-detail-page">
      <header class="model-detail-head">
        <button type="button" class="page-back" @click="router.push('/training')">
          <IconArrowLeft :size="17" />返回训练
        </button>
        <div>
          <h1>{{ model.name }}</h1>
          <p>管理模型版本、发布状态与效果验证。</p>
        </div>
      </header>

      <section v-if="currentVersion" class="current-version">
        <div class="current-version__heading">
          <div>
            <span>当前生效版本</span>
            <strong>V{{ currentVersion.versionNumber }}</strong>
          </div>
          <el-tag type="success" size="large">已发布 / 当前生效</el-tag>
        </div>
        <dl class="current-version__facts">
          <div><dt>基础模型</dt><dd>{{ baseModelLabel(currentVersion) }}</dd></div>
          <div><dt>训练方式</dt><dd>{{ trainingMethodLabel(currentVersion) }}</dd></div>
          <div><dt>发布时间</dt><dd>{{ currentVersion.publishedAt ?? '--' }}</dd></div>
          <div>
            <dt>最近验证结果</dt>
            <dd v-if="getLatestModelValidation(currentVersion)">
              {{ getLatestModelValidation(currentVersion)?.successRate.toFixed(1) }}%
              · {{ getLatestModelValidation(currentVersion)?.passed ? '通过' : '不通过' }}
            </dd>
            <dd v-else>暂无验证记录</dd>
          </div>
        </dl>
        <div class="current-version__actions">
          <el-button class="dw-ops-secondary" @click="download(currentVersion)">
            <IconDownload :size="16" />下载
          </el-button>
          <el-button type="primary" @click="openValidation(currentVersion)">
            <IconShieldCheck :size="16" />验证
          </el-button>
        </div>
      </section>

      <section class="version-list">
        <header><h2>全部版本</h2><span>共 {{ versions.length }} 个版本</span></header>
        <div class="version-list__head">
          <span>版本</span><span>状态</span><span>训练数据集</span><span>基础模型</span><span>创建时间</span><span>操作</span>
        </div>
        <div v-for="version in versions" :key="version.id" class="version-list__row">
          <strong>V{{ version.versionNumber }}</strong>
          <span>
            <el-tag :type="statusType(version)" size="small">{{ statusLabel(version) }}</el-tag>
            <el-progress v-if="version.trainingStatus === 'training'" :percentage="version.progress ?? 0" :show-text="false" :stroke-width="4" />
          </span>
          <span class="truncate">{{ version.datasetName }}</span>
          <span>{{ baseModelLabel(version) }}</span>
          <span>{{ version.createdAt }}</span>
          <span class="row-actions">
            <el-button link type="primary" @click="openVersion(version)"><IconEye :size="15" />查看详情</el-button>
            <el-button
              v-if="version.releaseRole !== 'current'"
              link
              type="primary"
              :loading="version.publishStatus === 'publishing'"
              :disabled="!canPublishModelVersion(version)"
              @click="handlePublish(version)"
            ><IconRocket :size="15" />{{ version.releaseRole === 'historical' ? '重新发布' : '发布' }}</el-button>
            <el-tooltip
              :disabled="canValidateModelVersion(version)"
              content="模型发布后才可进行效果验证"
              placement="top"
            >
              <span><el-button link type="primary" :disabled="!canValidateModelVersion(version)" @click="openValidation(version)">验证</el-button></span>
            </el-tooltip>
            <el-button link type="primary" @click="download(version)">下载</el-button>
          </span>
        </div>
      </section>
    </div>

    <div v-else class="model-not-found">
      <strong>未找到模型</strong>
      <el-button type="primary" @click="router.push('/training')">返回训练</el-button>
    </div>

    <ModelValidationDialog
      v-model="validationOpen"
      :model="model"
      :version="validationVersion"
    />
  </DwAppShell>
</template>

<style scoped>
.model-detail-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 2px;
  overflow: hidden;
}

.model-detail-head {
  flex: 0 0 auto;
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.page-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.model-detail-head h1,
.model-detail-head p,
.version-list h2 {
  margin: 0;
}

.model-detail-head h1 { color: var(--el-text-color-primary); font-size: 22px; }
.model-detail-head p { margin-top: 3px; color: var(--el-text-color-secondary); font-size: 13px; }

.current-version {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  padding: 18px 20px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
}

.current-version__heading { display: flex; align-items: center; gap: 14px; }
.current-version__heading > div { display: flex; flex-direction: column; gap: 4px; }
.current-version__heading span, .version-list header span { color: var(--el-text-color-secondary); font-size: 12px; }
.current-version__heading strong { color: var(--el-text-color-primary); font-size: 26px; }

.current-version__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 18px;
  margin: 0;
}

.current-version__facts div { min-width: 0; }
.current-version__facts dt { color: var(--el-text-color-secondary); font-size: 12px; }
.current-version__facts dd { margin: 6px 0 0; color: var(--el-text-color-primary); font-size: 13px; white-space: nowrap; }
.current-version__actions, .row-actions { display: flex; align-items: center; gap: var(--dw-button-group-gap, 8px); }

.version-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.version-list > header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; min-height: 48px; }
.version-list h2 { color: var(--el-text-color-primary); font-size: 17px; }
.version-list__head, .version-list__row {
  display: grid;
  grid-template-columns: 72px 168px minmax(180px, 1fr) 150px 170px minmax(350px, auto);
  align-items: center;
  column-gap: 16px;
  min-width: 1120px;
  padding: 0 18px;
  box-sizing: border-box;
}

.version-list__head { flex: 0 0 44px; background: var(--el-fill-color-darker); color: var(--el-text-color-secondary); font-size: 13px; }
.version-list__row { flex: 0 0 70px; color: var(--el-text-color-regular); font-size: 13px; background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent); }
.version-list__row:nth-child(odd) { background: color-mix(in srgb, var(--el-fill-color) 82%, transparent); }
.version-list__row > span:nth-child(2) { display: flex; flex-direction: column; gap: 7px; }
.version-list { overflow-x: auto; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-not-found { height: 100%; display: grid; place-content: center; justify-items: center; gap: 16px; color: var(--el-text-color-primary); }

@media (max-width: 1050px) {
  .current-version { grid-template-columns: 190px minmax(0, 1fr); }
  .current-version__actions { grid-column: 1 / -1; justify-content: flex-end; }
  .current-version__facts { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
}
</style>
