<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  IconArrowLeft,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardCheck,
  IconCircleCheck,
  IconCircleX,
  IconCloudUpload,
  IconFilePlus,
  IconGauge,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconX,
} from '@tabler/icons-vue'
import { figmaAssets } from '@/assets/figma'
import DwAppShell from '@/components/DwAppShell.vue'
import ProblemDiagnosisDialog from '@/components/ProblemDiagnosisDialog.vue'
import {
  getMeterConfigurationContext,
  getMeterConfigurationReturnQuery,
} from '@/router/meterConfigurationContext'
import {
  applyDiagnosisMockAction,
  buildAbnormalDiagnosisReport,
  type DiagnosisIssue,
  type DiagnosisReport,
} from '@/state/preflightChecks'
import {
  meterTemplateOptions,
  findMeterTemplateById,
  findMeterTemplateByName,
} from '@/state/meterTemplates'
import {
  validationDatasetOptions,
  findValidationDatasetById,
  findValidationDatasetByName,
  registerValidationDataset,
} from '@/state/validationDatasets'

/**
 * 表计模板 & 验证管理
 * - 数据层仍为 ability + modelVersion（与表格、Drawer、搜索一致）
 * - 新建 Step 3：交互为先选算法再选分析类型；提交时将二者写入 modelVersion（「基准版本 · 分析类型」）
 */

type AlgoAbility = 'pressure' | 'water' | 'electric'

const algoAbilityLabel: Record<AlgoAbility, string> = {
  pressure: '压力表',
  water: '水表',
  electric: '电表',
}

/** 仅用于 Step 3 表单 */
type AlgorithmKey =
  | 'meter_pressure_v14'
  | 'meter_water_v09'
  | 'meter_electric_v11'
  | 'pointer_scale_universal'

const algorithmLabels: Record<AlgorithmKey, string> = {
  meter_pressure_v14: '压力表识别算法 V1.4',
  meter_water_v09: '水表识别算法 V0.9',
  meter_electric_v11: '电表识别算法 V1.1',
  pointer_scale_universal: '指针式仪表通用算法',
}

type AnalysisTypeKey = 'reading_precision' | 'roi_quality' | 'full_chain_audit'

const analysisTypeLabels: Record<AnalysisTypeKey, string> = {
  reading_precision: '读数精度分析',
  roi_quality: '表盘区域质量分析',
  full_chain_audit: '全链路合规评测',
}

const analysisTypesByAlgorithm: Record<AlgorithmKey, AnalysisTypeKey[]> = {
  meter_pressure_v14: ['reading_precision', 'full_chain_audit'],
  meter_water_v09: ['reading_precision', 'roi_quality'],
  meter_electric_v11: ['reading_precision', 'full_chain_audit'],
  pointer_scale_universal: ['roi_quality', 'full_chain_audit'],
}

/** 与各算法对应的基准模型版本串（写入 modelVersion 前半段） */
const algorithmDefaultVersion: Record<AlgorithmKey, string> = {
  meter_pressure_v14: 'meter-pressure-v1.4.0',
  meter_water_v09: 'meter-water-v0.9.2',
  meter_electric_v11: 'meter-electric-v1.1.0',
  pointer_scale_universal: 'meter-pressure-v1.3.2',
}

const defaultAlgorithmByAbility: Record<AlgoAbility, AlgorithmKey> = {
  pressure: 'meter_pressure_v14',
  water: 'meter_water_v09',
  electric: 'meter_electric_v11',
}

function abilityFromAlgorithm(a: AlgorithmKey): AlgoAbility {
  if (a.startsWith('meter_water')) return 'water'
  if (a.startsWith('meter_electric')) return 'electric'
  return 'pressure'
}

function parseStep3FromModelVersion(
  abilityHint: AlgoAbility,
  raw: string,
): { algorithm: AlgorithmKey; analysisType: AnalysisTypeKey } {
  const sep = ' · '
  const idx = raw.indexOf(sep)
  const base = (idx === -1 ? raw : raw.slice(0, idx)).trim()
  const analysisLabel = idx === -1 ? '' : raw.slice(idx + sep.length).trim()

  const byVersion = (
    Object.entries(algorithmDefaultVersion) as [AlgorithmKey, string][]
  ).find(([, v]) => v === base)
  let algorithm = byVersion?.[0]
  if (!algorithm) {
    if (base.includes('meter-water')) algorithm = 'meter_water_v09'
    else if (base.includes('meter-electric')) algorithm = 'meter_electric_v11'
    else if (base.includes('meter-pressure')) algorithm = 'meter_pressure_v14'
    else algorithm = defaultAlgorithmByAbility[abilityHint]
  }

  const allowed = analysisTypesByAlgorithm[algorithm]
  let analysisType = allowed[0]!
  if (analysisLabel) {
    const hit = (
      Object.entries(analysisTypeLabels) as [AnalysisTypeKey, string][]
    ).find(([, label]) => label === analysisLabel)
    if (hit && allowed.includes(hit[0])) analysisType = hit[0]
  }
  return { algorithm, analysisType }
}

function composeModelVersion(algorithm: AlgorithmKey, analysisType: AnalysisTypeKey) {
  return `${algorithmDefaultVersion[algorithm]} · ${analysisTypeLabels[analysisType]}`
}

type ValidationStatus = 'success' | 'fail' | 'running' | 'pending'

interface ValidationConfig {
  id: string
  templateName: string
  datasetName: string
  ability: AlgoAbility
  modelVersion: string
  lastRunAt: string
  status: ValidationStatus
  successRate: number
  passed: number
  failed: number
}

const router = useRouter()
const route = useRoute()

const search = ref('')
const validationDiagnosisOpen = ref(false)
const validationDiagnosisReport = ref<DiagnosisReport | null>(null)
const validationDiagnosisRow = ref<ValidationConfig | null>(null)
const validationTimers = new Set<number>()

