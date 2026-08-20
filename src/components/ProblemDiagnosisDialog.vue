<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  IconAlertTriangle,
  IconChartRadar,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconClipboardCheck,
  IconTool,
} from '@tabler/icons-vue'
import type { DiagnosisAction, DiagnosisIssue, DiagnosisReport, DiagnosisStatus } from '@/state/preflightChecks'

const props = defineProps<{
  modelValue: boolean
  report: DiagnosisReport | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  continue: []
  cancel: []
  action: [actionKey: string, issue: DiagnosisIssue]
  'quality-report': [target?: string]
  annotate: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const localIssues = ref<DiagnosisIssue[]>([])
const drawerOpen = ref(false)
const drawerTitle = ref('')
const drawerBody = ref('')
const actionLoading = ref<string[]>([])
const expandedGroups = ref<string[]>([])

const unresolvedIssues = computed(() => localIssues.value.filter((issue) => !issue.resolved))
const exceptionIssue = computed(() => (props.report?.mode === 'exception' ? localIssues.value[0] : undefined))
const blockingIssues = computed(() => unresolvedIssues.value.filter((issue) => issue.blocking))
const reminderIssues = computed(() => unresolvedIssues.value.filter((issue) => issue.severity === 'reminder'))
const hasQualityReminder = computed(() => Boolean(
  props.report?.mode === 'precheck'
  && props.report.qualitySummary
  && props.report.qualitySummary.level !== 'excellent',
))
const needsAnnotation = computed(() => Boolean(
  props.report?.mode === 'precheck'
  && props.report.qualitySummary?.level === 'notReady'
))

const currentStatus = computed<DiagnosisStatus>(() => {
  if (blockingIssues.value.length) return 'alert'
  if (reminderIssues.value.length || hasQualityReminder.value) return 'reminder'
  return 'pass'
})

const statusIcon = computed(() => {
  if (currentStatus.value === 'pass') return IconCircleCheck
  if (currentStatus.value === 'reminder') return IconAlertTriangle
  return IconCircleX
})

const continueText = computed(() => (props.report?.mode === 'exception' ? '完成处理' : '开始训练'))
const severityRank: Record<DiagnosisStatus, number> = { alert: 0, reminder: 1, pass: 2 }
const orderedIssues = computed(() => [...localIssues.value].sort((left, right) => {
  if (left.resolved !== right.resolved) return left.resolved ? 1 : -1
  return severityRank[left.severity] - severityRank[right.severity]
}))
const primaryIssue = computed(() => orderedIssues.value.find((issue) => !issue.resolved))
const dialogTitle = computed(() => (
  exceptionIssue.value?.title
  ?? primaryIssue.value?.title
  ?? props.report?.title
  ?? '问题诊断'
))

const groupedIssues = computed(() => {
  const groups = new Map<string, { key: string; label: string; issues: DiagnosisIssue[] }>()
  orderedIssues.value.forEach((issue) => {
    const group = groups.get(issue.category) ?? {
      key: issue.category,
      label: issue.categoryName,
      issues: [],
    }
    group.issues.push(issue)
    groups.set(issue.category, group)
  })
  return Array.from(groups.values())
})

watch(
  () => props.report,
  (report) => {
    localIssues.value = report?.issues.map((issue) => ({
      ...issue,
      actions: issue.actions.map((action) => ({ ...action })),
      resolved: Boolean(issue.resolved),
    })) ?? []
    expandedGroups.value = Array.from(new Set(localIssues.value.map((issue) => issue.category)))
  },
  { immediate: true },
)

function openMockDrawer(action: DiagnosisAction) {
  const contentMap: Record<string, { title: string; body: string }> = {
    'view-gpu': {
      title: 'GPU 状态看板',
      body: 'GPU 0：占用 94%，可用显存不足；GPU 1：占用 76%。产品性能目标：训前静态自检总阻塞耗时 <20秒。',
    },
    'view-disk': {
      title: '磁盘占用',
      body: '训练盘可用空间 3.8GB，低于 5GB 提醒阈值。建议清理历史训练缓存。',
    },
    'view-memory': {
      title: '内存占用',
      body: '当前内存占用 92%，主要来自推理任务和训练预加载进程。',
    },
    'view-package-version': {
      title: '推荐标品算法包版本',
      body: '当前安装版本 1.1.6，推荐版本 1.1.7。升级后可重新执行训前自检。',
    },
    'view-label-rules': {
      title: '标签规则',
      body: '互斥标签不能同时标注在同一目标上；表计类必须包含表盘、指针、刻度或读数区域。',
    },
    'view-import-guide': {
      title: '导入说明',
      body: '当前支持直接导入图片或 DWD 数据包。DWD 为 DW Detection 专用数据集格式。',
    },
    'view-abnormal-files': {
      title: '异常文件',
      body: 'meter.001.jpg：文件损坏；meter.002.png：0KB；meter.003.bmp：格式无法解析。',
    },
  }
  const content = contentMap[action.key]
  if (!content) return
  drawerTitle.value = content.title
  drawerBody.value = content.body
  drawerOpen.value = true
}

async function runAction(issue: DiagnosisIssue, action: DiagnosisAction) {
  try {
    if (action.needsConfirm) {
      await ElMessageBox.confirm('覆盖训练会忽略上一轮未部署结果，确认继续？', '二次确认', {
        type: 'warning',
        confirmButtonText: '确认覆盖',
        cancelButtonText: '取消',
      })
    }
  } catch {
    return
  }
  actionLoading.value = [...actionLoading.value, action.key]
  if (action.loadingMs) {
    await new Promise((resolve) => window.setTimeout(resolve, action.loadingMs))
  }
  actionLoading.value = actionLoading.value.filter((key) => key !== action.key)
  if (action.resolves !== false) issue.resolved = true
  openMockDrawer(action)
  emit('action', action.key, issue)
  ElMessage.success(action.resolves === false ? `${action.label}已打开` : `${action.label}已完成`)
  if (props.report?.mode === 'exception' && (action.resolves !== false || action.closeAfterAction)) {
    visible.value = false
    emit('continue')
    return
  }
  if (action.closeAfterAction) {
    visible.value = false
  }
}

function cancel() {
  visible.value = false
  emit('cancel')
}

function continueFlow() {
  if (currentStatus.value === 'alert') return
  visible.value = false
  emit('continue')
}

function enterAnnotation() {
  visible.value = false
  emit('annotate')
}

function qualityType(level?: string) {
  if (level === 'excellent') return 'success'
  if (level === 'normal') return 'warning'
  if (level === 'poor') return 'danger'
  return 'info'
}

function qualityText(level?: string) {
  if (level === 'excellent') return '优秀'
  if (level === 'normal') return '一般'
  if (level === 'poor') return '待优化'
  return '待评估'
}

function conciseDescription(issue: DiagnosisIssue) {
  const descriptions: Record<string, string> = {
    'environment-gpu-high': '当前 GPU 占用 94%。',
    'environment-disk-low': '可用空间 3.8GB，低于 5GB。',
    'environment-memory-high': '当前内存占用 92%。',
    'environment-image-missing': '训练镜像不可用。',
  }
  return descriptions[issue.id] ?? issue.description
}

function conciseSuggestion(issue: DiagnosisIssue) {
  const suggestions: Record<string, string> = {
    'environment-gpu-high': '资源紧张，建议稍后重试。',
    'environment-disk-low': '建议释放磁盘空间。',
    'environment-memory-high': '建议释放内存后重试。',
    'environment-image-missing': '请恢复训练镜像后重试。',
  }
  return suggestions[issue.id] ?? issue.suggestion
}

function normalizedIssueText(value?: string) {
  return (value ?? '')
    .replace(/^[⚠️🛑]\s*(AI提醒|AI预警)：?\s*/, '')
    .replace(/[。；，,\s]+$/g, '')
    .trim()
}

function issueDetail(issue: DiagnosisIssue) {
  const description = conciseDescription(issue)
  const suggestion = conciseSuggestion(issue)
  const titleText = normalizedIssueText(issue.title)
  const descriptionText = normalizedIssueText(description)
  const parts: string[] = []
  if (descriptionText && descriptionText !== titleText) parts.push(description)
  if (
    normalizedIssueText(suggestion)
    && normalizedIssueText(suggestion) !== descriptionText
    && normalizedIssueText(suggestion) !== titleText
  ) {
    parts.push(suggestion)
  }
  return parts.join(' ')
}

function issueType(issue: DiagnosisIssue) {
  if (issue.resolved || issue.severity === 'pass') return 'success'
  return issue.severity === 'alert' ? 'danger' : 'warning'
}

function toggleGroup(groupKey: string) {
  expandedGroups.value = expandedGroups.value.includes(groupKey)
    ? expandedGroups.value.filter((key) => key !== groupKey)
    : [...expandedGroups.value, groupKey]
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :width="report?.mode === 'exception' ? 'var(--dw-dialog-size-small)' : 'var(--dw-dialog-size-medium)'"
    align-center
    append-to-body
    class="dw-problem-dialog"
    :class="{ 'is-precheck': report?.mode === 'precheck' }"
  >
    <template #header>
      <div class="dw-problem-header">
        <component :is="statusIcon" :size="22" />
        <div>
          <h3>{{ dialogTitle }}</h3>
        </div>
      </div>
    </template>

    <section v-if="report?.mode === 'precheck' && report.qualitySummary" class="dw-quality-summary">
      <div class="dw-quality-summary__head">
        <span><IconChartRadar :size="18" />样本质量</span>
        <el-tag :type="qualityType(report.qualitySummary.level)" effect="dark">
          {{ qualityText(report.qualitySummary.level) }}
        </el-tag>
      </div>
      <div class="dw-quality-summary__body">
        <span>{{ report.qualitySummary.issueCount }}项待优化</span>
        <span>样本数量：{{ report.qualitySummary.sampleCount }} 张</span>
        <span>标注情况：{{ report.qualitySummary.annotatedCount }}/{{ report.qualitySummary.totalCount }}</span>
      </div>
      <el-button link type="primary" @click="emit('quality-report', report.qualitySummary.reportTarget)">
        查看完整质量报告
      </el-button>
    </section>

    <section v-if="report?.mode === 'exception' && exceptionIssue" class="dw-exception-panel">
      <p>{{ exceptionIssue.description }}</p>
      <small>{{ exceptionIssue.suggestion }}</small>
    </section>

    <template v-else-if="localIssues.length">
      <div class="dw-problem-tree">
        <section v-for="group in groupedIssues" :key="group.key" class="dw-problem-group">
          <button type="button" class="dw-problem-group__head" @click="toggleGroup(group.key)">
            <span class="dw-problem-group__node" />
            <strong>{{ group.label }}</strong>
            <small>{{ group.issues.length }} 项</small>
            <IconChevronDown
              :size="16"
              :class="{ 'is-collapsed': !expandedGroups.includes(group.key) }"
            />
          </button>
          <div v-show="expandedGroups.includes(group.key)" class="dw-problem-group__items">
            <div
              v-for="issue in group.issues"
              :key="issue.id"
              class="dw-problem-item"
              :class="[{ 'is-fixed': issue.resolved }, `is-${issue.severity}`]"
            >
              <div class="dw-problem-item__top">
                <strong>{{ issue.title }}</strong>
                <div v-if="report?.mode !== 'precheck'" class="dw-problem-actions">
                  <el-button
                    v-for="action in issue.actions"
                    :key="action.key"
                    class="dw-ops-secondary"
                    size="small"
                    :disabled="issue.resolved"
                    :loading="actionLoading.includes(action.key)"
                    @click="runAction(issue, action)"
                  >
                    <span class="dw-btn-inner"><IconTool :size="14" />{{ action.label }}</span>
                  </el-button>
                </div>
              </div>
              <p v-if="issueDetail(issue)">{{ issueDetail(issue) }}</p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <div v-else class="dw-problem-empty">
      <IconClipboardCheck :size="34" />
      <span>运行环境与系统依赖检查通过</span>
    </div>

    <template #footer>
      <div v-if="report?.mode === 'exception' && exceptionIssue" class="dw-dialog-footer">
        <el-button @click="continueFlow">稍后处理</el-button>
        <el-button
          v-for="action in exceptionIssue.actions"
          :key="action.key"
          :type="issueType(exceptionIssue)"
          :disabled="exceptionIssue.resolved"
          :loading="actionLoading.includes(action.key)"
          @click="runAction(exceptionIssue, action)"
        >
          {{ action.label }}
        </el-button>
      </div>
      <div v-else-if="report?.mode === 'precheck'" class="dw-dialog-footer">
        <el-button @click="cancel">取消</el-button>
        <el-button v-if="blockingIssues.length" type="primary" disabled>
          存在预警，暂不可训练
        </el-button>
        <el-button v-else type="primary" @click="needsAnnotation ? enterAnnotation() : continueFlow()">
          {{ needsAnnotation ? '进入标注' : '继续训练' }}
        </el-button>
      </div>
      <div v-else class="dw-dialog-footer">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="needsAnnotation ? enterAnnotation() : continueFlow()">
          {{ needsAnnotation ? '进入标注' : continueText }}
        </el-button>
      </div>
    </template>

    <el-drawer v-model="drawerOpen" :title="drawerTitle" size="360px" append-to-body>
      <p class="dw-drawer-body">{{ drawerBody }}</p>
      <el-progress :percentage="drawerTitle.includes('GPU') ? 94 : 92" status="warning" />
    </el-drawer>
  </el-dialog>
</template>

<style scoped>
.dw-problem-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-primary);
}

