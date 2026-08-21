import { computed, reactive, watch } from 'vue'
import { figmaAssets } from '@/assets/figma'

export type AnalysisType = {
  id: string
  name: string
  code: string
  labels: string[]
}

export type AlgorithmItem = {
  id: string
  name: string
  version: string
  type: string
  inputType: string
  source: string
  status: '运行中' | '待部署' | '已停止'
  image: string
  tags: string[]
  defaultAnalysisTypeId: string
  updatedAt: string
  description: string
  runs: number
}

export type DatasetItem = {
  id: string
  name: string
  algorithmId: string
  analysisTypeId: string
  uploadedAt: string
  size: string
  description: string
  annotated: number
  total: number
  standard: string
  images: DatasetImage[]
  duplicateStats: DuplicateStats
  qualityStatus: DatasetQualityStatus
  datasetLabelType?: DatasetLabelType
}

export type CaptureTimePeriod = 'morning' | 'noon' | 'afternoon'

export type DatasetAnnotation = {
  label: string
  bboxRatio: number
  bbox?: { x: number; y: number; w: number; h: number }
}

export type DatasetImage = {
  id: string
  fileName: string
  captureTimePeriod: CaptureTimePeriod
  hasAnnotation: boolean
  annotations: DatasetAnnotation[]
  image: string
}

export type DuplicateStats = {
  duplicateCount: number
  duplicateRatio: number
  duplicateFiles: string[]
  duplicateSamples: DuplicateSample[]
}

export type DuplicateSample = {
  fileName: string
  similarityScore: number
}

export type QualityLevel = 'excellent' | 'normal' | 'poor'
export type QualityDimensionLevel = QualityLevel | 'notReady'
export type OverallQualityLevel = QualityLevel | 'notReady'

export type QualitySubMetric = {
  key: 'completeness' | 'standardization'
  name: string
  rate: number
  score: number | null
  level: QualityDimensionLevel
  status: string
  suggestion: string
}

export type QualityDimension = {
  key: 'sample-count' | 'time-distribution' | 'duplicate-ratio' | 'label-balance' | 'bbox-ratio' | 'annotation-quality'
  name: string
  score: number | null
  level: QualityDimensionLevel
  suggestion: string
  status: string
  subMetrics?: QualitySubMetric[]
}

export type DatasetQualityStatus = {
  overallLevel: OverallQualityLevel
  dimensions: QualityDimension[]
  issueCount: number
  summary: string
  diagnosisDurationMs: number
  performanceTargetMs: 5000
}

export type AnnotationImage = {
  id: string
  datasetId: string
  name: string
  fileName: string
  captureTimePeriod: CaptureTimePeriod
  image: string
  annotated: boolean
  annotations: DatasetAnnotation[]
  boxes: Array<{ id: string; label: string; x: number; y: number; w: number; h: number }>
  points: Array<{ id: string; label: string; x: number; y: number }>
}

export type TrainingJob = {
  id: string
  algorithmId: string
  datasetId: string
  analysisTypeId: string
  version: string
  mode: '新增子类' | '更新子类'
  typeName: string
  status: '训练中' | '训练成功' | '训练失败' | '已部署'
  deploymentStatus?: '未部署' | '部署中' | '已停止' | '已部署'
  finishedAt: string
}

export type DatasetLabelType = 'pointerMeter' | 'digitalMeter' | 'status' | 'defect' | 'generic'
export type BaseModelType = 'power' | 'generic'
export type TrainingMethod = 'fineTune' | 'fromScratch'
export type ModelTrainingStatus = 'queued' | 'training' | 'completed' | 'failed'
export type ModelReleaseRole = 'unreleased' | 'current' | 'historical'
export type ModelPublishStatus = 'idle' | 'publishing' | 'failed'

export type ModelParameters = {
  epochs: number
  batchSize: number
  imageSize: number
  earlyStop: number
}

export type ModelValidationResult = {
  id: string
  validationSetId: string
  validationSetName: string
  successRate: number
  passed: boolean
  validatedAt: string
}

export type ModelItem = {
  id: string
  name: string
  description?: string
  currentVersionId?: string
  latestVersionId?: string
  versionIds: string[]
  datasetLabelType?: DatasetLabelType
  createdAt: string
  updatedAt: string
}

export type ModelVersion = {
  id: string
  modelId: string
  versionNumber: number
  datasetId: string
  datasetName: string
  datasetLabelType?: DatasetLabelType
  baseModel: BaseModelType
  trainingMethod: TrainingMethod
  parameters: ModelParameters
  trainingStatus: ModelTrainingStatus
  releaseRole: ModelReleaseRole
  publishStatus: ModelPublishStatus
  progress?: number
  queuePosition?: number
  createdAt: string
  trainingStartedAt?: string
  trainingFinishedAt?: string
  publishedAt?: string
  validationHistory?: ModelValidationResult[]
}

type WorkflowState = {
  algorithms: AlgorithmItem[]
  analysisTypes: AnalysisType[]
  datasets: DatasetItem[]
  annotationImages: AnnotationImage[]
  trainingJobs: TrainingJob[]
  models: ModelItem[]
  modelVersions: ModelVersion[]
}

export const trainingSchedulerConfig = reactive({
  concurrencyLimit: 1,
})

const STORAGE_KEY = 'dw-detection-workflow-v3'
const modelTrainingTimers = new Map<string, { progress: number; completion: number }>()

const emptyDuplicateStats: DuplicateStats = {
  duplicateCount: 0,
  duplicateRatio: 0,
  duplicateFiles: [],
  duplicateSamples: [],
}

const capturePeriods: CaptureTimePeriod[] = ['morning', 'noon', 'afternoon']

function capturePeriodByIndex(index: number) {
  return capturePeriods[index % capturePeriods.length]
}

function normalizeCaptureTimePeriod(period?: CaptureTimePeriod) {
  return period === 'morning' || period === 'noon' || period === 'afternoon' ? period : 'morning'
}

function createNotReadyQualityStatus(): DatasetQualityStatus {
  return {
    overallLevel: 'notReady',
    issueCount: 6,
    summary: '待评估',
    diagnosisDurationMs: 0,
    performanceTargetMs: 5000,
    dimensions: [
      {
        key: 'sample-count',
        name: '样本数量',
        score: null,
        level: 'notReady',
        status: '等待样本',
        suggestion: '⚠️ AI建议：请先上传样本图片，系统将自动评估训练可用性。',
      },
      {
        key: 'time-distribution',
        name: '样本时间分布',
        score: null,
        level: 'notReady',
        status: '等待样本',
        suggestion: '⚠️ AI建议：请补充上午、正午、下午三个时段样本。',
      },
      {
        key: 'duplicate-ratio',
        name: '样本重复度',
        score: null,
        level: 'notReady',
        status: '等待去重',
        suggestion: '⚠️ AI建议：上传后系统会执行 AI去重，过滤高相似冗余样本。',
      },
      {
        key: 'label-balance',
        name: '类别均衡度',
        score: null,
        level: 'notReady',
        status: '待评估',
        suggestion: '⚠️ AI建议：完成标注后，AI 将评估各标签特征覆盖情况。',
      },
      {
        key: 'bbox-ratio',
        name: '目标画幅占比',
        score: null,
        level: 'notReady',
        status: '待评估',
        suggestion: '⚠️ AI建议：完成框选标注后，AI 将评估目标像素画幅是否合理。',
      },
      {
        key: 'annotation-quality',
        name: '标注质量',
        score: null,
        level: 'notReady',
        status: '待评估',
        suggestion: '⚠️ AI建议：开始标注后，AI 将评估标注完整性和规范性。',
      },
    ],
  }
}

type DemoDatasetSeed = Pick<
  DatasetItem,
  'id' | 'name' | 'algorithmId' | 'analysisTypeId' | 'uploadedAt' | 'size' | 'description' | 'annotated' | 'total' | 'standard' | 'datasetLabelType'
>

function createDemoDataset(seed: DemoDatasetSeed): DatasetItem {
  return {
    ...seed,
    images: [],
    duplicateStats: { ...emptyDuplicateStats },
    qualityStatus: createNotReadyQualityStatus(),
  }
}

