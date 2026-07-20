<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconCircleCheck, IconDots, IconPlus, IconRocket, IconSearch } from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import ProblemDiagnosisDialog from '@/components/ProblemDiagnosisDialog.vue'
import TrainingDialog from '@/components/TrainingDialog.vue'
import { deployTraining, getAlgorithm, getAnalysisType, workflowState, type TrainingJob } from '@/state/workflow'
import {
  applyDiagnosisMockAction,
  buildAbnormalDiagnosisReport,
  type AbnormalDiagnosisType,
  type DiagnosisIssue,
  type DiagnosisReport,
} from '@/state/preflightChecks'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const trainingOpen = ref(false)
const diagnosisOpen = ref(false)
const diagnosisReport = ref<DiagnosisReport | null>(null)
const completionOpen = ref(false)
const completedJob = ref<TrainingJob | null>(null)
const deploymentSuccessOpen = ref(false)
const deployedJob = ref<TrainingJob | null>(null)
const diagnosisJobId = ref<string>()
let nextDeploymentFails = true
const deploymentTimers = new Set<number>()
const observedStatuses = new Map(workflowState.trainingJobs.map((job) => [job.id, job.status]))

const rows = computed(() => {
  return workflowState.trainingJobs.filter((job) => {
    const algorithm = getAlgorithm(job.algorithmId)
    const matchesKeyword = !keyword.value || algorithm.name.includes(keyword.value) || job.version.includes(keyword.value)
    const matchesStatus = !status.value || job.status === status.value
    return matchesKeyword && matchesStatus
  })
})

function deploy(jobId: string) {
  const job = workflowState.trainingJobs.find((item) => item.id === jobId)
  if (!job || job.status !== '训练成功' || job.deploymentStatus === '部署中') return

  job.deploymentStatus = '部署中'
  ElMessage.info('已开始部署，正在加载模型服务…')
  const shouldFail = nextDeploymentFails
  nextDeploymentFails = !nextDeploymentFails

  const timer = window.setTimeout(() => {
    deploymentTimers.delete(timer)
    const currentJob = workflowState.trainingJobs.find((item) => item.id === jobId)
    if (!currentJob || currentJob.deploymentStatus !== '部署中') return
    if (shouldFail) {
      diagnosisJobId.value = currentJob.id
      openAbnormalGuide('deploy-timeout')
      return
    }
    deployTraining(currentJob.id)
    deployedJob.value = currentJob
    deploymentSuccessOpen.value = true
  }, 1500)
  deploymentTimers.add(timer)
}

function openAbnormalGuide(type: AbnormalDiagnosisType) {
  diagnosisReport.value = buildAbnormalDiagnosisReport(type)
  diagnosisOpen.value = true
}

function guideTypeByJob(job: (typeof workflowState.trainingJobs)[number]): AbnormalDiagnosisType | null {
  if (job.deploymentStatus === '部署中') return 'deploy-timeout'
  if (job.status === '训练失败') return 'validation-failed'
  if (job.status === '训练成功') return 'model-not-deployed'
  return null
}

function openJobDiagnosis(job: (typeof workflowState.trainingJobs)[number]) {
  const type = guideTypeByJob(job)
  if (type) {
    diagnosisJobId.value = job.id
    openAbnormalGuide(type)
  }
}

function handleDiagnosisAction(actionKey: string, issue: DiagnosisIssue) {
  applyDiagnosisMockAction(actionKey)
  if (actionKey === 'upload-template') {
    router.push({ name: 'meter-template-settings' })
    return
  }
  if (actionKey === 'view-missed-images') {
    router.push({ name: 'meter-template-validation' })
    return
  }
  if (actionKey === 'deploy-now') {
    const deployable = workflowState.trainingJobs.find((job) => job.id === diagnosisJobId.value)
      ?? workflowState.trainingJobs.find((job) => job.status === '训练成功')
    if (deployable) {
      deploy(deployable.id)
      return
    }
  }
  if (actionKey === 'stop-deployment') {
    const deploying = workflowState.trainingJobs.find((job) => job.id === diagnosisJobId.value && job.deploymentStatus === '部署中')
      ?? workflowState.trainingJobs.find((job) => job.deploymentStatus === '部署中')
      ?? workflowState.trainingJobs.find((job) => job.status === '训练成功')
    if (deploying) deploying.deploymentStatus = '已停止'
    ElMessage.success('部署已停止，可从训练列表重新发起部署')
    return
  }
  ElMessage.info(`${issue.title}：已执行 mock 操作`)
}