const configs = reactive<ValidationConfig[]>([
  {
    id: 'cfg-001',
    templateName: '压力表-110kV变电站',
    datasetName: '110kV-压力表验证集-V3',
    ability: 'pressure',
    modelVersion: 'meter-pressure-v1.4.0',
    lastRunAt: '2025-03-12 10:24:11',
    status: 'success',
    successRate: 0.926,
    passed: 463,
    failed: 37,
  },
  {
    id: 'cfg-002',
    templateName: '水表-工业园区A',
    datasetName: '园区A-水表-2025Q1',
    ability: 'water',
    modelVersion: 'meter-water-v0.9.2',
    lastRunAt: '2025-03-11 19:08:46',
    status: 'fail',
    successRate: 0.681,
    passed: 204,
    failed: 96,
  },
  {
    id: 'cfg-003',
    templateName: '电表-居民配电',
    datasetName: '居民-电表样本集-200',
    ability: 'electric',
    modelVersion: 'meter-electric-v1.1.0',
    lastRunAt: '2025-03-10 14:32:01',
    status: 'running',
    successRate: 0,
    passed: 0,
    failed: 0,
  },
  {
    id: 'cfg-004',
    templateName: '压力表-储能站',
    datasetName: '储能站-压力表-100',
    ability: 'pressure',
    modelVersion: 'meter-pressure-v1.3.2',
    lastRunAt: '2025-03-09 09:11:38',
    status: 'success',
    successRate: 0.97,
    passed: 97,
    failed: 3,
  },
  {
    id: 'cfg-005',
    templateName: '水表-城市供水',
    datasetName: '供水-水表-夜间',
    ability: 'water',
    modelVersion: 'meter-water-v1.0.0-beta',
    lastRunAt: '2025-03-08 22:47:55',
    status: 'pending',
    successRate: 0,
    passed: 0,
    failed: 0,
  },
])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return configs
  return configs.filter((c) => {
    const { algorithm, analysisType } = resolveRowStep3(c)
    const algoText = algorithmLabels[algorithm].toLowerCase()
    const analysisText = analysisTypeLabels[analysisType].toLowerCase()
    const abilityText = algoAbilityLabel[c.ability].toLowerCase()
    return (
      c.templateName.toLowerCase().includes(q) ||
      c.datasetName.toLowerCase().includes(q) ||
      c.modelVersion.toLowerCase().includes(q) ||
      abilityText.includes(q) ||
      algoText.includes(q) ||
      analysisText.includes(q)
    )
  })
})

const statusMeta: Record<ValidationStatus, { text: string; tone: string }> = {
  success: { text: '验证成功', tone: 'success' },
  fail: { text: '验证失败', tone: 'danger' },
  running: { text: '运行中', tone: 'primary' },
  pending: { text: '待验证', tone: 'info' },
}

/** 从表格行 ability + modelVersion 还原算法与分析类型（用于展示） */
function resolveRowStep3(c: ValidationConfig) {
  return parseStep3FromModelVersion(c.ability, c.modelVersion)
}

function formatRate(r: number) {
  if (!r) return '—'
  return `${(r * 100).toFixed(1)}%`
}

// ----------------------------- 新建 Step Flow ---------------------------------

type CreateFlowPreset = Partial<{
  templateId: string
  templateName: string
  templateAbility: AlgoAbility
  datasetName: string
  uploadedCount: number
  /** 旧接口：从表格 / Drawer 回填 */
  modelAbility: AlgoAbility
  modelVersion: string
}>

const createOpen = ref(false)
const step = ref(0)

const draft = reactive({
  templateId: '',
  templateName: '',
  templateAbility: 'pressure' as AlgoAbility,
  datasetOptionId: '',
  datasetName: '',
  uploadedCount: 0,
  algorithm: 'meter_pressure_v14' as AlgorithmKey,
  analysisType: 'reading_precision' as AnalysisTypeKey,
})

function applyDraftTemplateSelection(id: string, nameFallback = '') {
  draft.templateId = id
  const opt = id ? findMeterTemplateById(id) : undefined
  draft.templateName = opt?.name ?? nameFallback
}

function applyDraftDatasetPick(id: string) {
  draft.datasetOptionId = id
  if (!id) return
  const opt = findValidationDatasetById(id)
  if (!opt) return
  draft.datasetName = opt.name
  draft.uploadedCount = opt.uploadedCount
}

const draftAnalysisTypeOptions = computed(() => analysisTypesByAlgorithm[draft.algorithm])

watch(
  () => draft.algorithm,
  (algo) => {
    const opts = analysisTypesByAlgorithm[algo]
    if (!opts.includes(draft.analysisType)) draft.analysisType = opts[0]!
  },
)

function openCreate(preset?: CreateFlowPreset) {
  if (preset?.templateId) {
    applyDraftTemplateSelection(preset.templateId, preset.templateName ?? '')
  } else if (preset?.templateName) {
    const hit = findMeterTemplateByName(preset.templateName)
    applyDraftTemplateSelection(hit?.id ?? '', preset.templateName)
  } else {
    applyDraftTemplateSelection('')
  }
  draft.templateAbility = preset?.templateAbility ?? 'pressure'
  draft.datasetName = preset?.datasetName ?? ''
  draft.uploadedCount = preset?.uploadedCount ?? 0
  draft.datasetOptionId =
    draft.datasetName.trim() !== '' ? findValidationDatasetByName(draft.datasetName)?.id ?? '' : ''

  const abilityForParse = preset?.modelAbility ?? draft.templateAbility
  const rawVersion = preset?.modelVersion?.trim() ?? ''

  if (rawVersion) {
    const parsed = parseStep3FromModelVersion(abilityForParse, rawVersion)
    draft.algorithm = parsed.algorithm
    draft.analysisType = parsed.analysisType
  } else {
    draft.algorithm = defaultAlgorithmByAbility[draft.templateAbility]
    draft.analysisType = analysisTypesByAlgorithm[draft.algorithm][0]!
  }

  step.value = 0
  createOpen.value = true
}

function nextStep() {
  if (step.value === 0 && !draft.templateId) {
    return ElMessage.warning('请先在下拉列表中选择表计模板')
  }
  if (step.value === 1) {
    if (!draft.datasetName.trim()) return ElMessage.warning('请填写验证集名称')
    if (draft.uploadedCount === 0) return ElMessage.warning('请上传至少一张验证图片')
  }
  if (step.value === 2) {
    const allowed = analysisTypesByAlgorithm[draft.algorithm]
    if (!allowed.includes(draft.analysisType)) {
      return ElMessage.warning('请选择分析类型')
    }
  }
  step.value = Math.min(step.value + 1, 3)
}

function prevStep() {
  step.value = Math.max(step.value - 1, 0)
}

function fakeUpload() {
  const next = Math.min(500, draft.uploadedCount + Math.floor(Math.random() * 80 + 60))
  draft.uploadedCount = next
  const opt = draft.datasetOptionId ? findValidationDatasetById(draft.datasetOptionId) : undefined
  if (opt && opt.name === draft.datasetName.trim()) opt.uploadedCount = next
}

function finishCreate() {
  const ability = abilityFromAlgorithm(draft.algorithm)
  const newCfg: ValidationConfig = {
    id: `cfg-${Date.now()}`,
    templateName: draft.templateName,
    datasetName: draft.datasetName,
    ability,
    modelVersion: composeModelVersion(draft.algorithm, draft.analysisType),
    lastRunAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    status: 'running',
    successRate: 0,
    passed: 0,
    failed: 0,
  }
  configs.unshift(newCfg)
  registerValidationDataset(draft.datasetName, draft.uploadedCount)
  createOpen.value = false
  ElMessage.success('已创建验证配置，开始验证…')
}