const additionalDemoDatasets: DatasetItem[] = [
  createDemoDataset({ id: 'dataset-platen-acceptance', name: '压板状态-验收样本', algorithmId: 'helmet', analysisTypeId: 'helmet-state', uploadedAt: '2026-07-12 16:24:08', size: '512 MB', description: '覆盖投退、遮挡和多角度压板状态。', annotated: 132, total: 132, standard: '>= 100 张', datasetLabelType: 'status' }),
  createDemoDataset({ id: 'dataset-pointer-cold', name: '指针表-低温场景', algorithmId: 'meter', analysisTypeId: 'meter-reading', uploadedAt: '2026-07-11 10:18:42', size: '436 MB', description: '低温、结霜及弱光条件下的指针表样本。', annotated: 126, total: 126, standard: '>= 100 张', datasetLabelType: 'pointerMeter' }),
  createDemoDataset({ id: 'dataset-digital-meter', name: '数字表计-室内样本', algorithmId: 'meter', analysisTypeId: 'meter-reading', uploadedAt: '2026-07-10 14:36:17', size: '288 MB', description: '室内数字表计读数与反光场景。', annotated: 108, total: 118, standard: '>= 100 张', datasetLabelType: 'digitalMeter' }),
  createDemoDataset({ id: 'dataset-helmet-indoor', name: '安全帽巡检-室内站房', algorithmId: 'helmet', analysisTypeId: 'helmet-state', uploadedAt: '2026-07-09 09:12:55', size: '352 MB', description: '站房通道、设备间及出入口人员样本。', annotated: 114, total: 124, standard: '>= 100 张', datasetLabelType: 'status' }),
  createDemoDataset({ id: 'dataset-corrosion', name: '金属锈蚀-近景样本', algorithmId: 'sample', analysisTypeId: 'defect', uploadedAt: '2026-07-08 17:08:31', size: '246 MB', description: '不同锈蚀等级与材质表面近景。', annotated: 86, total: 104, standard: '>= 100 张', datasetLabelType: 'defect' }),
  createDemoDataset({ id: 'dataset-oil-leak', name: '设备渗漏油样本', algorithmId: 'sample', analysisTypeId: 'defect', uploadedAt: '2026-07-07 13:25:46', size: '318 MB', description: '法兰、油枕和连接处渗漏油场景。', annotated: 72, total: 92, standard: '>= 80 张', datasetLabelType: 'defect' }),
  createDemoDataset({ id: 'dataset-switch-state', name: '开关柜状态样本', algorithmId: 'helmet', analysisTypeId: 'helmet-state', uploadedAt: '2026-07-06 16:44:03', size: '198 MB', description: '开关柜指示状态与面板遮挡样本。', annotated: 64, total: 84, standard: '>= 80 张', datasetLabelType: 'status' }),
  createDemoDataset({ id: 'dataset-insulator', name: '绝缘子缺陷样本', algorithmId: 'sample', analysisTypeId: 'defect', uploadedAt: '2026-07-05 11:30:28', size: '402 MB', description: '绝缘子破损、污闪和异物缺陷。', annotated: 98, total: 112, standard: '>= 100 张', datasetLabelType: 'defect' }),
  createDemoDataset({ id: 'dataset-motor-sound', name: '主变异音样本', algorithmId: 'sound', analysisTypeId: 'sound-event', uploadedAt: '2026-07-04 15:19:12', size: '168 MB', description: '主变正常运行、放电和机械振动声纹。', annotated: 78, total: 90, standard: '>= 80 段', datasetLabelType: 'generic' }),
  createDemoDataset({ id: 'dataset-gauge-night', name: '压力表-夜间样本', algorithmId: 'meter', analysisTypeId: 'meter-reading', uploadedAt: '2026-07-03 20:42:37', size: '274 MB', description: '夜间补光、眩光及远距离压力表样本。', annotated: 58, total: 76, standard: '>= 80 张', datasetLabelType: 'pointerMeter' }),
  createDemoDataset({ id: 'dataset-personnel-boundary', name: '人员越界巡检样本', algorithmId: 'helmet', analysisTypeId: 'helmet-state', uploadedAt: '2026-07-03 08:16:49', size: '330 MB', description: '围栏、警戒线及检修区域人员行为。', annotated: 94, total: 108, standard: '>= 100 张', datasetLabelType: 'status' }),
]

type DemoModelSeed = {
  id: string
  name: string
  description: string
  datasetId: string
  datasetName: string
  datasetLabelType: DatasetLabelType
  createdAt: string
  releaseRole: ModelReleaseRole
}

const additionalModelSeeds: DemoModelSeed[] = [
  { id: 'model-helmet', name: '安全帽模型', description: '识别人员安全帽佩戴状态。', datasetId: 'dataset-helmet-indoor', datasetName: '安全帽巡检-室内站房', datasetLabelType: 'status', createdAt: '2026-07-01 09:18:22', releaseRole: 'current' },
  { id: 'model-digital-meter', name: '数字表模型', description: '识别数字式表计显示读数。', datasetId: 'dataset-digital-meter', datasetName: '数字表计-室内样本', datasetLabelType: 'digitalMeter', createdAt: '2026-07-02 11:26:40', releaseRole: 'current' },
  { id: 'model-corrosion', name: '锈蚀检测模型', description: '识别金属表面锈蚀及严重程度。', datasetId: 'dataset-corrosion', datasetName: '金属锈蚀-近景样本', datasetLabelType: 'defect', createdAt: '2026-07-03 13:42:11', releaseRole: 'historical' },
  { id: 'model-oil-leak', name: '渗漏油模型', description: '识别设备连接处渗漏油缺陷。', datasetId: 'dataset-oil-leak', datasetName: '设备渗漏油样本', datasetLabelType: 'defect', createdAt: '2026-07-04 10:08:35', releaseRole: 'unreleased' },
  { id: 'model-insulator', name: '绝缘子缺陷模型', description: '识别绝缘子破损、污闪和异物。', datasetId: 'dataset-insulator', datasetName: '绝缘子缺陷样本', datasetLabelType: 'defect', createdAt: '2026-07-05 15:34:52', releaseRole: 'current' },
  { id: 'model-switchgear', name: '开关柜状态模型', description: '识别开关柜指示和面板状态。', datasetId: 'dataset-switch-state', datasetName: '开关柜状态样本', datasetLabelType: 'status', createdAt: '2026-07-06 09:47:26', releaseRole: 'unreleased' },
  { id: 'model-transformer-sound', name: '主变异音模型', description: '识别主变异常放电和机械振动声纹。', datasetId: 'dataset-motor-sound', datasetName: '主变异音样本', datasetLabelType: 'generic', createdAt: '2026-07-07 14:21:03', releaseRole: 'current' },
  { id: 'model-gauge-night', name: '夜间压力表模型', description: '识别夜间补光场景下的压力表读数。', datasetId: 'dataset-gauge-night', datasetName: '压力表-夜间样本', datasetLabelType: 'pointerMeter', createdAt: '2026-07-08 19:05:44', releaseRole: 'historical' },
  { id: 'model-boundary', name: '人员越界模型', description: '识别警戒区域人员越界和异常停留。', datasetId: 'dataset-personnel-boundary', datasetName: '人员越界巡检样本', datasetLabelType: 'status', createdAt: '2026-07-09 08:38:19', releaseRole: 'current' },
]

const additionalDemoModels: ModelItem[] = additionalModelSeeds.map((seed) => {
  const versionId = `version-${seed.id}-v1`
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    currentVersionId: seed.releaseRole === 'current' ? versionId : undefined,
    latestVersionId: versionId,
    versionIds: [versionId],
    datasetLabelType: seed.datasetLabelType,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
  }
})

const failedDemoModelIds = new Set(['model-corrosion', 'model-oil-leak', 'model-switchgear'])

const additionalDemoModelVersions: ModelVersion[] = additionalModelSeeds.map((seed) => ({
  id: `version-${seed.id}-v1`,
  modelId: seed.id,
  versionNumber: 1,
  datasetId: seed.datasetId,
  datasetName: seed.datasetName,
  datasetLabelType: seed.datasetLabelType,
  baseModel: 'power',
  trainingMethod: 'fineTune',
  parameters: { epochs: 100, batchSize: 16, imageSize: 640, earlyStop: 15 },
  trainingStatus: failedDemoModelIds.has(seed.id) ? 'failed' : 'completed',
  releaseRole: failedDemoModelIds.has(seed.id) ? 'unreleased' : seed.releaseRole,
  publishStatus: 'idle',
  createdAt: seed.createdAt,
  trainingStartedAt: seed.createdAt,
  trainingFinishedAt: seed.createdAt,
  publishedAt: failedDemoModelIds.has(seed.id) || seed.releaseRole === 'unreleased' ? undefined : seed.createdAt,
}))

