import { reactive } from 'vue'
import {
  getDataset,
  type OverallQualityLevel,
  type TrainingJob,
} from '@/state/workflow'

export type DiagnosisMode = 'precheck' | 'exception'
export type DiagnosisStatus = 'pass' | 'reminder' | 'alert'
export type DiagnosisSeverity = DiagnosisStatus

export type DiagnosisCategoryKey =
  | 'environment'
  | 'dependency'
  | 'upload'
  | 'training'
  | 'configuration'
  | 'validation'
  | 'deployment'

export type DiagnosisAction = {
  key: string
  label: string
  closeAfterAction?: boolean
  needsConfirm?: boolean
  resolves?: boolean
  loadingMs?: number
}

export type DiagnosisIssue = {
  id: string
  mode: DiagnosisMode
  category: DiagnosisCategoryKey
  categoryName: string
  subCategory: string
  severity: DiagnosisSeverity
  title: string
  description: string
  suggestion: string
  actions: DiagnosisAction[]
  blocking: boolean
  resolved: boolean
  message?: string
  impact?: string
}

export type DatasetQualitySummary = {
  level: OverallQualityLevel
  issueCount: number
  primaryIssues: string[]
  sampleCount: number
  annotatedCount: number
  totalCount: number
  reportTarget?: string
}

export type DiagnosisReport = {
  id: string
  mode: DiagnosisMode
  title: string
  status: DiagnosisStatus
  summary: string
  passCount: number
  totalCount: number
  issues: DiagnosisIssue[]
  qualitySummary?: DatasetQualitySummary
  performanceTargetMs?: number
}

export type TrainingPreflightPayload = {
  algorithmId: string
  datasetId: string
  analysisTypeId: string
  mode: TrainingJob['mode']
}

export type AbnormalDiagnosisType =
  | 'damaged-images'
  | 'decimal-file-names'
  | 'low-resolution'
  | 'high-resolution'
  | 'unsupported-mode'
  | 'label-config-error'
  | 'template-missing'
  | 'validation-failed'
  | 'model-not-deployed'
  | 'deploy-timeout'

type TrainingEnvironmentMock = {
  gpuUsage: number
  inferenceRunning: boolean
  trainingImageReady: boolean
  diskFreeGb: number
  memoryUsage: number
  installedPackageVersion: string
  requiredPackageVersion: string
}

export const trainingEnvironmentMock = reactive<TrainingEnvironmentMock>({
  gpuUsage: 94,
  inferenceRunning: true,
  trainingImageReady: true,
  diskFreeGb: 3.8,
  memoryUsage: 92,
  installedPackageVersion: '1.1.6',
  requiredPackageVersion: '1.1.7',
})

const categoryNameMap: Record<DiagnosisCategoryKey, string> = {
  environment: '运行环境',
  dependency: '系统依赖',
  upload: '数据上传',
  training: '训练异常',
  configuration: '配置异常',
  validation: '验证异常',
  deployment: '部署异常',
}

function createIssue(payload: Omit<DiagnosisIssue, 'categoryName' | 'resolved' | 'message' | 'impact'>): DiagnosisIssue {
  return {
    ...payload,
    categoryName: categoryNameMap[payload.category],
    resolved: false,
    message: payload.description,
    impact: payload.suggestion,
  }
}

function cloneIssue(issue: DiagnosisIssue): DiagnosisIssue {
  return {
    ...issue,
    actions: issue.actions.map((action) => ({ ...action })),
    resolved: false,
  }
}

function qualitySummary(datasetId: string): DatasetQualitySummary {
  const dataset = getDataset(datasetId)
  const severityOrder: Record<string, number> = { poor: 0, normal: 1, notReady: 2, excellent: 3 }
  const primaryIssues = dataset.qualityStatus.dimensions
    .filter((dimension) => dimension.level !== 'excellent')
    .sort((left, right) => severityOrder[left.level] - severityOrder[right.level])
    .slice(0, 2)
    .map((dimension) => `${dimension.name}：${dimension.status}`)

  return {
    level: dataset.qualityStatus.overallLevel,
    issueCount: dataset.qualityStatus.issueCount,
    primaryIssues,
    sampleCount: dataset.total,
    annotatedCount: dataset.annotated,
    totalCount: dataset.total,
    reportTarget: dataset.id,
  }
}