.dw-exception-panel {
  padding: 14px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.dw-exception-panel p {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 22px;
}

.dw-exception-panel small {
  display: block;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.dw-problem-header h3 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.dw-problem-header p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.dw-quality-summary {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 12px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dw-quality-summary__head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dw-quality-summary__head > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.dw-quality-summary__body {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.dw-problem-tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  scrollbar-width: thin;
}

.dw-problem-group {
  position: relative;
}

.dw-problem-group__head {
  width: 100%;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: left;
}

.dw-problem-group__head strong {
  font-size: 13px;
}

.dw-problem-group__head small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-problem-group__head svg {
  transition: transform 160ms ease;
}

.dw-problem-group__head svg.is-collapsed {
  transform: rotate(-90deg);
}

.dw-problem-group__node {
  width: 8px;
  height: 8px;
  border: 2px solid var(--el-color-primary);
  border-radius: 50%;
  background: var(--el-bg-color-overlay);
}

.dw-problem-group__items {
  position: relative;
  display: grid;
  gap: 8px;
  margin-left: 4px;
  padding: 4px 0 0 18px;
  border-left: 1px solid var(--el-border-color);
}

.dw-problem-group__items::before {
  content: '';
  position: absolute;
  left: 0;
  top: 27px;
  width: 12px;
  border-top: 1px solid var(--el-border-color);
}

.dw-problem-item {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dw-problem-item.is-alert {
  border-color: color-mix(in srgb, var(--el-color-danger) 46%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-danger) 12%, var(--el-fill-color-light));
}

.dw-problem-item.is-reminder {
  border-color: color-mix(in srgb, var(--el-color-warning) 42%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-warning) 12%, var(--el-fill-color-light));
}

.dw-problem-item.is-pass,
.dw-problem-item.is-fixed {
  border-color: color-mix(in srgb, var(--el-color-success) 38%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-success) 9%, var(--el-fill-color-light));
}

.dw-problem-item.is-fixed {
  opacity: 0.64;
}

.dw-problem-item__top {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  color: var(--el-text-color-primary);
  text-align: left;
}

.dw-problem-item__top strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.dw-problem-item p {
  margin: 8px 0 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 20px;
}

.dw-problem-item small {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dw-problem-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.dw-problem-empty {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.dw-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.dw-dialog-footer .el-button + .el-button {
  margin-left: 0;
}

.dw-drawer-body {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 22px;
}

:global(.dw-problem-dialog.el-dialog) {
  max-width: calc(100vw - 32px);
  max-height: min(var(--dw-dialog-max-height, 600px), calc(100vh - 32px));
  display: flex;
  flex-direction: column;
}

:global(.dw-problem-dialog.is-precheck.el-dialog) {
  height: auto;
}

:global(.dw-problem-dialog .el-dialog__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow-y: auto !important;
  scrollbar-width: thin;
}

:global(.dw-problem-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
}

:global(.dw-problem-dialog .dw-dialog-footer) {
  width: 100%;
}
</style>