const initialState: WorkflowState = {
  analysisTypes: [
    {
      id: 'helmet-state',
      name: '状态识别',
      code: 'state',
      labels: ['佩戴安全帽', '未佩戴安全帽', '人员', '警戒区域'],
    },
    {
      id: 'meter-reading',
      name: '表计读数',
      code: 'reading',
      labels: ['表盘', '指针', '刻度', '读数区域'],
    },
    {
      id: 'defect',
      name: '缺陷识别',
      code: 'defect',
      labels: ['锈蚀', '裂纹', '污渍', '遮挡'],
    },
    {
      id: 'sound-event',
      name: '声纹事件',
      code: 'sound',
      labels: ['异常声纹', '背景噪声', '设备启停'],
    },
  ],
  algorithms: [
    {
      id: 'helmet',
      name: '安全帽检测算法',
      version: 'V9',
      type: '视觉小模型',
      inputType: '图像',
      source: '标注训练/算法训练/V9',
      status: '运行中',
      image: figmaAssets.algorithmHelmet,
      tags: ['图像', '安全帽'],
      defaultAnalysisTypeId: 'helmet-state',
      updatedAt: '2026-07-06 12:10:55',
      description: '识别作业人员是否正确佩戴安全帽，并对疑似违规场景进行提示。',
      runs: 26,
    },
    {
      id: 'meter',
      name: '表计读数算法',
      version: 'V64',
      type: '视觉大模型',
      inputType: '图像',
      source: '标注训练/表计/V65',
      status: '运行中',
      image: figmaAssets.taskThumbnailDefault,
      tags: ['图像', '表计'],
      defaultAnalysisTypeId: 'meter-reading',
      updatedAt: '2026-07-05 15:22:04',
      description: '定位表盘、指针与刻度区域，输出表计读数和可信度。',
      runs: 48,
    },
    {
      id: 'sound',
      name: '设备异音识别',
      version: 'V12',
      type: '音频小模型',
      inputType: '音频',
      source: '算法训练/声纹/V12',
      status: '待部署',
      image: figmaAssets.algorithmSound,
      tags: ['音频', '声纹'],
      defaultAnalysisTypeId: 'sound-event',
      updatedAt: '2026-07-03 09:40:18',
      description: '识别巡检录音中的异常声纹，辅助判断设备运行状态。',
      runs: 13,
    },
    {
      id: 'sample',
      name: '样本分类模型',
      version: 'V4',
      type: '多模态模型',
      inputType: '图像',
      source: '样本库/训练/V4',
      status: '已停止',
      image: figmaAssets.algorithmSample,
      tags: ['分类', '样本'],
      defaultAnalysisTypeId: 'defect',
      updatedAt: '2026-06-28 18:12:33',
      description: '用于样本质量分层和基础分类，支持后续训练筛选。',
      runs: 8,
    },
    {
      id: 'video',
      name: '区域入侵检测',
      version: 'V18',
      type: '视频算法',
      inputType: '视频',
      source: '算法训练/视频/V18',
      status: '运行中',
      image: figmaAssets.algorithmVideo,
      tags: ['视频', '区域'],
      defaultAnalysisTypeId: 'helmet-state',
      updatedAt: '2026-07-04 14:05:41',
      description: '对指定区域进行持续检测，识别人员越界和异常停留。',
      runs: 31,
    },
  ],
  datasets: [
    {
      id: 'dataset-meter-a',
      name: '表计读数-现场样本A',
      algorithmId: 'meter',
      analysisTypeId: 'meter-reading',
      uploadedAt: '2026-07-02 15:42:19',
      size: '328 MB',
      description: '包含不同角度、照度下的指针式表计样本。',
      annotated: 46,
      total: 80,
      standard: '>= 80 张',
      images: [],
      duplicateStats: { ...emptyDuplicateStats },
      qualityStatus: createNotReadyQualityStatus(),
      datasetLabelType: 'pointerMeter',
    },
    {
      id: 'dataset-helmet-a',
      name: '安全帽巡检-二期',
      algorithmId: 'helmet',
      analysisTypeId: 'helmet-state',
      uploadedAt: '2026-07-01 11:08:27',
      size: '214 MB',
      description: '覆盖厂区入口、检修平台和室内通道场景。',
      annotated: 72,
      total: 96,
      standard: '>= 60 张',
      images: [],
      duplicateStats: { ...emptyDuplicateStats },
      qualityStatus: createNotReadyQualityStatus(),
      datasetLabelType: 'status',
    },
    {
      id: 'dataset-defect-a',
      name: '设备缺陷样本集',
      algorithmId: 'sample',
      analysisTypeId: 'defect',
      uploadedAt: '2026-06-29 09:22:10',
      size: '486 MB',
      description: '锈蚀、裂纹、油污和遮挡缺陷样本。',
      annotated: 38,
      total: 120,
      standard: '>= 100 张',
      images: [],
      duplicateStats: { ...emptyDuplicateStats },
      qualityStatus: createNotReadyQualityStatus(),
      datasetLabelType: 'defect',
    },
    {
      id: 'dataset-sound-a',
      name: '电机异音录音',
      algorithmId: 'sound',
      analysisTypeId: 'sound-event',
      uploadedAt: '2026-06-25 17:30:03',
      size: '92 MB',
      description: '电机启停、空载和异常振动录音片段。',
      annotated: 24,
      total: 40,
      standard: '>= 40 段',
      images: [],
      duplicateStats: { ...emptyDuplicateStats },
      qualityStatus: createNotReadyQualityStatus(),
      datasetLabelType: 'generic',
    },
    ...additionalDemoDatasets,
  ],
  annotationImages: [
    {
      id: 'img-meter-01',
      datasetId: 'dataset-meter-a',
      name: 'meter_001.jpg',
      fileName: 'meter_001.jpg',
      captureTimePeriod: 'morning',
      image: figmaAssets.taskThumbnailDefault,
      annotated: true,
      annotations: [{ label: '表盘', bboxRatio: 22.68 }],
      boxes: [{ id: 'box-1', label: '表盘', x: 30, y: 21, w: 42, h: 54 }],
      points: [{ id: 'pt-1', label: '指针', x: 52, y: 44 }],
    },
    {
      id: 'img-meter-02',
      datasetId: 'dataset-meter-a',
      name: 'meter_002.jpg',
      fileName: 'meter_002.jpg',
      captureTimePeriod: 'afternoon',
      image: figmaAssets.taskThumbnailGauge,
      annotated: false,
      annotations: [],
      boxes: [],
      points: [],
    },
    {
      id: 'img-helmet-01',
      datasetId: 'dataset-helmet-a',
      name: 'helmet_001.jpg',
      fileName: 'helmet_001.jpg',
      captureTimePeriod: 'morning',
      image: figmaAssets.algorithmHelmet,
      annotated: true,
      annotations: [{ label: '人员', bboxRatio: 23.76 }],
      boxes: [{ id: 'box-helmet-1', label: '人员', x: 24, y: 17, w: 36, h: 66 }],
      points: [],
    },
    {
      id: 'img-helmet-02',
      datasetId: 'dataset-helmet-a',
      name: 'helmet_002.jpg',
      fileName: 'helmet_002.jpg',
      captureTimePeriod: 'afternoon',
      image: figmaAssets.algorithmHelmet,
      annotated: false,
      annotations: [],
      boxes: [],
      points: [],
    },
  ],
  trainingJobs: [
    {
      id: 'job-65',
      algorithmId: 'meter',
      datasetId: 'dataset-meter-a',
      analysisTypeId: 'meter-reading',
      version: 'V65',
      mode: '更新子类',
      typeName: '表计读数',
      status: '已部署',
      deploymentStatus: '已部署',
      finishedAt: '2026-07-06 18:20:11',
    },
    {
      id: 'job-64',
      algorithmId: 'meter',
      datasetId: 'dataset-meter-a',
      analysisTypeId: 'meter-reading',
      version: 'V64',
      mode: '更新子类',
      typeName: '表计读数',
      status: '训练成功',
      deploymentStatus: '未部署',
      finishedAt: '2026-07-04 20:14:39',
    },
    {
      id: 'job-63',
      algorithmId: 'meter',
      datasetId: 'dataset-meter-a',
      analysisTypeId: 'meter-reading',
      version: 'V63',
      mode: '更新子类',
      typeName: '表计读数',
      status: '训练成功',
      deploymentStatus: '未部署',
      finishedAt: '2026-07-03 16:41:07',
    },
  ],
  models: [
    {
      id: 'model-platen',
      name: '压板模型',
      description: '识别变电站压板投退状态，适用于常规巡视场景。',
      currentVersionId: 'version-platen-v3',
      latestVersionId: 'version-platen-v4',
      versionIds: ['version-platen-v1', 'version-platen-v2', 'version-platen-v3', 'version-platen-v4'],
      datasetLabelType: 'status',
      createdAt: '2026-06-20 09:18:32',
      updatedAt: '2026-07-16 10:24:18',
    },
    {
      id: 'model-switch',
      name: '刀闸模型',
      description: '识别刀闸分合状态及典型异常姿态。',
      currentVersionId: 'version-switch-v1',
      latestVersionId: 'version-switch-v2',
      versionIds: ['version-switch-v1', 'version-switch-v2'],
      datasetLabelType: 'status',
      createdAt: '2026-06-25 14:08:10',
      updatedAt: '2026-07-18 16:12:04',
    },
    {
      id: 'model-pointer',
      name: '指针表模型',
      description: '识别指针式仪表读数，支持表计模板验证流程。',
      currentVersionId: 'version-pointer-v2',
      latestVersionId: 'version-pointer-v2',
      versionIds: ['version-pointer-v1', 'version-pointer-v2'],
      datasetLabelType: 'pointerMeter',
      createdAt: '2026-06-28 11:30:42',
      updatedAt: '2026-07-18 16:18:27',
    },
    ...additionalDemoModels,
  ],
  modelVersions: [
    {
      id: 'version-platen-v1', modelId: 'model-platen', versionNumber: 1,
      datasetId: 'dataset-helmet-a', datasetName: '安全帽巡检-二期', datasetLabelType: 'status',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 80, batchSize: 16, imageSize: 640, earlyStop: 12 },
      trainingStatus: 'completed', releaseRole: 'historical', publishStatus: 'idle',
      createdAt: '2026-06-20 09:18:32', trainingStartedAt: '2026-06-20 09:20:05', trainingFinishedAt: '2026-06-20 11:44:16', publishedAt: '2026-06-20 12:06:35',
    },
    {
      id: 'version-platen-v2', modelId: 'model-platen', versionNumber: 2,
      datasetId: 'dataset-helmet-a', datasetName: '安全帽巡检-二期', datasetLabelType: 'status',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 100, batchSize: 16, imageSize: 640, earlyStop: 15 },
      trainingStatus: 'completed', releaseRole: 'historical', publishStatus: 'idle',
      createdAt: '2026-06-29 13:22:41', trainingStartedAt: '2026-06-29 13:24:08', trainingFinishedAt: '2026-06-29 16:03:52', publishedAt: '2026-06-29 16:31:20',
    },
    {
      id: 'version-platen-v3', modelId: 'model-platen', versionNumber: 3,
      datasetId: 'dataset-helmet-a', datasetName: '安全帽巡检-二期', datasetLabelType: 'status',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 120, batchSize: 16, imageSize: 640, earlyStop: 15 },
      trainingStatus: 'completed', releaseRole: 'current', publishStatus: 'idle',
      createdAt: '2026-07-08 08:42:33', trainingStartedAt: '2026-07-08 08:44:01', trainingFinishedAt: '2026-07-08 12:18:46', publishedAt: '2026-07-08 13:02:18',
      validationHistory: [{ id: 'validation-platen-v3', validationSetId: 'dataset-helmet-a', validationSetName: '安全帽巡检-二期', successRate: 96.5, passed: true, validatedAt: '2026-07-09 09:20:14' }],
    },
    {
      id: 'version-platen-v4', modelId: 'model-platen', versionNumber: 4,
      datasetId: 'dataset-helmet-a', datasetName: '安全帽巡检-二期', datasetLabelType: 'status',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 120, batchSize: 16, imageSize: 640, earlyStop: 15 },
      trainingStatus: 'completed', releaseRole: 'unreleased', publishStatus: 'idle',
      createdAt: '2026-07-16 07:35:21', trainingStartedAt: '2026-07-16 07:36:54', trainingFinishedAt: '2026-07-16 10:24:18',
    },
    {
      id: 'version-switch-v1', modelId: 'model-switch', versionNumber: 1,
      datasetId: 'dataset-defect-a', datasetName: '设备缺陷样本集', datasetLabelType: 'status',
      baseModel: 'generic', trainingMethod: 'fromScratch', parameters: { epochs: 150, batchSize: 8, imageSize: 640, earlyStop: 20 },
      trainingStatus: 'completed', releaseRole: 'current', publishStatus: 'idle',
      createdAt: '2026-06-25 14:08:10', trainingStartedAt: '2026-06-25 14:10:22', trainingFinishedAt: '2026-06-25 19:32:48', publishedAt: '2026-06-25 20:04:11',
    },
    {
      id: 'version-switch-v2', modelId: 'model-switch', versionNumber: 2,
      datasetId: 'dataset-defect-a', datasetName: '设备缺陷样本集', datasetLabelType: 'status',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 100, batchSize: 16, imageSize: 640, earlyStop: 15 },
      trainingStatus: 'training', releaseRole: 'unreleased', publishStatus: 'idle', progress: 68,
      createdAt: '2026-07-18 14:02:16', trainingStartedAt: '2026-07-18 14:03:10',
    },
    {
      id: 'version-pointer-v1', modelId: 'model-pointer', versionNumber: 1,
      datasetId: 'dataset-meter-a', datasetName: '表计读数-现场样本A', datasetLabelType: 'pointerMeter',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 120, batchSize: 12, imageSize: 960, earlyStop: 15 },
      trainingStatus: 'completed', releaseRole: 'historical', publishStatus: 'idle',
      createdAt: '2026-06-28 11:30:42', trainingStartedAt: '2026-06-28 11:32:03', trainingFinishedAt: '2026-06-28 15:46:20', publishedAt: '2026-06-28 16:08:52',
    },
    {
      id: 'version-pointer-v2', modelId: 'model-pointer', versionNumber: 2,
      datasetId: 'dataset-meter-a', datasetName: '表计读数-现场样本A', datasetLabelType: 'pointerMeter',
      baseModel: 'power', trainingMethod: 'fineTune', parameters: { epochs: 120, batchSize: 12, imageSize: 960, earlyStop: 15 },
      trainingStatus: 'completed', releaseRole: 'current', publishStatus: 'idle',
      createdAt: '2026-07-18 16:18:27', trainingStartedAt: '2026-07-18 16:20:03', trainingFinishedAt: '2026-07-18 19:42:16', publishedAt: '2026-07-18 20:06:44',
    },
    ...additionalDemoModelVersions,
  ],
}