/** 表格行「开始验证」：与向导最后一步一致，对已有配置启动模型算法检测（不落库新建） */
function runValidationForRow(cfg: ValidationConfig) {
  if (cfg.status === 'running') return
  cfg.status = 'running'
  cfg.successRate = 0
  cfg.passed = 0
  cfg.failed = 0
  cfg.lastRunAt = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  ElMessage.info('已启动模型验证，正在执行算法检测…')

  const timer = window.setTimeout(() => {
    validationTimers.delete(timer)
    cfg.status = 'fail'
    cfg.successRate = 0.684
    cfg.passed = 342
    cfg.failed = 158
    cfg.lastRunAt = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    validationDiagnosisRow.value = cfg
    validationDiagnosisReport.value = buildAbnormalDiagnosisReport('validation-failed')
    validationDiagnosisOpen.value = true
  }, 1200)
  validationTimers.add(timer)
}

function handleValidationDiagnosisAction(actionKey: string, issue: DiagnosisIssue) {
  applyDiagnosisMockAction(actionKey)
  if (actionKey === 'view-missed-images' && validationDiagnosisRow.value) {
    openResult(validationDiagnosisRow.value)
    return
  }
  ElMessage.info(`${issue.title}：已执行 mock 操作`)
}

/** 从表计模板设置返回后恢复新建向导（停留在第一步） */
const WIZARD_RESUME_STORAGE_KEY = 'mtv-create-wizard-resume'

interface WizardResumeDraft {
  templateId: string
  templateName: string
  templateAbility: AlgoAbility
  datasetOptionId: string
  datasetName: string
  uploadedCount: number
  algorithm: AlgorithmKey
  analysisType: AnalysisTypeKey
}

function tryConsumeWizardResumeFromStorage() {
  const raw = sessionStorage.getItem(WIZARD_RESUME_STORAGE_KEY)
  if (!raw) return
  sessionStorage.removeItem(WIZARD_RESUME_STORAGE_KEY)
  try {
    const d = JSON.parse(raw) as Partial<WizardResumeDraft>
    draft.templateId = typeof d.templateId === 'string' ? d.templateId : ''
    draft.templateName = typeof d.templateName === 'string' ? d.templateName : ''
    draft.templateAbility =
      d.templateAbility === 'pressure' || d.templateAbility === 'water' || d.templateAbility === 'electric'
        ? d.templateAbility
        : 'pressure'
    draft.datasetName = typeof d.datasetName === 'string' ? d.datasetName : ''
    draft.uploadedCount = typeof d.uploadedCount === 'number' && Number.isFinite(d.uploadedCount) ? d.uploadedCount : 0
    draft.datasetOptionId = typeof d.datasetOptionId === 'string' ? d.datasetOptionId : ''
    if (draft.datasetOptionId && !findValidationDatasetById(draft.datasetOptionId)) {
      draft.datasetOptionId = findValidationDatasetByName(draft.datasetName)?.id ?? ''
    }
    const algoOk =
      d.algorithm &&
      (['meter_pressure_v14', 'meter_water_v09', 'meter_electric_v11', 'pointer_scale_universal'] as const).includes(
        d.algorithm as AlgorithmKey,
      )
    if (algoOk) draft.algorithm = d.algorithm as AlgorithmKey
    const analysisOk =
      d.analysisType &&
      (['reading_precision', 'roi_quality', 'full_chain_audit'] as const).includes(d.analysisType as AnalysisTypeKey)
    if (analysisOk) draft.analysisType = d.analysisType as AnalysisTypeKey
    const allowed = analysisTypesByAlgorithm[draft.algorithm]
    if (!allowed.includes(draft.analysisType)) draft.analysisType = allowed[0]!
    applyDraftTemplateSelection(draft.templateId, draft.templateName)
    step.value = 0
    createOpen.value = true
  } catch {
    /* ignore corrupt payload */
  }
}

onMounted(() => {
  if (route.query.resumeWizard === '1') {
    tryConsumeWizardResumeFromStorage()
    router.replace({
      name: 'meter-template-validation',
      query: getMeterConfigurationContext(route.query),
    })
  }
})

// ----------------------------- 验证结果 Drawer --------------------------------

interface SampleResult {
  id: number
  thumb: string
  reading: string
  reviewed: 'pending' | 'pass' | 'reject'
  selected: boolean
}

const drawerOpen = ref(false)
const activeCfg = ref<ValidationConfig | null>(null)
const samples = ref<SampleResult[]>([])

/** 抽屉内网格 / 大图查看器共用：按审核状态筛选 */
type DrawerSampleFilter = 'all' | 'reject' | 'pass' | 'pending'

const drawerSampleFilter = ref<DrawerSampleFilter>('all')

const visibleSamples = computed(() => {
  const f = drawerSampleFilter.value
  if (f === 'all') return samples.value
  return samples.value.filter((s) => s.reviewed === f)
})

function openResult(cfg: ValidationConfig) {
  activeCfg.value = cfg
  drawerSampleFilter.value = 'all'
  const total = Math.max(24, cfg.passed + cfg.failed || 96)
  const failedCount = cfg.failed || Math.round(total * 0.18)
  samples.value = Array.from({ length: Math.min(total, 96) }, (_, i) => ({
    id: i + 1,
    thumb: figmaAssets.taskThumbnailDefault,
    reading: (Math.random() * 0.9 + 0.05).toFixed(2),
    reviewed:
      i < failedCount ? (Math.random() > 0.5 ? 'reject' : 'pending') : Math.random() > 0.5 ? 'pass' : 'pending',
    selected: false,
  }))
  drawerOpen.value = true
}

const selectedCount = computed(() => samples.value.filter((s) => s.selected).length)
const rejectedCount = computed(() => samples.value.filter((s) => s.reviewed === 'reject').length)

/** 当前筛选列表是否已全部勾选（用于按钮文案 / 切换） */
const allFilteredSelected = computed(() => {
  const vis = visibleSamples.value
  return vis.length > 0 && vis.every((s) => s.selected)
})

function review(s: SampleResult, verdict: 'pass' | 'reject') {
  s.reviewed = s.reviewed === verdict ? 'pending' : verdict
}

// ----------------------------- 样本大图审核（抽屉内网格点击打开） -----------------------------

const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerZoom = ref(false)

function openSampleViewer(index: number) {
  const list = visibleSamples.value
  const n = list.length
  if (n === 0) return
  viewerIndex.value = Math.max(0, Math.min(index, n - 1))
  viewerZoom.value = false
  viewerOpen.value = true
}