function reportStatus(issues: DiagnosisIssue[], quality?: DatasetQualitySummary): DiagnosisStatus {
  if (issues.some((issue) => issue.blocking && !issue.resolved)) return 'alert'
  if (issues.some((issue) => !issue.resolved && issue.severity === 'reminder')) return 'reminder'
  if (quality && quality.level !== 'excellent') return 'reminder'
  return 'pass'
}

function finishReport(
  mode: DiagnosisMode,
  title: string,
  issues: DiagnosisIssue[],
  quality?: DatasetQualitySummary,
): DiagnosisReport {
  const status = reportStatus(issues, quality)
  const totalCount = mode === 'precheck' ? 5 : Math.max(issues.length, 1)
  const summary = status === 'pass'
    ? mode === 'precheck'
      ? '通过：运行环境与系统依赖均已准备完成。'
      : '通过：异常项已处理完成。'
    : status === 'reminder'
      ? 'AI提醒：发现可优化项，可继续流程，也可以先按建议处理。'
      : 'AI预警：发现阻塞项，处理完成后才能继续。'

  return {
    id: `${mode}-${Date.now()}`,
    mode,
    title,
    status,
    summary,
    passCount: Math.max(0, totalCount - issues.length),
    totalCount,
    issues,
    qualitySummary: quality,
    performanceTargetMs: mode === 'precheck' ? 20_000 : undefined,
  }
}

let showPackageBlockerOnNextPrecheck = true

function buildEnvironmentIssues(includePackageBlocker: boolean) {
  const issues: DiagnosisIssue[] = []

  if (trainingEnvironmentMock.gpuUsage > 90) {
    issues.push(createIssue({
      id: 'environment-gpu-high',
      mode: 'precheck',
      category: 'environment',
      subCategory: 'GPU资源',
      severity: 'reminder',
      blocking: false,
      title: 'GPU占用超过90%',
      description: `⚠️ AI提醒：当前 GPU 占用 ${trainingEnvironmentMock.gpuUsage}%，算力节点处于高负载状态。`,
      suggestion: '建议等待资源释放；如有推理任务，建议先停止推理。',
      actions: [{ key: 'stop-inference', label: '停止推理任务' }],
    }))
  }

  if (!trainingEnvironmentMock.trainingImageReady) {
    issues.push(createIssue({
      id: 'environment-image-missing',
      mode: 'precheck',
      category: 'environment',
      subCategory: '训练镜像',
      severity: 'alert',
      blocking: true,
      title: '训练镜像异常',
      description: '🛑 AI预警：发现训练基模镜像异常，训练环境尚未准备完成。',
      suggestion: '建议重新安装训练镜像。',
      actions: [{ key: 'reinstall-image', label: '重新安装镜像', loadingMs: 900 }],
    }))
  }

  if (trainingEnvironmentMock.diskFreeGb < 5) {
    issues.push(createIssue({
      id: 'environment-disk-low',
      mode: 'precheck',
      category: 'environment',
      subCategory: '磁盘空间',
      severity: 'reminder',
      blocking: false,
      title: '可用磁盘空间低于5GB',
      description: `⚠️ AI提醒：当前磁盘可用空间 ${trainingEnvironmentMock.diskFreeGb}GB，低于 5GB 提醒阈值。`,
      suggestion: '建议清理磁盘后继续训练。',
      actions: [{ key: 'clean-disk', label: '清理磁盘', loadingMs: 700 }],
    }))
  }

  if (trainingEnvironmentMock.memoryUsage > 90) {
    issues.push(createIssue({
      id: 'environment-memory-high',
      mode: 'precheck',
      category: 'environment',
      subCategory: '内存占用',
      severity: 'reminder',
      blocking: false,
      title: '内存占用超过90%',
      description: `⚠️ AI提醒：当前内存占用 ${trainingEnvironmentMock.memoryUsage}%，可能导致训练中断。`,
      suggestion: '建议关闭推理任务或其他高占用进程。',
      actions: [{ key: 'release-memory', label: '释放占用', loadingMs: 700 }],
    }))
  }

  if (
    includePackageBlocker
    && trainingEnvironmentMock.installedPackageVersion !== trainingEnvironmentMock.requiredPackageVersion
  ) {
    issues.push(createIssue({
      id: 'dependency-package-mismatch',
      mode: 'precheck',
      category: 'dependency',
      subCategory: '标品算法包',
      severity: 'alert',
      blocking: true,
      title: '标品算法包版本不兼容',
      description: '🛑 AI预警：发现当前版本与标品算法包不兼容。',
      suggestion: `已安装 ${trainingEnvironmentMock.installedPackageVersion}，推荐升级至 ${trainingEnvironmentMock.requiredPackageVersion}。`,
      actions: [{ key: 'upgrade-package', label: '升级算法包', loadingMs: 900 }],
    }))
  }

  return issues
}