function levelScore(level: QualityDimensionLevel) {
  if (level === 'excellent') return 100
  if (level === 'normal') return 60
  if (level === 'poor') return 30
  return null
}

function levelText(level: QualityDimensionLevel) {
  if (level === 'excellent') return '优秀'
  if (level === 'normal') return '一般'
  if (level === 'poor') return '待优化'
  return '未完成'
}

function makeDimension(
  key: QualityDimension['key'],
  name: string,
  level: QualityDimensionLevel,
  status: string,
  suggestion: string,
): QualityDimension {
  return {
    key,
    name,
    level,
    score: levelScore(level),
    status,
    suggestion,
  }
}

function imageAssetForDataset(dataset: DatasetItem) {
  return initialState.algorithms.find((item) => item.id === dataset.algorithmId)?.image || figmaAssets.taskThumbnailDefault
}

function annotationFromBox(box: { label: string; x?: number; y?: number; w: number; h: number }): DatasetAnnotation {
  return {
    label: box.label,
    bboxRatio: Number(((box.w * box.h) / 100).toFixed(1)),
    bbox: box.x != null && box.y != null
      ? { x: box.x, y: box.y, w: box.w, h: box.h }
      : undefined,
  }
}

function normalizeAnnotationImage(raw: Partial<AnnotationImage>, dataset: DatasetItem, index: number): AnnotationImage {
  const boxes = raw.boxes ?? []
  const annotations = boxes.length ? boxes.map(annotationFromBox) : (raw.annotations ?? [])
  return {
    id: raw.id ?? `${dataset.id}-image-${index + 1}`,
    datasetId: raw.datasetId ?? dataset.id,
    name: raw.name ?? raw.fileName ?? `sample_${index + 1}.jpg`,
    fileName: raw.fileName ?? raw.name ?? `sample_${index + 1}.jpg`,
    captureTimePeriod: normalizeCaptureTimePeriod(raw.captureTimePeriod ?? capturePeriodByIndex(index)),
    image: raw.image ?? imageAssetForDataset(dataset),
    annotated: raw.annotated ?? annotations.length > 0,
    annotations,
    boxes,
    points: raw.points ?? [],
  }
}

function createMockDatasetImages(dataset: DatasetItem): DatasetImage[] {
  const labels = initialState.analysisTypes.find((item) => item.id === dataset.analysisTypeId)?.labels ?? ['目标']
  const count = Math.max(dataset.total || 0, 1)
  return Array.from({ length: count }, (_, index) => {
    const hasAnnotation = index < dataset.annotated
    const label = labels[index % Math.max(labels.length, 1)] ?? '目标'
    return {
      id: `${dataset.id}-sample-${index + 1}`,
      fileName: `${dataset.id}_${String(index + 1).padStart(3, '0')}.jpg`,
      captureTimePeriod: capturePeriodByIndex(index),
      hasAnnotation,
      annotations: hasAnnotation ? [{ label, bboxRatio: index % 9 === 0 ? 8 : 16 }] : [],
      image: imageAssetForDataset(dataset),
    }
  })
}

function syncDatasetImagesFromAnnotationImages(state: WorkflowState, dataset: DatasetItem) {
  const annotationImages = state.annotationImages
    .filter((image) => image.datasetId === dataset.id)
    .map((image, index) => normalizeAnnotationImage(image, dataset, index))

  for (const image of annotationImages) {
    const index = state.annotationImages.findIndex((item) => item.id === image.id)
    if (index >= 0) state.annotationImages[index] = image
  }

  if (!dataset.images?.length) {
    dataset.images = createMockDatasetImages(dataset)
  }

  for (const image of annotationImages) {
    const hit = dataset.images.find((item) => item.fileName === image.fileName)
    if (hit) {
      hit.hasAnnotation = image.annotated
      hit.annotations = image.annotations
      hit.captureTimePeriod = normalizeCaptureTimePeriod(image.captureTimePeriod)
      hit.image = image.image
    } else {
      dataset.images.push({
        id: image.id,
        fileName: image.fileName,
        captureTimePeriod: normalizeCaptureTimePeriod(image.captureTimePeriod),
        hasAnnotation: image.annotated,
        annotations: image.annotations,
        image: image.image,
      })
    }
  }

  dataset.total = dataset.images.length
  dataset.annotated = dataset.images.filter((image) => image.hasAnnotation).length
}

function evaluateSampleCount(dataset: DatasetItem) {
  const count = dataset.images.length
  if (count > 100) {
    return makeDimension('sample-count', '样本数量', 'excellent', `${count} 张`, '✨ AI诊断：样本充足，可支持稳定训练。')
  }
  if (count >= 20) {
    return makeDimension('sample-count', '样本数量', 'normal', `${count} 张`, '⚠️ AI建议：样本量偏低，建议增补至 100 张以上以进一步提高识别效果。')
  }
  return makeDimension('sample-count', '样本数量', 'poor', `${count} 张`, '🛑 AI预警：样本量极低，模型无法收敛，请立即补采。')
}