watch(
  () => visibleSamples.value,
  (list) => {
    if (!viewerOpen.value) return
    if (list.length === 0) {
      closeSampleViewer()
      return
    }
    if (viewerIndex.value >= list.length) {
      viewerIndex.value = list.length - 1
    }
  },
  { deep: true },
)

function closeSampleViewer() {
  viewerOpen.value = false
}

const viewerSample = computed(() => visibleSamples.value[viewerIndex.value] ?? null)

function viewerPrev() {
  const n = visibleSamples.value.length
  if (n <= 0) return
  viewerIndex.value = (viewerIndex.value - 1 + n) % n
  viewerZoom.value = false
}

function viewerNext() {
  const n = visibleSamples.value.length
  if (n <= 0) return
  viewerIndex.value = (viewerIndex.value + 1) % n
  viewerZoom.value = false
}

function viewerReview(verdict: 'pass' | 'reject') {
  const s = viewerSample.value
  if (!s) return
  review(s, verdict)
}

function toggleViewerZoom() {
  viewerZoom.value = !viewerZoom.value
}

let viewerKeyCleanup: (() => void) | null = null

watch(viewerOpen, (open) => {
  viewerKeyCleanup?.()
  viewerKeyCleanup = null
  if (!open) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSampleViewer()
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      viewerPrev()
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      viewerNext()
      return
    }
  }
  window.addEventListener('keydown', onKey, true)
  viewerKeyCleanup = () => window.removeEventListener('keydown', onKey, true)
})

onUnmounted(() => {
  viewerKeyCleanup?.()
  validationTimers.forEach((timer) => window.clearTimeout(timer))
  validationTimers.clear()
})

/** 全选当前筛选 / 再次点击取消当前筛选内的勾选（不影响筛选外的勾选状态） */
function toggleSelectAllFilteredVisible() {
  const vis = visibleSamples.value
  if (vis.length === 0) return
  if (vis.every((s) => s.selected)) {
    for (const s of vis) {
      s.selected = false
    }
  } else {
    for (const s of samples.value) {
      s.selected = vis.includes(s)
    }
  }
}

function buildDatasetFromFailures() {
  const picked = samples.value.filter((s) => s.selected)
  if (!picked.length) {
    ElMessage.warning('请先勾选失败样本')
    return
  }
  drawerOpen.value = false
  openCreate({
    datasetName: `${activeCfg.value?.datasetName ?? '验证集'}-失败样本-${picked.length}`,
    uploadedCount: picked.length,
    modelAbility: activeCfg.value?.ability,
    modelVersion: activeCfg.value?.modelVersion ?? '',
  })
  ElMessage.success(`已基于 ${picked.length} 张失败样本生成验证集，请先选择新的表计模板`)
}

function goMeterTemplateSettings() {
  const snapshot: WizardResumeDraft = {
    templateId: draft.templateId,
    templateName: draft.templateName,
    templateAbility: draft.templateAbility,
    datasetOptionId: draft.datasetOptionId,
    datasetName: draft.datasetName,
    uploadedCount: draft.uploadedCount,
    algorithm: draft.algorithm,
    analysisType: draft.analysisType,
  }
  sessionStorage.setItem(WIZARD_RESUME_STORAGE_KEY, JSON.stringify(snapshot))
  createOpen.value = false
  router.push({
    name: 'meter-template-settings',
    query: {
      ...getMeterConfigurationContext(route.query),
      from: 'wizard',
    },
  })
}

function goBack() {
  if (route.query.source === 'model-validation' && route.query.modelId) {
    router.push({
      name: 'model-detail',
      params: { modelId: String(route.query.modelId) },
      query: route.query.versionId ? { versionId: String(route.query.versionId) } : {},
    })
    return
  }
  router.push({
    name: 'meter-configuration-home',
    query: getMeterConfigurationReturnQuery(route.query),
  })
}

function goMeterTemplateConfiguration() {
  router.push({
    name: 'meter-template-configuration',
    query: getMeterConfigurationContext(route.query),
  })
}
</script>