function trainingStatusText(job: TrainingJob) {
  if (job.deploymentStatus === '部署中') return '部署中'
  if (job.deploymentStatus === '已停止') return '已停止'
  return job.status
}

function trainingStatusType(job: TrainingJob) {
  if (job.status === '已部署') return 'success'
  if (job.status === '训练失败') return 'danger'
  if (job.status === '训练中' || job.deploymentStatus === '部署中' || job.deploymentStatus === '已停止') return 'warning'
  return 'primary'
}

function deploymentButtonText(job: TrainingJob) {
  if (job.deploymentStatus === '部署中') return '部署中'
  if (job.deploymentStatus === '已停止') return '重新部署'
  return '部署'
}

function handleMoreCommand(command: string, job: TrainingJob) {
  if (command === 'exception') {
    openJobDiagnosis(job)
    return
  }
  if (command === 'detail') {
    ElMessage.info(`${getAlgorithm(job.algorithmId).name} ${job.version}：训练详情已打开（Mock）`)
    return
  }
  if (command === 'log') {
    ElMessage.info(`${job.version} 训练日志已打开（Mock）`)
    return
  }
  ElMessage.success(`已复制 ${job.version} 的训练配置（Mock）`)
}

function startDeploymentFromCompletion() {
  if (!completedJob.value) return
  const jobId = completedJob.value.id
  completionOpen.value = false
  deploy(jobId)
}

function goRunDeployedAlgorithm() {
  deploymentSuccessOpen.value = false
  router.push('/')
}

onUnmounted(() => {
  deploymentTimers.forEach((timer) => window.clearTimeout(timer))
  deploymentTimers.clear()
})

watch(
  () => workflowState.trainingJobs.map((job) => ({ id: job.id, status: job.status })),
  (jobs) => {
    jobs.forEach(({ id, status: nextStatus }) => {
      const previousStatus = observedStatuses.get(id)
      observedStatuses.set(id, nextStatus)
      if (previousStatus !== '训练中' || nextStatus !== '训练成功') return
      const job = workflowState.trainingJobs.find((item) => item.id === id)
      if (!job) return
      completedJob.value = job
      completionOpen.value = true
    })
  },
  { deep: true },
)
</script>