function evaluateTimeDistribution(dataset: DatasetItem) {
  const count = dataset.images.length
  if (!count) {
    return makeDimension('time-distribution', '样本时间分布', 'poor', '无样本', '🛑 AI预警：时间分布失衡，请补采上午、正午、下午样本不少于 20 张。')
  }
  const morning = dataset.images.filter((image) => image.captureTimePeriod === 'morning').length
  const noon = dataset.images.filter((image) => image.captureTimePeriod === 'noon').length
  const afternoon = dataset.images.filter((image) => image.captureTimePeriod === 'afternoon').length
  const morningRatio = (morning / count) * 100
  const noonRatio = (noon / count) * 100
  const afternoonRatio = (afternoon / count) * 100
  const ratios = [
    { key: 'morning', name: '上午', count: morning, ratio: morningRatio },
    { key: 'noon', name: '正午', count: noon, ratio: noonRatio },
    { key: 'afternoon', name: '下午', count: afternoon, ratio: afternoonRatio },
  ]
  const activePeriods = ratios.filter((item) => item.count > 0)
  const lowPeriod = [...ratios].sort((left, right) => left.ratio - right.ratio)[0]
  const dominantPeriod = [...ratios].sort((left, right) => right.ratio - left.ratio)[0]
  const needCount = Math.max(1, Math.ceil(count * 0.2) - lowPeriod.count)
  const status = `上午 ${Math.round(morningRatio)}% / 正午 ${Math.round(noonRatio)}% / 下午 ${Math.round(afternoonRatio)}%`

  if (ratios.every((item) => item.count > 0 && item.ratio > 20)) {
    return makeDimension('time-distribution', '样本时间分布', 'excellent', status, '✨ AI诊断：时段分布均衡，契合多天候巡视场景。')
  }
  if (activePeriods.length === 2 && activePeriods.every((item) => item.ratio >= 30)) {
    const missingPeriod = ratios.find((item) => item.count === 0)?.name ?? lowPeriod.name
    return makeDimension('time-distribution', '样本时间分布', 'normal', status, `⚠️ AI建议：检测到时段覆盖单一，建议增补 ${missingPeriod} 样本不少于 ${Math.max(1, Math.ceil(count * 0.2))} 张。`)
  }
  if (ratios.some((item) => item.ratio < 10) || dominantPeriod.ratio > 70) {
    return makeDimension('time-distribution', '样本时间分布', 'poor', status, `🛑 AI预警：时间分布失衡，请补采 ${lowPeriod.name} 样本不少于 ${needCount} 张。`)
  }
  return makeDimension('time-distribution', '样本时间分布', 'normal', status, `⚠️ AI建议：检测到时段覆盖单一，建议增补 ${lowPeriod.name} 样本不少于 ${needCount} 张。`)
}

function evaluateLabelBalance(dataset: DatasetItem) {
  const analysisType = initialState.analysisTypes.find((item) => item.id === dataset.analysisTypeId) ?? initialState.analysisTypes[0]
  const annotations = dataset.images.flatMap((image) => image.annotations)
  if (!annotations.length) {
    return makeDimension('label-balance', '类别均衡度', 'notReady', '待评估', '⚠️ AI建议：完成标注后，AI 将评估各标签特征覆盖情况。')
  }

  const counts = new Map(analysisType.labels.map((label) => [label, 0]))
  for (const annotation of annotations) {
    counts.set(annotation.label, (counts.get(annotation.label) ?? 0) + 1)
  }
  const values = Array.from(counts.values())
  const total = annotations.length
  const minCount = Math.min(...values)
  const minRatio = total ? Math.min(...values.map((value) => (value / total) * 100)) : 0
  const minLabel = Array.from(counts.entries()).sort((left, right) => left[1] - right[1])[0]?.[0] ?? analysisType.labels[0] ?? '目标标签'

  if (analysisType.code === 'defect' || analysisType.code === 'reading' || analysisType.code === 'sound') {
    const status = `最少标签 ${minCount} 个`
    if (minCount > 20) {
      return makeDimension('label-balance', '类别均衡度', 'excellent', status, '✨ AI诊断：特征标签分布均衡。')
    }
    if (minCount < 10) {
      return makeDimension('label-balance', '类别均衡度', 'poor', status, `🛑 AI预警：${minLabel} 样本明显不足，请优先补充。`)
    }
    return makeDimension('label-balance', '类别均衡度', 'normal', status, `⚠️ AI建议：${minLabel} 数量偏低，建议增补至 20 个以上。`)
  }

  const status = `最少标签 ${minCount} 个 / ${Math.round(minRatio)}%`
  if (minCount > 20 && minRatio > 20) {
    return makeDimension('label-balance', '类别均衡度', 'excellent', status, '✨ AI诊断：特征标签分布均衡。')
  }
  if (minCount < 10 || minRatio < 10) {
    return makeDimension('label-balance', '类别均衡度', 'poor', status, `🛑 AI预警：${minLabel} 样本明显不足，请优先补充。`)
  }
  return makeDimension('label-balance', '类别均衡度', 'normal', status, `⚠️ AI建议：${minLabel} 特征权重偏低，建议增补样本使其占比升至 20%。`)
}

function evaluateDuplicateRatio(dataset: DatasetItem) {
  const count = dataset.images.length + dataset.duplicateStats.duplicateCount
  const ratio = count ? (dataset.duplicateStats.duplicateCount / count) * 100 : 0
  dataset.duplicateStats.duplicateRatio = Number((ratio / 100).toFixed(3))
  const roundedRatio = Math.round(ratio)
  const status = `AI去重 ${dataset.duplicateStats.duplicateCount} 张 / 高相似冗余 ${roundedRatio}%`
  if (ratio < 10) return makeDimension('duplicate-ratio', '样本重复度', 'excellent', status, '✨ AI诊断：重复率较低，数据质量优秀。')
  if (ratio < 20) return makeDimension('duplicate-ratio', '样本重复度', 'normal', status, `⚠️ AI建议：检测到 ${roundedRatio}% 的高相似冗余样本，建议一键AI去重。`)
  return makeDimension('duplicate-ratio', '样本重复度', 'poor', status, '🛑 AI预警：严重过拟合风险：重复样本过多，建议执行一键AI去重。')
}

function evaluateBBoxRatio(dataset: DatasetItem) {
  const bboxRatios = dataset.images.flatMap((image) => image.annotations.map((annotation) => annotation.bboxRatio))
  if (!bboxRatios.length) {
    return makeDimension('bbox-ratio', '目标画幅占比', 'notReady', '待评估', '⚠️ AI建议：完成框选标注后，AI 将评估目标像素画幅是否合理。')
  }
  const smallCount = bboxRatios.filter((ratio) => ratio < 5).length
  const smallBBoxRatio = (smallCount / bboxRatios.length) * 100
  const status = `BBox < 5%：${smallCount}/${bboxRatios.length}（${Math.round(smallBBoxRatio)}%）`
  if (smallBBoxRatio === 0) {
    return makeDimension('bbox-ratio', '目标画幅占比', 'excellent', status, '✨ AI诊断：目标像素画幅合理，特征提取完整。')
  }
  if (smallBBoxRatio < 20) {
    return makeDimension('bbox-ratio', '目标画幅占比', 'normal', status, '⚠️ AI建议：检测到部分目标像素过小（BBox < 5%），建议重新采集并适当放大目标拍摄比例。')
  }
  return makeDimension('bbox-ratio', '目标画幅占比', 'poor', status, '🛑 AI预警：目标过小（BBox < 5%），建议重新采集或调整拍摄距离。')
}

function qualityLevelByRate(rate: number, excellentThreshold: number, normalThreshold: number): QualityLevel {
  if (rate > excellentThreshold) return 'excellent'
  if (rate >= normalThreshold) return 'normal'
  return 'poor'
}

function annotationOverlapRatio(
  left: NonNullable<DatasetAnnotation['bbox']>,
  right: NonNullable<DatasetAnnotation['bbox']>,
) {
  const overlapWidth = Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x))
  const overlapHeight = Math.max(0, Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y))
  const overlapArea = overlapWidth * overlapHeight
  const minimumArea = Math.min(left.w * left.h, right.w * right.h)
  return minimumArea > 0 ? overlapArea / minimumArea : 0
}

function countIrregularAnnotations(dataset: DatasetItem) {
  const analysisType = initialState.analysisTypes.find((item) => item.id === dataset.analysisTypeId)
  const invalidIds = new Set<string>()
  const normalWords = ['正常', '开启', '佩戴', '通过']
  const abnormalWords = ['异常', '关闭', '未佩戴', '缺陷', '裂纹', '锈蚀']

  dataset.images.forEach((image) => {
    image.annotations.forEach((annotation, index) => {
      const bbox = annotation.bbox
      if (!bbox) return
      const annotationId = `${image.id}-${index}`
      if (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.w > 100 || bbox.y + bbox.h > 100) {
        invalidIds.add(annotationId)
      }

      image.annotations.slice(index + 1).forEach((nextAnnotation, offset) => {
        if (!nextAnnotation.bbox) return
        const overlapRatio = annotationOverlapRatio(bbox, nextAnnotation.bbox)
        const nextId = `${image.id}-${index + offset + 1}`
        if (analysisType?.code !== 'reading' && overlapRatio > 0.95) {
          invalidIds.add(annotationId)
          invalidIds.add(nextId)
        }
        const labels = `${annotation.label} ${nextAnnotation.label}`
        const hasConflict = normalWords.some((word) => labels.includes(word))
          && abnormalWords.some((word) => labels.includes(word))
        if (overlapRatio > 0.65 && hasConflict) {
          invalidIds.add(annotationId)
          invalidIds.add(nextId)
        }
      })
    })
  })

  return invalidIds.size
}