<template>
  <DwAppShell>
    <div class="mtv-body">
        <div class="mtv-back dw-caption" @click="goBack">
          <IconArrowLeft :size="16" color="var(--el-text-color-primary)" />
          <span>{{ route.query.source === 'model-validation' ? '返回模型详情' : '返回表计配置' }}</span>
        </div>

        <div class="mtv-page-head">
          <div class="mtv-page-title">
            <div class="mtv-page-title-icon">
              <IconGauge :size="20" stroke="1.75" />
            </div>
            <div class="mtv-page-title-text">
              <h1 class="mtv-h1">表计模板 &amp; 验证</h1>
              <p class="mtv-h1-sub dw-caption">
                管理表计识别模板与验证集，跑批模型版本并人工审核结果，构建可复用的失败样本集。
              </p>
            </div>
          </div>
          <div class="mtv-page-actions">
            <el-input
              v-model="search"
              size="default"
              class="mtv-search"
              placeholder="搜索模板 / 验证集 / 算法 / 分析类型"
              clearable
            >
              <template #prefix>
                <IconSearch :size="16" stroke="1.75" color="var(--el-text-color-secondary)" />
              </template>
            </el-input>
            <el-button type="primary" size="default" @click="goMeterTemplateConfiguration">
              <span class="dw-btn-inner">
                <IconPlus :size="18" stroke="2" />
                新建表计模板 &amp; 验证
              </span>
            </el-button>
          </div>
        </div>

        <section v-if="route.query.source === 'model-validation'" class="mtv-model-binding">
          <div>
            <span>当前验证模型</span>
            <strong>{{ route.query.modelName }} {{ route.query.versionName }}</strong>
          </div>
          <p>该模型版本已自动绑定，无需重新选择。</p>
        </section>

        <section class="mtv-table-panel">
          <el-table :data="filtered" class="mtv-table" stripe>
            <el-table-column prop="templateName" label="表计模板名称" min-width="190">
              <template #default="{ row }">
                <div class="mtv-cell-strong">
                  <IconGauge :size="16" stroke="1.75" />
                  <span>{{ row.templateName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="datasetName" label="验证集名称" min-width="190" />
            <el-table-column label="算法" min-width="200">
              <template #default="{ row }">
                <span class="dw-body2 mtv-cell-plain">{{ algorithmLabels[resolveRowStep3(row).algorithm] }}</span>
              </template>
            </el-table-column>
            <el-table-column label="分析类型" min-width="160">
              <template #default="{ row }">
                <span class="dw-body2 mtv-cell-plain">{{ analysisTypeLabels[resolveRowStep3(row).analysisType] }}</span>
              </template>
            </el-table-column>
            <el-table-column label="最近验证状态" min-width="220">
              <template #default="{ row }">
                <div class="mtv-status">
                  <span
                    class="dw-dot"
                    :style="{ background: `var(--el-color-${statusMeta[row.status as ValidationStatus].tone})` }"
                  />
                  <span class="dw-caption">{{ statusMeta[row.status as ValidationStatus].text }}</span>
                  <template v-if="row.status === 'success' || row.status === 'fail'">
                    <span class="mtv-status-divider">·</span>
                    <span class="dw-caption mtv-rate">{{ formatRate(row.successRate) }}</span>
                    <span class="dw-caption mtv-status-counts">
                      <span class="mtv-pass">通过 {{ row.passed }}</span>
                      <span class="mtv-fail">失败 {{ row.failed }}</span>
                    </span>
                  </template>
                </div>
                <div class="mtv-status-time dw-caption">{{ row.lastRunAt }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" align="right" fixed="right">
              <template #default="{ row }">
                <div class="mtv-row-actions">
                  <el-button
                    text
                    size="small"
                    :disabled="row.status === 'running'"
                    @click="runValidationForRow(row)"
                  >
                    <span class="dw-btn-inner">
                      <IconPlayerPlay :size="14" stroke="1.75" />
                      {{ row.status === 'running' ? '验证中' : '开始验证' }}
                    </span>
                  </el-button>
                  <el-button text size="small" @click="openResult(row)">
                    <span class="dw-btn-inner">
                      <IconClipboardCheck :size="14" stroke="1.75" />
                      审核
                    </span>
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <div class="mtv-empty dw-caption">未匹配到符合条件的验证配置</div>
            </template>
          </el-table>
        </section>
    </div>

    <ProblemDiagnosisDialog
      v-model="validationDiagnosisOpen"
      :report="validationDiagnosisReport"
      @continue="validationDiagnosisOpen = false"
      @action="handleValidationDiagnosisAction"
    />

    <!-- ============== 新建 Step Flow Dialog ============== -->
    <el-dialog
      v-model="createOpen"
      width="var(--dw-dialog-size-large)"
      align-center
      class="mtv-dialog"
      :show-close="false"
    >
      <template #header>
        <div class="mtv-dialog-head">
          <span class="mtv-dialog-title">新建表计模板 &amp; 验证</span>
          <button
            type="button"
            class="dw-icon-btn"
            aria-label="关闭"
            @click="createOpen = false"
          >
            <IconX :size="18" stroke="1.75" />
          </button>
        </div>
      </template>

      <el-steps :active="step" finish-status="success" class="mtv-steps">
        <el-step title="选择/创建模板" />
        <el-step title="上传验证集" />
        <el-step title="选择模型" />
        <el-step title="开始验证" />
      </el-steps>

      <div class="mtv-step-body">
        <!-- Step 1 -->
        <div v-if="step === 0" class="mtv-step-pane">
          <el-form label-position="top" size="default">
            <el-form-item label="表计模板">
              <el-select
                v-model="draft.templateId"
                placeholder="请选择已创建的表计模板"
                filterable
                clearable
                style="width: 100%"
                @change="(id) => applyDraftTemplateSelection(id != null && id !== '' ? String(id) : '')"
              >
                <el-option
                  v-for="t in meterTemplateOptions"
                  :key="t.id"
                  :label="t.name"
                  :value="t.id"
                />
              </el-select>
            </el-form-item>
            <div class="mtv-template-settings-entry">
              <el-button type="primary" plain @click="goMeterTemplateSettings">
                <span class="dw-btn-inner">
                  <IconSettings :size="18" stroke="1.75" />
                  表计模板设置
                </span>
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- Step 2 -->
        <div v-else-if="step === 1" class="mtv-step-pane">
          <el-form label-position="top" size="default">
            <el-form-item label="选用已有验证集">
              <el-select
                v-model="draft.datasetOptionId"
                placeholder="可选：选择曾上传过的验证集"
                filterable
                clearable
                style="width: 100%"
                @change="
                  (v) =>
                    applyDraftDatasetPick(v != null && v !== '' ? String(v) : '')
                "
              >
                <el-option
                  v-for="d in validationDatasetOptions"
                  :key="d.id"
                  :label="`${d.name}（${d.uploadedCount} 张）`"
                  :value="d.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="验证集名称">
              <el-input v-model="draft.datasetName" placeholder="例如：110kV-压力表验证集-V3" />
            </el-form-item>
            <el-form-item label="上传验证图片">
              <div class="mtv-upload" @click="fakeUpload">
                <IconCloudUpload :size="32" stroke="1.5" />
                <div class="mtv-upload-text">点击或拖拽图片到此区域上传</div>
                <div class="dw-caption mtv-upload-hint">
                  支持批量上传，单次建议 100 ~ 500 张；当前已添加
                  <strong>{{ draft.uploadedCount }}</strong> 张
                </div>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- Step 3 -->
        <div v-else-if="step === 2" class="mtv-step-pane">
          <el-form label-position="top" size="default">
            <el-form-item label="算法">
              <el-select v-model="draft.algorithm" placeholder="选择算法" style="width: 100%">
                <el-option
                  v-for="(label, key) in algorithmLabels"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="分析类型">
              <el-select v-model="draft.analysisType" placeholder="选择分析类型" style="width: 100%">
                <el-option
                  v-for="t in draftAnalysisTypeOptions"
                  :key="t"
                  :label="analysisTypeLabels[t]"
                  :value="t"
                />
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <!-- Step 4 -->
        <div v-else class="mtv-step-pane mtv-step-summary">
          <div class="mtv-summary-icon">
            <IconSparkles :size="28" stroke="1.5" />
          </div>
          <div class="mtv-summary-title">即将开始验证</div>
          <div class="mtv-summary-grid dw-caption">
            <div><span class="mtv-summary-key">模板</span><span>{{ draft.templateName }}</span></div>
            <div><span class="mtv-summary-key">验证集</span><span>{{ draft.datasetName }}（{{ draft.uploadedCount }} 张）</span></div>
            <div><span class="mtv-summary-key">算法能力</span><span>{{ algoAbilityLabel[abilityFromAlgorithm(draft.algorithm)] }}</span></div>
            <div><span class="mtv-summary-key">模型版本</span><span class="mtv-mono">{{ composeModelVersion(draft.algorithm, draft.analysisType) }}</span></div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="mtv-dialog-footer">
          <el-button text @click="createOpen = false">取消</el-button>
          <div class="mtv-dialog-footer-right">
            <el-button :disabled="step === 0" @click="prevStep">上一步</el-button>
            <el-button v-if="step < 3" type="primary" @click="nextStep">下一步</el-button>
            <el-button v-else type="primary" @click="finishCreate">
              <span class="dw-btn-inner">
                <IconPlayerPlay :size="16" stroke="1.75" />
                开始验证
              </span>
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- ============== 验证结果 Drawer ============== -->
    <el-drawer
      v-model="drawerOpen"
      direction="rtl"
      size="960px"
      class="mtv-drawer"
      :with-header="false"
    >
      <div class="mtv-drawer-inner">
        <header class="mtv-drawer-head">
          <div class="mtv-drawer-title-block">
            <div class="dw-caption mtv-drawer-kicker">验证结果</div>
            <h2 class="mtv-h2">{{ activeCfg?.templateName }} · {{ activeCfg?.datasetName }}</h2>
            <div class="mtv-drawer-meta dw-caption">
              <span class="mtv-mono">{{ activeCfg?.modelVersion }}</span>
              <span class="mtv-status-divider">·</span>
              <span>识别成功 {{ activeCfg?.passed }}</span>
              <span class="mtv-status-divider">/</span>
              <span class="mtv-fail">识别失败 {{ activeCfg?.failed }}</span>
              <span class="mtv-status-divider">·</span>
              <span>{{ formatRate(activeCfg?.successRate ?? 0) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="dw-icon-btn"
            aria-label="关闭"
            @click="drawerOpen = false"
          >
            <IconX :size="20" stroke="1.75" />
          </button>
        </header>

        <div class="mtv-drawer-toolbar">
          <div class="mtv-drawer-toolbar-start">
            <div class="mtv-drawer-toolbar-filter">
              <span class="dw-caption mtv-drawer-filter-label">审核筛选</span>
              <el-select
                v-model="drawerSampleFilter"
                size="small"
                class="mtv-drawer-filter-select"
                aria-label="按审核结果筛选样本"
              >
                <el-option label="全部样本" value="all" />
                <el-option label="仅不通过" value="reject" />
                <el-option label="已通过" value="pass" />
                <el-option label="待审核" value="pending" />
              </el-select>
            </div>
            <div class="mtv-drawer-toolbar-stats dw-caption">
              <span>已选 <strong>{{ selectedCount }}</strong> 张</span>
              <span class="mtv-status-divider">·</span>
              <span>当前失败 <span class="mtv-fail">{{ rejectedCount }}</span> 张</span>
              <template v-if="drawerSampleFilter !== 'all'">
                <span class="mtv-status-divider">·</span>
                <span>显示 <strong>{{ visibleSamples.length }}</strong> / {{ samples.length }} 张</span>
              </template>
            </div>
          </div>
          <div class="mtv-drawer-toolbar-right">
            <el-button
              text
              size="small"
              :disabled="visibleSamples.length === 0"
              @click="toggleSelectAllFilteredVisible"
            >
              {{ allFilteredSelected ? '取消全选' : '全选当前筛选' }}
            </el-button>
            <el-button
              type="primary"
              size="default"
              :disabled="selectedCount === 0"
              @click="buildDatasetFromFailures"
            >
              <span class="dw-btn-inner">
                <IconFilePlus :size="16" stroke="1.75" />
                加入新验证集（{{ selectedCount }}）
              </span>
            </el-button>
          </div>
        </div>

        <div v-if="visibleSamples.length === 0" class="mtv-sample-grid-empty dw-caption">
          当前筛选条件下没有样本，请切换「审核筛选」或改为查看全部样本。
        </div>
        <div v-else class="mtv-sample-grid">
          <article
            v-for="(s, idx) in visibleSamples"
            :key="s.id"
            class="mtv-sample-card dw-panel dw-panel--dense"
            :class="{
              'is-selected': s.selected,
              'is-pass': s.reviewed === 'pass',
              'is-reject': s.reviewed === 'reject',
            }"
          >
            <label class="mtv-sample-pick">
              <el-checkbox v-model="s.selected" />
            </label>
            <div
              class="mtv-sample-thumb mtv-sample-thumb--interactive"
              role="button"
              tabindex="0"
              :aria-label="`放大查看样本 ${s.id}`"
              @click="openSampleViewer(idx)"
              @keydown.enter.prevent="openSampleViewer(idx)"
              @keydown.space.prevent="openSampleViewer(idx)"
            >
              <img :src="s.thumb" :alt="`样本 ${s.id}`" loading="lazy" />
              <div v-if="s.reviewed !== 'pending'" class="mtv-sample-stamp" :data-tone="s.reviewed">
                <IconCheck v-if="s.reviewed === 'pass'" :size="14" stroke="2" />
                <IconX v-else :size="14" stroke="2" />
                <span>{{ s.reviewed === 'pass' ? '通过' : '不通过' }}</span>
              </div>
            </div>
            <div class="mtv-sample-foot">
              <div class="mtv-sample-reading">
                <span class="dw-caption mtv-sample-reading-label">读数</span>
                <span class="mtv-mono mtv-sample-reading-value">{{ s.reading }}</span>
              </div>
              <div class="mtv-sample-review">
                <button
                  type="button"
                  class="mtv-review-btn"
                  :class="{ 'is-active-pass': s.reviewed === 'pass' }"
                  aria-label="通过"
                  @click="review(s, 'pass')"
                >
                  <IconCircleCheck :size="18" stroke="1.75" />
                </button>
                <button
                  type="button"
                  class="mtv-review-btn"
                  :class="{ 'is-active-reject': s.reviewed === 'reject' }"
                  aria-label="不通过"
                  @click="review(s, 'reject')"
                >
                  <IconCircleX :size="18" stroke="1.75" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </el-drawer>

    <!-- 样本大图：放大查看 + 切换 + 审核 -->
    <el-dialog
      v-model="viewerOpen"
      append-to-body
      align-center
      width="var(--dw-dialog-size-large)"
      class="mtv-sample-viewer-dialog dw-dialog-xlarge"
      modal-class="mtv-sample-viewer-overlay"
      destroy-on-close
      @closed="viewerZoom = false"
    >
      <template #header>
        <div class="mtv-viewer-head">
          <span class="mtv-viewer-title dw-subtitle2">样本审核</span>
          <span class="dw-caption mtv-viewer-counter">
            {{ viewerIndex + 1 }} / {{ visibleSamples.length }}
          </span>
          <span
            v-if="viewerSample && viewerSample.reviewed !== 'pending'"
            class="mtv-viewer-status dw-caption"
            :data-tone="viewerSample.reviewed"
          >
            {{ viewerSample.reviewed === 'pass' ? '已通过' : '未通过' }}
          </span>
        </div>
      </template>

      <div v-if="viewerSample" class="mtv-viewer-layout">
        <button type="button" class="mtv-viewer-nav" aria-label="上一张" @click="viewerPrev">
          <IconChevronLeft :size="28" stroke="1.75" />
        </button>

        <div class="mtv-viewer-center">
          <div
            class="mtv-viewer-stage"
            :class="{ 'is-zoomed': viewerZoom }"
          >
            <img
              :src="viewerSample.thumb"
              :alt="`样本 ${viewerSample.id}`"
              class="mtv-viewer-img"
              :class="{ 'is-zoomed': viewerZoom }"
              decoding="async"
              @click="toggleViewerZoom"
            />
          </div>
          <p class="dw-caption mtv-viewer-zoom-hint">
            点击图片放大或缩小；方向键切换上一张 / 下一张；Esc 关闭。
          </p>
          <div class="mtv-viewer-reading-row dw-caption">
            <span class="mtv-sample-reading-label">读数</span>
            <span class="mtv-mono mtv-sample-reading-value">{{ viewerSample.reading }}</span>
          </div>
        </div>

        <button type="button" class="mtv-viewer-nav" aria-label="下一张" @click="viewerNext">
          <IconChevronRight :size="28" stroke="1.75" />
        </button>
      </div>

      <template #footer>
        <div class="mtv-viewer-footer">
          <el-button @click="closeSampleViewer">关闭</el-button>
          <div class="mtv-viewer-footer-actions">
            <el-button
              type="success"
              plain
              @click="viewerReview('pass')"
            >
              <span class="dw-btn-inner">
                <IconCircleCheck :size="18" stroke="1.75" />
                通过
              </span>
            </el-button>
            <el-button
              type="danger"
              plain
              @click="viewerReview('reject')"
            >
              <span class="dw-btn-inner">
                <IconCircleX :size="18" stroke="1.75" />
                不通过
              </span>
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </DwAppShell>
</template>

<style scoped>
.mtv-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mtv-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  width: fit-content;
}

.mtv-back:hover {
  color: var(--el-color-primary);
}

.mtv-page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 0 8px;
}

.mtv-page-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.mtv-page-title-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--dw-panel-radius, 8px);
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  /* DW 运营磨砂：与 --dw-panel-fill 一致，透出页底 */
  backdrop-filter: blur(var(--dw-panel-blur, 100px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur, 100px));
  background: var(--dw-panel-fill, rgba(71, 71, 71, 0.3));
  border: 1px solid var(--dw-panel-border-strong);
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass),
    0 1px 0 color-mix(in srgb, var(--el-color-primary) 22%, transparent);
}