export function buildTrainingPreflightReport(payload: TrainingPreflightPayload) {
  const dataset = getDataset(payload.datasetId)
  const includePackageBlocker = showPackageBlockerOnNextPrecheck
  showPackageBlockerOnNextPrecheck = !showPackageBlockerOnNextPrecheck
  return finishReport(
    'precheck',
    `${dataset.name} 训前自检`,
    buildEnvironmentIssues(includePackageBlocker),
    qualitySummary(dataset.id),
  )
}

const exceptionIssues: Record<AbnormalDiagnosisType, DiagnosisIssue> = {
  'damaged-images': createIssue({
    id: 'exception-damaged-images', mode: 'exception', category: 'upload', subCategory: '文件解析',
    severity: 'reminder', blocking: false, title: '样本文件异常',
    description: '⚠️ AI提醒：发现 3 张样本文件物理损坏或格式解析异常。',
    suggestion: '建议清理异常图像后再继续上传。',
    actions: [
      { key: 'clean-damaged-images', label: '一键清理损坏图像' },
      { key: 'view-abnormal-files', label: '查看异常文件', resolves: false },
    ],
  }),
  'decimal-file-names': createIssue({
    id: 'exception-decimal-file-names', mode: 'exception', category: 'upload', subCategory: '文件命名',
    severity: 'reminder', blocking: false, title: '图片名称包含小数点',
    description: '⚠️ AI提醒：发现 4 个图片名称包含小数点字符，存在训练解析风险。',
    suggestion: '建议批量规范文件名后继续。',
    actions: [{ key: 'normalize-file-names', label: '一键规范文件名', loadingMs: 500 }],
  }),
  'low-resolution': createIssue({
    id: 'exception-low-resolution', mode: 'exception', category: 'upload', subCategory: '图片分辨率',
    severity: 'reminder', blocking: false, title: '图片分辨率过低',
    description: '⚠️ AI提醒：发现 6 张图片分辨率低于640×480。',
    suggestion: '建议模拟等比缩放至1080P训练规格。',
    actions: [{ key: 'normalize-low-resolution', label: '自动统一尺寸', loadingMs: 600 }],
  }),
  'high-resolution': createIssue({
    id: 'exception-high-resolution', mode: 'exception', category: 'upload', subCategory: '图片分辨率',
    severity: 'reminder', blocking: false, title: '图片分辨率过高',
    description: '⚠️ AI提醒：发现 2 张图片分辨率超过4K。',
    suggestion: '建议模拟等比缩放至1080P训练规格。',
    actions: [{ key: 'normalize-high-resolution', label: '自动统一尺寸', loadingMs: 600 }],
  }),
  'unsupported-mode': createIssue({
    id: 'exception-unsupported-mode', mode: 'exception', category: 'training', subCategory: '训练方式',
    severity: 'reminder', blocking: false, title: '不支持当前训练方式',
    description: '⚠️ AI提醒：当前表计类型不支持新增训练。',
    suggestion: '数码管类型仅支持替换训练。',
    actions: [{ key: 'switch-replace-training', label: '切换为替换训练' }],
  }),
  'label-config-error': createIssue({
    id: 'exception-label-config-error', mode: 'exception', category: 'training', subCategory: '标签配置',
    severity: 'reminder', blocking: false, title: '标签配置错误',
    description: '⚠️ AI提醒：当前表计标签不支持自定义。',
    suggestion: '请按当前分析类型的预置标签规则完成配置。',
    actions: [{ key: 'view-label-rules', label: '查看规则说明', resolves: false }],
  }),
  'template-missing': createIssue({
    id: 'exception-template-missing', mode: 'exception', category: 'configuration', subCategory: '模板配置',
    severity: 'reminder', blocking: false, title: '模板未上传',
    description: '⚠️ AI提醒：模板尚未上传。',
    suggestion: '可以立即上传模板，也可以继续创建并保留当前配置内容。',
    actions: [
      { key: 'upload-template', label: '立即上传', closeAfterAction: true },
      { key: 'continue-config', label: '继续创建', closeAfterAction: true },
    ],
  }),
  'validation-failed': createIssue({
    id: 'exception-validation-failed', mode: 'exception', category: 'validation', subCategory: '验收结果',
    severity: 'reminder', blocking: false, title: '验证未通过',
    description: '⚠️ AI提醒：当前模型成功率未达到设定验收阈值。',
    suggestion: '建议查看漏检图片并补充验证样本。',
    actions: [{ key: 'view-missed-images', label: '查看漏检图片', closeAfterAction: true, resolves: false }],
  }),
  'model-not-deployed': createIssue({
    id: 'exception-model-not-deployed', mode: 'exception', category: 'deployment', subCategory: '模型部署',
    severity: 'reminder', blocking: false, title: '模型未部署',
    description: '⚠️ AI提醒：训练完成，但模型尚未部署。',
    suggestion: '建议立即部署后再回到推理页运行。',
    actions: [{ key: 'deploy-now', label: '立即部署' }],
  }),
  'deploy-timeout': createIssue({
    id: 'exception-deploy-timeout', mode: 'exception', category: 'deployment', subCategory: '部署进度',
    severity: 'reminder', blocking: false, title: '部署超过10分钟',
    description: '⚠️ AI提醒：部署耗时已超过10分钟。',
    suggestion: '建议停止本次部署，检查资源后重新发起。',
    actions: [{ key: 'stop-deployment', label: '停止部署' }],
  }),
}