function evaluateAnnotationQuality(dataset: DatasetItem): QualityDimension {
  const totalImages = dataset.images.length
  const annotatedImages = dataset.images.filter((image) => image.hasAnnotation).length
  const annotations = dataset.images.flatMap((image) => image.annotations)
  if (!annotatedImages || !annotations.length) {
    return makeDimension('annotation-quality', '标注质量', 'notReady', '待评估', '⚠️ AI建议：开始标注后，AI 将评估标注完整性和规范性。')
  }

  const completenessRate = totalImages ? (annotatedImages / totalImages) * 100 : 0
  const irregularCount = countIrregularAnnotations(dataset)
  const standardRate = annotations.length ? ((annotations.length - irregularCount) / annotations.length) * 100 : 0
  const completenessLevel = qualityLevelByRate(completenessRate, 90, 70)
  const standardizationLevel = qualityLevelByRate(standardRate, 95, 90)
  const levelOrder: Record<QualityDimensionLevel, number> = { excellent: 3, normal: 2, poor: 1, notReady: 0 }
  const level = levelOrder[completenessLevel] <= levelOrder[standardizationLevel]
    ? completenessLevel
    : standardizationLevel
  const unannotatedCount = Math.max(0, totalImages - annotatedImages)
  const subMetrics: QualitySubMetric[] = [
    {
      key: 'completeness',
      name: '标注完整性',
      rate: Number(completenessRate.toFixed(1)),
      score: levelScore(completenessLevel),
      level: completenessLevel,
      status: `已标注 ${annotatedImages}/${totalImages}，未标注 ${unannotatedCount} 张`,
      suggestion: completenessLevel === 'excellent'
        ? '✨ AI诊断：标注覆盖完整。'
        : '⚠️ AI建议：请继续补充未标注图片，完整率建议提升至 90% 以上。',
    },
    {
      key: 'standardization',
      name: '标注规范性',
      rate: Number(standardRate.toFixed(1)),
      score: levelScore(standardizationLevel),
      level: standardizationLevel,
      status: `规范率 ${standardRate.toFixed(1)}%，不规范标注 ${irregularCount} 个`,
      suggestion: standardizationLevel === 'excellent'
        ? '✨ AI诊断：标注边界、重叠和标签关系均符合规范。'
        : '⚠️ AI建议：请核验越界、重复框及冲突标签。',
    },
  ]
  const dimension = makeDimension(
    'annotation-quality',
    '标注质量',
    level,
    `完整性 ${completenessRate.toFixed(1)}% / 规范性 ${standardRate.toFixed(1)}%`,
    level === 'excellent'
      ? '✨ AI诊断：标注完整且规范，可支持稳定训练。'
      : level === 'normal'
        ? '⚠️ AI建议：标注质量存在待优化项，建议按子指标完成核验。'
        : '🛑 AI预警：标注完整性或规范性较低，建议完成修正后训练。',
  )
  dimension.score = Math.min(levelScore(completenessLevel) ?? 0, levelScore(standardizationLevel) ?? 0)
  dimension.subMetrics = subMetrics
  return dimension
}

export function evaluateDatasetQuality(dataset: DatasetItem): DatasetQualityStatus {
  const startedAt = Date.now()
  const dimensions = [
    evaluateSampleCount(dataset),
    evaluateTimeDistribution(dataset),
    evaluateDuplicateRatio(dataset),
    evaluateLabelBalance(dataset),
    evaluateBBoxRatio(dataset),
    evaluateAnnotationQuality(dataset),
  ]
  const hasNotReady = dimensions.some((item) => item.level === 'notReady')
  const hasPoor = dimensions.some((item) => item.level === 'poor')
  const allExcellent = dimensions.every((item) => item.level === 'excellent')
  const overallLevel: OverallQualityLevel = hasNotReady ? 'notReady' : hasPoor ? 'poor' : allExcellent ? 'excellent' : 'normal'
  const issueCount = dimensions.filter((item) => item.level !== 'excellent').length
  const summary =
    overallLevel === 'excellent'
      ? '优秀'
      : overallLevel === 'normal'
        ? '一般'
        : overallLevel === 'poor'
          ? '待优化'
          : '待评估'
  return {
    overallLevel,
    dimensions,
    issueCount,
    summary,
    diagnosisDurationMs: Date.now() - startedAt,
    performanceTargetMs: 5000,
  }
}

function inferDatasetLabelType(dataset: Pick<DatasetItem, 'analysisTypeId'>): DatasetLabelType {
  if (dataset.analysisTypeId === 'meter-reading') return 'pointerMeter'
  if (dataset.analysisTypeId === 'helmet-state') return 'status'
  if (dataset.analysisTypeId === 'defect') return 'defect'
  return 'generic'
}

function normalizeDataset(dataset: Partial<DatasetItem>, fallback: DatasetItem): DatasetItem {
  const duplicateFiles = dataset.duplicateStats?.duplicateFiles ?? []
  return {
    ...fallback,
    ...dataset,
    images: Array.isArray(dataset.images)
      ? dataset.images.map((image) => ({
          ...image,
          captureTimePeriod: normalizeCaptureTimePeriod(image.captureTimePeriod),
        }))
      : [],
    duplicateStats: {
      ...emptyDuplicateStats,
      ...(dataset.duplicateStats ?? {}),
      duplicateFiles,
      duplicateSamples:
        dataset.duplicateStats?.duplicateSamples ??
        duplicateFiles.map((fileName) => ({ fileName, similarityScore: 0.98 })),
    },
    qualityStatus: dataset.qualityStatus ?? createNotReadyQualityStatus(),
    datasetLabelType: dataset.datasetLabelType ?? fallback.datasetLabelType ?? inferDatasetLabelType(fallback),
  }
}

function normalizeState(state: WorkflowState): WorkflowState {
  state.trainingJobs = Array.isArray(state.trainingJobs) ? state.trainingJobs : structuredClone(initialState.trainingJobs)
  state.models = Array.isArray(state.models) ? state.models : structuredClone(initialState.models)
  state.modelVersions = Array.isArray(state.modelVersions) ? state.modelVersions : structuredClone(initialState.modelVersions)

  const initialVersionMap = new Map(initialState.modelVersions.map((version) => [version.id, version]))
  state.modelVersions = state.modelVersions.map((version) => {
    const fallback = initialVersionMap.get(version.id)
    return {
      ...fallback,
      ...version,
      validationHistory: Array.isArray(version.validationHistory)
        ? version.validationHistory
        : structuredClone(fallback?.validationHistory ?? []),
      publishStatus: version.publishStatus === 'publishing' ? 'idle' : version.publishStatus,
    }
  })

  // Lightweight adapter for the Stage 2 pointer-meter seed kept in sessionStorage.
  const pointerV1 = state.modelVersions.find((version) => version.id === 'version-pointer-v1')
  const pointerV2 = state.modelVersions.find((version) => version.id === 'version-pointer-v2')
  if (pointerV1?.releaseRole === 'current' && pointerV2?.trainingStatus === 'queued') {
    Object.assign(pointerV1, initialVersionMap.get(pointerV1.id))
    Object.assign(pointerV2, initialVersionMap.get(pointerV2.id))
  }

  const legacyTrainingIds = new Set(['job-65', 'job-18', 'job-12'])
  const hasLegacyTrainingMock = ['job-65', 'job-18', 'job-12']
    .every((id) => state.trainingJobs.some((job) => job.id === id))
  if (hasLegacyTrainingMock) {
    const userCreatedJobs = state.trainingJobs.filter((job) => !legacyTrainingIds.has(job.id))
    state.trainingJobs = [...userCreatedJobs, ...structuredClone(initialState.trainingJobs)]
  }

  const deployedAlgorithms = new Set<string>()
  state.trainingJobs.forEach((job) => {
    if (job.status !== '已部署') return
    if (deployedAlgorithms.has(job.algorithmId)) {
      job.status = '训练成功'
      job.deploymentStatus = '未部署'
      return
    }
    deployedAlgorithms.add(job.algorithmId)
    job.deploymentStatus = '已部署'
  })

  state.datasets = state.datasets.map((dataset, index) => normalizeDataset(dataset, initialState.datasets[index] ?? dataset))
  const versionIds = new Set(state.modelVersions.map((version) => version.id))
  const initialModelMap = new Map(initialState.models.map((model) => [model.id, model]))
  state.models = state.models.map((model) => ({
    ...initialModelMap.get(model.id),
    ...model,
    description: model.description ?? initialModelMap.get(model.id)?.description ?? '',
    versionIds: Array.isArray(model.versionIds)
      ? model.versionIds.filter((versionId) => versionIds.has(versionId))
      : state.modelVersions.filter((version) => version.modelId === model.id).map((version) => version.id),
  }))
  state.models.forEach((model) => {
    const versions = state.modelVersions.filter((version) => version.modelId === model.id)
    const currentVersions = versions.filter((version) => version.releaseRole === 'current')
    const preferredCurrent = currentVersions.find((version) => version.id === model.currentVersionId) ?? currentVersions[0]
    currentVersions.forEach((version) => {
      if (version !== preferredCurrent) version.releaseRole = 'historical'
    })
    model.currentVersionId = preferredCurrent?.id
  })
  for (const dataset of state.datasets) {
    syncDatasetImagesFromAnnotationImages(state, dataset)
    dataset.qualityStatus = evaluateDatasetQuality(dataset)
  }
  return state
}

function loadState(): WorkflowState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return normalizeState(structuredClone(initialState))
    return normalizeState({ ...structuredClone(initialState), ...JSON.parse(raw) })
  } catch {
    return normalizeState(structuredClone(initialState))
  }
}

export const workflowState = reactive<WorkflowState>(loadState())

watch(
  workflowState,
  (state) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  },
  { deep: true },
)