.mtv-h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
}

.mtv-h1-sub {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  max-width: 720px;
}

.mtv-page-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.mtv-model-binding {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 16px;
  box-sizing: border-box;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
}

.mtv-model-binding div {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.mtv-model-binding span,
.mtv-model-binding p {
  color: var(--el-text-color-secondary);
}

.mtv-model-binding strong {
  color: var(--el-text-color-primary);
}

.mtv-model-binding p {
  margin: 0;
}

.mtv-search {
  width: 280px;
}

.mtv-search :deep(.el-input__wrapper) {
  backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  background-color: var(--dw-panel-fill, rgba(71, 71, 71, 0.3));
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass);
}

.mtv-table-panel {
  padding: 12px 16px 16px;
  box-sizing: border-box;
  overflow: visible;
}

/* 非面板：使用 EP 令牌填充与分割线，无磨砂叠层 */
.mtv-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: var(--el-fill-color-blank);
  --el-table-header-bg-color: var(--el-fill-color-light);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
  --el-table-border-color: var(--el-border-color-lighter);
}

.mtv-table :deep(.el-table__body tr.el-table__row--striped td.el-table__cell) {
  background-color: var(--el-fill-color-light) !important;
}

.mtv-table :deep(.el-table__body tr.el-table__row--striped.hover-row td.el-table__cell),
.mtv-table :deep(.el-table__body tr.hover-row.el-table__row--striped td.el-table__cell) {
  background-color: var(--el-table-row-hover-bg-color) !important;
}