<template>
  <DwAppShell>
    <div class="dw-list-page dw-ops-surface">
      <div class="dw-list-toolbar">
        <div>
          <h1>训练列表</h1>
        </div>
        <div class="dw-list-actions">
          <el-input v-model="keyword" placeholder="搜索算法或版本" clearable>
            <template #prefix><IconSearch :size="16" /></template>
          </el-input>
          <el-select v-model="status" placeholder="训练状态" clearable>
            <el-option label="训练中" value="训练中" />
            <el-option label="训练成功" value="训练成功" />
            <el-option label="训练失败" value="训练失败" />
            <el-option label="已部署" value="已部署" />
          </el-select>
          <el-button type="primary" @click="trainingOpen = true">
            <span class="dw-btn-inner"><IconPlus :size="18" />新建训练</span>
          </el-button>
        </div>
      </div>

      <div class="dw-train-table">
        <div class="dw-table-layout">
          <div class="dw-table-head">
            <span>算法名称</span><span>版本</span><span>分析类型</span><span>训练状态</span><span>训练完成时间</span><span>操作</span>
          </div>
          <div class="dw-table-body">
            <div v-for="job in rows" :key="job.id" class="dw-table-row">
              <span class="dw-name">{{ getAlgorithm(job.algorithmId).name }}</span>
              <span>{{ job.version }}</span>
              <span>{{ getAnalysisType(job.analysisTypeId).name }}</span>
              <span>
                <el-tag
                  size="small"
                  effect="dark"
                  :type="trainingStatusType(job)"
                >
                  {{ trainingStatusText(job) }}
                </el-tag>
              </span>
              <span>{{ job.finishedAt }}</span>
              <span class="dw-row-actions">
                <el-button
                  link
                  type="primary"
                  :disabled="job.status !== '训练成功' || job.deploymentStatus === '部署中'"
                  @click="deploy(job.id)"
                >
                  <span class="dw-btn-inner"><IconRocket :size="16" />{{ deploymentButtonText(job) }}</span>
                </el-button>
                <el-dropdown trigger="click" @command="(command: string) => handleMoreCommand(command, job)">
                  <el-button link type="primary">
                    <span class="dw-btn-inner">更多<IconDots :size="16" /></span>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="detail">查看详情</el-dropdown-item>
                      <el-dropdown-item command="log">查看训练日志</el-dropdown-item>
                      <el-dropdown-item command="copy">复制训练配置</el-dropdown-item>
                      <el-dropdown-item v-if="guideTypeByJob(job)" command="exception" divided>查看异常指引</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="dw-list-footer">
        <span>共 {{ rows.length }} 条训练任务</span>
        <el-pagination background small layout="prev, pager, next, jumper" :total="rows.length" :page-size="10" />
      </div>
    </div>

    <TrainingDialog v-model="trainingOpen" />
    <ProblemDiagnosisDialog
      v-model="diagnosisOpen"
      :report="diagnosisReport"
      @continue="diagnosisOpen = false"
      @action="handleDiagnosisAction"
    />

    <el-dialog
      v-model="completionOpen"
      width="var(--dw-dialog-size-small)"
      align-center
      append-to-body
      class="training-completion-dialog"
    >
      <template #header>
        <div class="training-completion__title">
          <IconCircleCheck :size="22" />
          <span>训练完成</span>
        </div>
      </template>
      <div v-if="completedJob" class="training-completion__body">
        <strong>{{ getAlgorithm(completedJob.algorithmId).name }} {{ completedJob.version }}</strong>
        <p>训练任务已成功完成。部署新版本后，可前往推理首页运行算法。</p>
      </div>
      <template #footer>
        <div class="training-completion__actions">
          <el-button @click="completionOpen = false">稍后处理</el-button>
          <el-button type="primary" @click="startDeploymentFromCompletion">部署并去运行</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deploymentSuccessOpen"
      width="var(--dw-dialog-size-small)"
      align-center
      append-to-body
      class="training-completion-dialog"
    >
      <template #header>
        <div class="training-completion__title">
          <IconCircleCheck :size="22" />
          <span>部署成功</span>
        </div>
      </template>
      <div v-if="deployedJob" class="training-completion__body">
        <strong>{{ getAlgorithm(deployedJob.algorithmId).name }} {{ deployedJob.version }}</strong>
        <p>新版本已完成部署，可以前往推理首页运行算法。</p>
      </div>
      <template #footer>
        <div class="training-completion__actions">
          <el-button @click="deploymentSuccessOpen = false">留在训练列表</el-button>
          <el-button type="primary" @click="goRunDeployedAlgorithm">去运行</el-button>
        </div>
      </template>
    </el-dialog>
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
  grid-template-columns: 220px 150px auto;
  gap: 8px;
}

.dw-train-table {
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
  --dw-table-columns: 1.35fr 0.55fr 1fr 0.85fr 1.15fr 1.1fr;
  width: 100%;
  min-width: 920px;
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

.dw-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .dw-table-layout {
    --dw-table-columns: minmax(0, 1.3fr) minmax(0, 0.55fr) minmax(0, 1fr) minmax(0, 1.1fr);
    min-width: 0;
  }

  .dw-table-head > :nth-child(3),
  .dw-table-head > :nth-child(5),
  .dw-table-row > :nth-child(3),
  .dw-table-row > :nth-child(5) {
    display: none;
  }

  .dw-table-head > *,
  .dw-table-row > * {
    padding-inline: 8px;
  }
}

.dw-list-footer {
  height: 52px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.training-completion__title,
.training-completion__actions {
  display: flex;
  align-items: center;
}

.training-completion__title {
  gap: 8px;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.training-completion__title svg {
  color: var(--el-color-success);
}

.training-completion__body {
  padding: 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.training-completion__body strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.training-completion__body p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.training-completion__actions {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
}
</style>