export const workflowGetters = {
  analysisTypeMap: computed(() => new Map(workflowState.analysisTypes.map((item) => [item.id, item]))),
  algorithmMap: computed(() => new Map(workflowState.algorithms.map((item) => [item.id, item]))),
  datasetMap: computed(() => new Map(workflowState.datasets.map((item) => [item.id, item]))),
  modelMap: computed(() => new Map(workflowState.models.map((item) => [item.id, item]))),
  modelVersionMap: computed(() => new Map(workflowState.modelVersions.map((item) => [item.id, item]))),
}

export function getAnalysisType(id: string) {
  return workflowGetters.analysisTypeMap.value.get(id) ?? workflowState.analysisTypes[0]
}

export function getAlgorithm(id: string) {
  return workflowGetters.algorithmMap.value.get(id) ?? workflowState.algorithms[0]
}

export function getDataset(id: string) {
  return workflowGetters.datasetMap.value.get(id) ?? workflowState.datasets[0]
}

export function updateDatasetProfile(
  datasetId: string,
  payload: Pick<DatasetItem, 'name' | 'description'>,
) {
  const dataset = workflowState.datasets.find((item) => item.id === datasetId)
  if (!dataset) throw new Error('数据集不存在')
  const name = payload.name.trim()
  if (!name) throw new Error('请输入数据集名称')
  const duplicated = workflowState.datasets.some((item) => item.id !== datasetId && item.name === name)
  if (duplicated) throw new Error('数据集名称已存在')
  dataset.name = name
  dataset.description = payload.description.trim()
  return dataset
}

export function deleteDataset(datasetId: string) {
  const datasetIndex = workflowState.datasets.findIndex((item) => item.id === datasetId)
  if (datasetIndex < 0) throw new Error('数据集不存在')
  workflowState.datasets.splice(datasetIndex, 1)
  workflowState.annotationImages = workflowState.annotationImages.filter((image) => image.datasetId !== datasetId)
}

export function getModel(id: string) {
  return workflowGetters.modelMap.value.get(id)
}

export function getModelVersion(id: string) {
  return workflowGetters.modelVersionMap.value.get(id)
}

export function getModelVersions(modelId: string) {
  return workflowState.modelVersions
    .filter((version) => version.modelId === modelId)
    .sort((left, right) => right.versionNumber - left.versionNumber)
}

export function hasActiveModelTraining() {
  return workflowState.modelVersions.some((version) => version.trainingStatus === 'training')
}

export function updateModelProfile(
  modelId: string,
  payload: Pick<ModelItem, 'name' | 'description'>,
) {
  const model = getModel(modelId)
  if (!model) throw new Error('模型不存在')
  const name = payload.name.trim()
  if (!name) throw new Error('请输入模型名称')
  const duplicated = workflowState.models.some((item) => item.id !== modelId && item.name === name)
  if (duplicated) throw new Error('模型名称已存在')
  model.name = name
  model.description = payload.description?.trim() ?? ''
  model.updatedAt = nowText()
  return model
}

export function deleteModel(modelId: string) {
  const modelIndex = workflowState.models.findIndex((model) => model.id === modelId)
  if (modelIndex < 0) throw new Error('模型不存在')
  const hasActiveVersion = workflowState.modelVersions.some(
    (version) => version.modelId === modelId
      && (version.trainingStatus === 'training' || version.trainingStatus === 'queued'),
  )
  if (hasActiveVersion) throw new Error('模型存在进行中或排队中的训练，暂不可删除')
  workflowState.modelVersions = workflowState.modelVersions.filter((version) => version.modelId !== modelId)
  workflowState.models.splice(modelIndex, 1)
}

export function getLatestModelValidation(version?: ModelVersion) {
  return version?.validationHistory?.at(-1)
}

export function canPublishModelVersion(version?: ModelVersion) {
  return Boolean(
    version
    && version.trainingStatus === 'completed'
    && version.releaseRole !== 'current'
    && version.publishStatus !== 'publishing',
  )
}

export function canValidateModelVersion(version?: ModelVersion) {
  return Boolean(
    version
    && version.trainingStatus === 'completed'
    && (version.releaseRole === 'current' || version.releaseRole === 'historical'),
  )
}

function syncPublishedVersionToLegacyAlgorithm(version: ModelVersion) {
  const dataset = workflowState.datasets.find((item) => item.id === version.datasetId)
  const algorithm = dataset
    ? workflowState.algorithms.find((item) => item.id === dataset.algorithmId)
    : undefined
  if (!algorithm) return
  algorithm.version = `V${version.versionNumber}`
  algorithm.updatedAt = nowText()
}

export async function publishModelVersion(versionId: string) {
  const version = getModelVersion(versionId)
  const model = version ? getModel(version.modelId) : undefined
  if (!version || !model) throw new Error('模型版本不存在')
  if (!canPublishModelVersion(version)) throw new Error('当前版本不可发布')

  version.publishStatus = 'publishing'
  await new Promise((resolve) => setTimeout(resolve, 900))

  workflowState.modelVersions.forEach((item) => {
    if (item.modelId === model.id && item.releaseRole === 'current' && item.id !== version.id) {
      item.releaseRole = 'unreleased'
      item.publishedAt = undefined
    }
  })
  version.releaseRole = 'current'
  version.publishStatus = 'idle'
  version.publishedAt = nowText()
  model.currentVersionId = version.id
  model.updatedAt = version.publishedAt
  syncPublishedVersionToLegacyAlgorithm(version)
  return version
}

export function recordModelValidation(
  versionId: string,
  payload: Omit<ModelValidationResult, 'id' | 'validatedAt'>,
) {
  const version = getModelVersion(versionId)
  if (!version || !canValidateModelVersion(version)) throw new Error('当前版本不可验证')
  const result: ModelValidationResult = {
    ...payload,
    id: `validation-${versionId}-${Date.now()}`,
    validatedAt: nowText(),
  }
  version.validationHistory ??= []
  version.validationHistory.push(result)
  return result
}

export function suggestModelName(datasetId: string) {
  const dataset = workflowState.datasets.find((item) => item.id === datasetId)
  if (!dataset) return ''
  const labelType = dataset.datasetLabelType ?? inferDatasetLabelType(dataset)
  const suggestions: Record<DatasetLabelType, string> = {
    pointerMeter: '指针表模型',
    digitalMeter: '数字表模型',
    status: dataset.name.includes('安全帽') ? '安全帽状态模型' : '设备状态模型',
    defect: '设备缺陷模型',
    generic: `${dataset.name}模型`,
  }
  return suggestions[labelType]
}

export function getNextModelVersionNumber(modelId?: string, modelName?: string) {
  const model = modelId
    ? getModel(modelId)
    : workflowState.models.find((item) => item.name === modelName?.trim())
  if (!model) return 1
  return Math.max(0, ...getModelVersions(model.id).map((version) => version.versionNumber)) + 1
}

export type ModelTrainingPayload = {
  modelId?: string
  modelName: string
  datasetId: string
  baseModel: BaseModelType
  parameters: ModelParameters
}

export function createModelTraining(payload: ModelTrainingPayload) {
  if (hasActiveModelTraining()) {
    throw new Error('当前已有模型正在训练，完成后才能发起新训练')
  }
  const dataset = workflowState.datasets.find((item) => item.id === payload.datasetId)
  if (!dataset) throw new Error('训练数据集不存在')

  const normalizedName = payload.modelName.trim()
  let model = payload.modelId
    ? getModel(payload.modelId)
    : workflowState.models.find((item) => item.name === normalizedName)

  const createdAt = nowText()
  if (!model) {
    model = {
      id: `model-${Date.now()}`,
      name: normalizedName,
      description: `${dataset.name}训练模型`,
      versionIds: [],
      datasetLabelType: dataset.datasetLabelType ?? inferDatasetLabelType(dataset),
      createdAt,
      updatedAt: createdAt,
    }
    workflowState.models.unshift(model)
  }

  const versionNumber = getNextModelVersionNumber(model.id)
  const runningCount = workflowState.modelVersions.filter((version) => version.trainingStatus === 'training').length
  const queued = runningCount >= trainingSchedulerConfig.concurrencyLimit
  const queuePosition = queued
    ? workflowState.modelVersions.filter((version) => version.trainingStatus === 'queued').length + 1
    : undefined
  const version: ModelVersion = {
    id: `version-${model.id}-${Date.now()}`,
    modelId: model.id,
    versionNumber,
    datasetId: dataset.id,
    datasetName: dataset.name,
    datasetLabelType: dataset.datasetLabelType ?? inferDatasetLabelType(dataset),
    baseModel: payload.baseModel,
    trainingMethod: payload.baseModel === 'power' ? 'fineTune' : 'fromScratch',
    parameters: { ...payload.parameters },
    trainingStatus: queued ? 'queued' : 'training',
    releaseRole: 'unreleased',
    publishStatus: 'idle',
    progress: queued ? undefined : 0,
    queuePosition,
    createdAt,
    trainingStartedAt: queued ? undefined : createdAt,
  }

  workflowState.modelVersions.unshift(version)
  model.latestVersionId = version.id
  model.versionIds.push(version.id)
  model.datasetLabelType = version.datasetLabelType
  model.updatedAt = createdAt
  if (version.trainingStatus === 'training') scheduleModelTrainingCompletion(version)
  return { model, version, queued }
}