.mtv-table :deep(th.el-table__cell) {
  font-weight: 500;
  color: var(--el-text-color-secondary);
  background: var(--el-table-header-bg-color);
}

.mtv-cell-plain {
  color: var(--el-text-color-primary);
}

.mtv-cell-strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.mtv-mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.mtv-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  flex-wrap: wrap;
}

.mtv-status-divider {
  color: var(--el-text-color-placeholder);
}

.mtv-rate {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.mtv-status-counts {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mtv-pass {
  color: var(--el-color-success);
}

.mtv-fail {
  color: var(--el-color-danger);
}

.mtv-status-time {
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
}

.mtv-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.mtv-empty {
  padding: 32px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

/* ========== Dialog（磨砂外壳见 global.css [data-dw-theme=dw-ops]） ========== */

.mtv-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.mtv-dialog :deep(.el-step__title),
.mtv-dialog :deep(.el-step__description) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  white-space: normal;
}

/* 步骤标题：当前态品牌色（弹窗 teleport 到 body 时须同步写在 global.css .mtv-dialog） */
.mtv-dialog :deep(.el-step__title.is-process) {
  color: var(--el-color-primary);
  font-weight: 600;
}

.mtv-dialog :deep(.el-step__title.is-finish) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.mtv-dialog :deep(.el-step__title.is-success) {
  color: var(--el-color-success);
}

.mtv-dialog :deep(.el-step__title.is-wait) {
  color: var(--el-text-color-placeholder);
}

.mtv-dialog :deep(.el-step.is-horizontal .el-step__main) {
  text-align: center;
}

.mtv-dialog :deep(.el-step__icon.is-text),
.mtv-dialog :deep(.el-step__icon-inner) {
  border-color: var(--el-border-color-dark);
}

.mtv-dialog :deep(.el-step__head.is-wait .el-step__icon.is-text) {
  border-color: var(--el-text-color-placeholder);
  color: var(--el-text-color-placeholder);
}

.mtv-dialog :deep(.el-step__head.is-process .el-step__icon) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: var(--el-color-white);
}

.mtv-dialog :deep(.el-step__head.is-process .el-step__icon-inner) {
  color: inherit;
}

.mtv-dialog :deep(.el-step__head.is-finish .el-step__icon) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.mtv-dialog :deep(.el-step__head.is-success .el-step__icon) {
  border-color: var(--el-color-success);
  color: var(--el-color-success);
}

.mtv-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mtv-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mtv-steps {
  padding: 8px 0 18px;
}

.mtv-step-body {
  min-height: 240px;
}

.mtv-step-pane {
  padding: 4px 4px 8px;
}

.mtv-template-settings-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.mtv-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: var(--dw-panel-radius, 8px);
  padding: 28px;
  text-align: center;
  color: var(--el-text-color-secondary);
  background: var(--dw-panel-fill, rgba(71, 71, 71, 0.3));
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass);
  backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  cursor: pointer;
  transition: all 0.15s ease;
}