export function buildAbnormalDiagnosisReport(type: AbnormalDiagnosisType) {
  return finishReport('exception', '异常行动指南', [cloneIssue(exceptionIssues[type])])
}

export function applyDiagnosisMockAction(actionKey: string) {
  const messages: Record<string, string> = {
    'stop-inference': '推理任务已停止，GPU占用已释放',
    'reinstall-image': '训练镜像已重新安装',
    'clean-disk': '磁盘已清理，可用空间已恢复',
    'release-memory': '高占用进程已释放',
    'upgrade-package': '标品算法包已升级至推荐版本',
    'clean-damaged-images': '损坏图像已清理',
    'normalize-file-names': '图片名称已批量规范',
    'normalize-low-resolution': '低分辨率图片已统一至1080P规格',
    'normalize-high-resolution': '超高分辨率图片已统一至1080P规格',
    'switch-replace-training': '训练方式已切换为替换训练',
    'continue-config': '已保留当前配置内容',
    'deploy-now': '模型已开始部署',
    'stop-deployment': '部署已停止，可重新发起部署',
  }

  if (actionKey === 'stop-inference') {
    trainingEnvironmentMock.inferenceRunning = false
    trainingEnvironmentMock.gpuUsage = 58
  }
  if (actionKey === 'reinstall-image') trainingEnvironmentMock.trainingImageReady = true
  if (actionKey === 'clean-disk') trainingEnvironmentMock.diskFreeGb = 32
  if (actionKey === 'release-memory') trainingEnvironmentMock.memoryUsage = 55
  if (actionKey === 'upgrade-package') {
    trainingEnvironmentMock.installedPackageVersion = trainingEnvironmentMock.requiredPackageVersion
  }
  return messages[actionKey]
}