function scheduleModelTrainingCompletion(version: ModelVersion) {
  if (typeof window === 'undefined' || version.trainingStatus !== 'training' || modelTrainingTimers.has(version.id)) return

  const duration = 10_000
  const startedAt = Date.now()
  const initialProgress = Math.min(version.progress ?? 0, 95)
  const progress = window.setInterval(() => {
    if (version.trainingStatus !== 'training') return
    const ratio = Math.min((Date.now() - startedAt) / duration, 1)
    version.progress = Math.min(99, Math.round(initialProgress + (100 - initialProgress) * ratio))
  }, 500)
  const completion = window.setTimeout(() => {
    window.clearInterval(progress)
    modelTrainingTimers.delete(version.id)
    if (version.trainingStatus !== 'training') return

    version.trainingStatus = 'completed'
    version.progress = 100
    version.trainingFinishedAt = nowText()
    const model = getModel(version.modelId)
    if (model) model.updatedAt = version.trainingFinishedAt

    const next = workflowState.modelVersions
      .filter((item) => item.trainingStatus === 'queued')
      .sort((left, right) => (left.queuePosition ?? 0) - (right.queuePosition ?? 0))[0]
    if (!next) return
    next.trainingStatus = 'training'
    next.trainingStartedAt = nowText()
    next.progress = 0
    next.queuePosition = undefined
    workflowState.modelVersions
      .filter((item) => item.trainingStatus === 'queued' && item.queuePosition)
      .forEach((item) => { item.queuePosition = Math.max(1, (item.queuePosition ?? 1) - 1) })
    scheduleModelTrainingCompletion(next)
  }, duration)
  modelTrainingTimers.set(version.id, { progress, completion })
}

function scheduleActiveModelTrainings() {
  workflowState.modelVersions
    .filter((version) => version.trainingStatus === 'training')
    .forEach(scheduleModelTrainingCompletion)
}

scheduleActiveModelTrainings()

export function refreshDatasetQuality(datasetId: string) {
  const dataset = getDataset(datasetId)
  dataset.total = dataset.images.length
  dataset.annotated = dataset.images.filter((image) => image.hasAnnotation).length
  dataset.qualityStatus = evaluateDatasetQuality(dataset)
  return dataset.qualityStatus
}

export function deduplicateDatasetImages(datasetId: string) {
  const dataset = getDataset(datasetId)
  dataset.duplicateStats = {
    duplicateCount: 0,
    duplicateRatio: 0,
    duplicateFiles: [],
    duplicateSamples: [],
  }
  refreshDatasetQuality(datasetId)
  return dataset
}

export function getDatasetImages(datasetId: string) {
  const existing = workflowState.annotationImages.filter((image) => image.datasetId === datasetId)
  if (existing.length) return existing
  const dataset = getDataset(datasetId)
  const algorithm = getAlgorithm(dataset.algorithmId)
  return [
    {
      id: `${datasetId}-mock-1`,
      datasetId,
      name: 'sample_001.jpg',
      fileName: 'sample_001.jpg',
      captureTimePeriod: 'morning',
      image: algorithm.image,
      annotated: false,
      annotations: [],
      boxes: [],
      points: [],
    },
  ]
}

export type UploadFileInput = {
  fileName: string
  image?: string
  captureTimePeriod?: CaptureTimePeriod
}

export type DatasetUploadPayload = {
  datasetId?: string
  name?: string
  algorithmId: string
  analysisTypeId: string
  description?: string
  files: UploadFileInput[]
  duplicatePolicy?: 'remove' | 'keep'
}

export type DatasetUploadResult = {
  dataset: DatasetItem
  acceptedFiles: string[]
  duplicateFiles: string[]
  duplicatePolicy: 'remove' | 'keep'
  created: boolean
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
}

function createDatasetFromUpload(payload: DatasetUploadPayload): DatasetItem {
  const dataset: DatasetItem = {
    id: `dataset-${Date.now()}`,
    name: payload.name?.trim() || `新建数据集-${workflowState.datasets.length + 1}`,
    algorithmId: payload.algorithmId,
    analysisTypeId: payload.analysisTypeId,
    uploadedAt: nowText(),
    size: 'Mock 上传',
    description: payload.description || '通过样本上传去重流程创建。',
    annotated: 0,
    total: 0,
    standard: '>= 80 张',
    images: [],
    duplicateStats: { ...emptyDuplicateStats },
    qualityStatus: createNotReadyQualityStatus(),
  }
  workflowState.datasets.unshift(dataset)
  return dataset
}

export function uploadDatasetImages(payload: DatasetUploadPayload): DatasetUploadResult {
  const dataset = payload.datasetId ? getDataset(payload.datasetId) : createDatasetFromUpload(payload)
  const created = !payload.datasetId
  const duplicatePolicy = payload.duplicatePolicy ?? 'remove'
  const existingNames = new Set(dataset.images.map((image) => image.fileName.trim().toLowerCase()))
  const acceptedFiles: string[] = []
  const duplicateFiles: string[] = []
  const duplicateSamples: DuplicateSample[] = []
  const algorithm = getAlgorithm(dataset.algorithmId)

  payload.files.forEach((file, index) => {
    const fileName = file.fileName.trim()
    if (!fileName) return
    const key = fileName.toLowerCase()
    if (existingNames.has(key)) {
      duplicateFiles.push(fileName)
      duplicateSamples.push({ fileName, similarityScore: 0.98 })
      if (duplicatePolicy === 'remove') return
    }
    existingNames.add(key)
    acceptedFiles.push(fileName)
    const imageId = `${dataset.id}-upload-${Date.now()}-${index}`
    const captureTimePeriod = normalizeCaptureTimePeriod(file.captureTimePeriod ?? capturePeriodByIndex(index))
    const image = file.image ?? algorithm.image
    dataset.images.push({
      id: imageId,
      fileName,
      captureTimePeriod,
      hasAnnotation: false,
      annotations: [],
      image,
    })
    workflowState.annotationImages.push({
      id: imageId,
      datasetId: dataset.id,
      name: fileName,
      fileName,
      captureTimePeriod,
      image,
      annotated: false,
      annotations: [],
      boxes: [],
      points: [],
    })
  })

  dataset.duplicateStats.duplicateCount += duplicateFiles.length
  dataset.duplicateStats.duplicateFiles = [...dataset.duplicateStats.duplicateFiles, ...duplicateFiles]
  dataset.duplicateStats.duplicateSamples = [...dataset.duplicateStats.duplicateSamples, ...duplicateSamples]
  dataset.uploadedAt = nowText()
  refreshDatasetQuality(dataset.id)
  return { dataset, acceptedFiles, duplicateFiles, duplicatePolicy, created }
}

export function runAlgorithm(algorithmId: string, analysisTypeId?: string) {
  const algorithm = getAlgorithm(algorithmId)
  const analysisType = getAnalysisType(analysisTypeId ?? algorithm.defaultAnalysisTypeId)
  algorithm.runs += 1
  algorithm.status = '运行中'
  return {
    title: `${analysisType.name}检测`,
    time: new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'),
  }
}

export function saveAnnotation(datasetId: string, imageId: string) {
  const image = workflowState.annotationImages.find((item) => item.id === imageId)
  const dataset = getDataset(datasetId)
  if (image) {
    const wasAnnotated = image.annotated
    image.annotations = image.boxes.map(annotationFromBox)
    image.annotated = image.annotations.length > 0 || image.points.length > 0
    const datasetImage = dataset.images.find((item) => item.id === image.id || item.fileName === image.fileName)
    if (datasetImage) {
      datasetImage.hasAnnotation = image.annotated
      datasetImage.annotations = image.annotations
      datasetImage.captureTimePeriod = image.captureTimePeriod
      datasetImage.image = image.image
    }
    if (!wasAnnotated && image.annotated) {
      dataset.annotated = Math.min(dataset.total, dataset.annotated + 1)
    }
  }
  refreshDatasetQuality(datasetId)
  return dataset
}

export type TrainingPayload = {
  algorithmId: string
  datasetId: string
  analysisTypeId: string
  mode: TrainingJob['mode']
  typeName: string
}

export function createTraining(payload: TrainingPayload) {
  const algorithm = getAlgorithm(payload.algorithmId)
  const nextVersion = `V${Number.parseInt(algorithm.version.replace(/\D/g, ''), 10) + 1 || workflowState.trainingJobs.length + 1}`
  const job: TrainingJob = {
    id: `job-${Date.now()}`,
    ...payload,
    version: nextVersion,
    status: '训练中',
    deploymentStatus: '未部署',
    finishedAt: '--',
  }
  workflowState.trainingJobs.unshift(job)
  window.setTimeout(() => {
    const storedJob = workflowState.trainingJobs.find((item) => item.id === job.id)
    if (!storedJob || storedJob.status !== '训练中') return
    storedJob.status = '训练成功'
    storedJob.finishedAt = new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
  }, 800)
  return job
}

export function deployTraining(jobId: string) {
  const job = workflowState.trainingJobs.find((item) => item.id === jobId)
  if (!job) return
  workflowState.trainingJobs.forEach((item) => {
    if (item.id === job.id || item.algorithmId !== job.algorithmId || item.status !== '已部署') return
    item.status = '训练成功'
    item.deploymentStatus = '未部署'
  })
  job.status = '已部署'
  job.deploymentStatus = '已部署'
  const algorithm = getAlgorithm(job.algorithmId)
  algorithm.version = job.version
  algorithm.status = '运行中'
  algorithm.defaultAnalysisTypeId = job.analysisTypeId
  algorithm.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
}