.mtv-upload:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass),
    0 0 0 1px color-mix(in srgb, var(--el-color-primary) 38%, var(--el-border-color-dark));
}

.mtv-upload-text {
  margin-top: 8px;
  color: var(--el-text-color-primary);
}

.mtv-upload-hint {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}

.mtv-upload strong {
  color: var(--el-color-primary);
}

.mtv-step-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 4px;
}

.mtv-summary-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  background: var(--dw-panel-fill, rgba(71, 71, 71, 0.3));
  border: 1px solid var(--dw-panel-border-strong);
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass);
}

.mtv-summary-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mtv-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 24px;
  width: 100%;
  max-width: 480px;
}

.mtv-summary-grid > div {
  display: flex;
  gap: 8px;
  color: var(--el-text-color-primary);
}

.mtv-summary-key {
  color: var(--el-text-color-secondary);
  width: 64px;
  flex-shrink: 0;
}

.mtv-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.mtv-dialog-footer-right {
  display: inline-flex;
  gap: 8px;
}

/* ========== Drawer（磨砂外壳见 global.css） ========== */

.mtv-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.mtv-drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.mtv-drawer-head {
  padding: 20px 24px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--el-border-color-dark);
  background: color-mix(in srgb, var(--dw-panel-fill) 88%, transparent);
  backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
}

.mtv-drawer-kicker {
  color: var(--el-text-color-secondary);
}

.mtv-h2 {
  margin: 4px 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mtv-drawer-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
}

.mtv-drawer-toolbar {
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  row-gap: 10px;
  border-bottom: 1px solid var(--el-border-color-dark);
  background: color-mix(in srgb, var(--dw-panel-fill) 75%, transparent);
  backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
  -webkit-backdrop-filter: blur(var(--dw-panel-blur-dense, 72px));
}

.mtv-drawer-toolbar-start {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 24px;
  min-width: 0;
  flex: 1 1 auto;
}

.mtv-drawer-toolbar-stats {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--el-text-color-primary);
}

.mtv-drawer-toolbar-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}

.mtv-drawer-filter-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.mtv-drawer-filter-select {
  width: 132px;
  max-width: 100%;
}

.mtv-drawer-toolbar-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-left: auto;
}

.mtv-sample-grid {
  padding: 16px 24px 32px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  overflow: auto;
  flex: 1;
}

.mtv-sample-grid-empty {
  margin: 0 24px 24px;
  padding: 48px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  border-radius: var(--dw-panel-radius, 8px);
  border: 1px dashed var(--el-border-color-dark);
  background: color-mix(in srgb, var(--dw-panel-fill) 55%, transparent);
  flex: 1;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mtv-sample-card {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  cursor: default;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mtv-sample-card.is-selected {
  border-color: color-mix(in srgb, var(--el-color-primary) 58%, var(--dw-panel-border-muted));
  box-shadow:
    inset 0 0 0 1px var(--dw-outline-inner-glass),
    0 0 0 1px color-mix(in srgb, var(--el-color-primary) 42%, var(--el-border-color-dark)),
    0 8px 24px rgba(0, 0, 0, 0.22);
}

.mtv-sample-card.is-pass {
  border-color: color-mix(in srgb, var(--el-color-success) 72%, var(--dw-panel-border-muted));
}

.mtv-sample-card.is-reject {
  border-color: color-mix(in srgb, var(--el-color-danger) 72%, var(--dw-panel-border-muted));
}

.mtv-sample-pick {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--dw-panel-fill) 85%, transparent);
  border-radius: 4px;
  padding: 1px 2px;
  border: 1px solid var(--el-border-color-dark);
  box-shadow: inset 0 0 0 1px var(--dw-outline-inner-glass);
}

.mtv-sample-thumb {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.mtv-sample-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.mtv-sample-thumb--interactive {
  cursor: zoom-in;
  outline: none;
}

.mtv-sample-thumb--interactive:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.mtv-sample-stamp {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--el-color-info);
  color: var(--el-color-white);
}

.mtv-sample-stamp[data-tone='pass'] {
  background: var(--el-color-success);
}

.mtv-sample-stamp[data-tone='reject'] {
  background: var(--el-color-danger);
}

.mtv-sample-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 4px;
}

.mtv-sample-reading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mtv-sample-reading-label {
  color: var(--el-text-color-secondary);
}

.mtv-sample-reading-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.mtv-sample-review {
  display: inline-flex;
  gap: 4px;
}

.mtv-review-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--el-border-color-dark);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mtv-review-btn:hover {
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color-darker);
}

.mtv-review-btn.is-active-pass {
  color: var(--el-color-success);
  border-color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 16%, transparent);
}

.mtv-review-btn.is-active-reject {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 16%, transparent);
}

/* ---------- 样本大图对话框 ---------- */

.mtv-sample-viewer-dialog :deep(.el-dialog__body) {
  padding-top: 4px;
}

.mtv-viewer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mtv-viewer-title {
  color: var(--el-text-color-primary);
}

.mtv-viewer-counter {
  color: var(--el-text-color-secondary);
}

.mtv-viewer-status[data-tone='pass'] {
  color: var(--el-color-success);
}

.mtv-viewer-status[data-tone='reject'] {
  color: var(--el-color-danger);
}

.mtv-viewer-layout {
  display: flex;
  align-items: stretch;
  gap: 10px;
  min-height: min(58vh, 520px);
}

.mtv-viewer-nav {
  flex-shrink: 0;
  width: 44px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  align-self: center;
  min-height: 100px;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.mtv-viewer-nav:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.mtv-viewer-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mtv-viewer-stage {
  flex: 1;
  min-height: 260px;
  max-height: min(58vh, 520px);
  border-radius: 8px;
  overflow: auto;
  background: var(--el-fill-color-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color-dark);
}

.mtv-viewer-stage.is-zoomed {
  align-items: flex-start;
  justify-content: flex-start;
}

.mtv-viewer-img {
  max-width: 100%;
  max-height: min(54vh, 480px);
  width: auto;
  height: auto;
  object-fit: contain;
  cursor: zoom-in;
  transition: transform 0.2s ease;
  transform-origin: center center;
}

.mtv-viewer-img.is-zoomed {
  cursor: zoom-out;
  transform: scale(2);
  max-height: none;
  max-width: none;
}

.mtv-viewer-zoom-hint {
  margin: 0;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

.mtv-viewer-reading-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}

.mtv-viewer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.mtv-viewer-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
