<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { figmaAssets } from '@/assets/figma'
import {
  getAlgorithm,
  getAnalysisType,
  runAlgorithm,
} from '@/state/workflow'
import {
  IconArrowLeft,
  IconCamera,
  IconChevronDown,
  IconDots,
  IconGauge,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconUser,
} from '@tabler/icons-vue'

const router = useRouter()
const route = useRoute()

const algorithm = computed(() => getAlgorithm(String(route.params.id ?? 'helmet')))

function backToInference() {
  router.push({ name: 'inference-home' })
}

function goMeterTemplateValidation() {
  router.push({
    name: 'meter-template-validation',
    query: { algorithmId: algorithm.value.id },
  })
}

type Status =
  | { kind: 'tag-danger'; text: string }
  | { kind: 'tag-success'; text: string }
  | { kind: 'dot'; text: string; tone: 'primary' | 'danger' | 'muted' }

type Task = {
  id: number
  title: string
  time: string
  thumb: string
  status: Status
}

const algorithmVersion = computed(() => `${algorithm.value.name}（${algorithm.value.version}）`)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(100)
const filterTab = ref<'all' | 'abnormal'>('all')

/** 检测任务栅格缩略 — 设计稿 Frame 5916（1245:39218）同款图 */
const taskThumbFromDesign = figmaAssets.taskThumbnailDefault
const taskThumbGauge = figmaAssets.taskThumbnailGauge

const tasks = ref<Task[]>([
  {
    id: 1,
    title: '拍照检测1',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbFromDesign,
    status: { kind: 'tag-danger', text: '结果异常' },
  },
  {
    id: 2,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行中', tone: 'primary' },
  },
  {
    id: 3,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行异常', tone: 'danger' },
  },
  {
    id: 4,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行停止', tone: 'muted' },
  },
  {
    id: 5,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'tag-success', text: '结果正常' },
  },
  {
    id: 6,
    title: '拍照检测1',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbFromDesign,
    status: { kind: 'tag-danger', text: '结果异常' },
  },
  {
    id: 7,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行中', tone: 'primary' },
  },
  {
    id: 8,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行异常', tone: 'danger' },
  },
  {
    id: 9,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'dot', text: '执行停止', tone: 'muted' },
  },
  {
    id: 10,
    title: '拍照检测',
    time: '2025-03-04 15:20:10',
    thumb: taskThumbGauge,
    status: { kind: 'tag-success', text: '结果正常' },
  },
])

function quickDetect() {
  const analysisTypeId = algorithm.value.defaultAnalysisTypeId
  const record = runAlgorithm(algorithm.value.id, analysisTypeId)
  tasks.value.unshift({
    id: Date.now(),
    title: record.title,
    time: record.time,
    thumb: algorithm.value.id === 'helmet' ? figmaAssets.algorithmHelmet : taskThumbGauge,
    status: { kind: 'dot', text: '执行中', tone: 'primary' },
  })
  total.value += 1
  ElMessage.success(`${getAnalysisType(analysisTypeId).name}任务已创建`)
}

function dotColor(tone: 'primary' | 'danger' | 'muted') {
  if (tone === 'primary') return 'var(--el-color-primary)'
  if (tone === 'danger') return 'var(--el-color-danger)'
  return 'color-mix(in srgb, var(--el-text-color-secondary) 85%, transparent)'
}

/** 侧栏元数据 — 对齐 Figma Frame 5958（1075:23947）：12px 行、8px 间距、标签次要色 / 值主色右对齐 */
type AlgorithmMetaRow = { label: string; value: string; multiline?: boolean }

const algorithmMetaRows = computed<AlgorithmMetaRow[]>(() => [
  { label: '算法类型', value: algorithm.value.type },
  { label: '输入类型', value: algorithm.value.inputType },
  { label: '算法来源', value: algorithm.value.source },
  { label: '更新时间', value: algorithm.value.updatedAt },
  { label: '运行次数', value: `${algorithm.value.runs} 次` },
  {
    label: '算法描述',
    value: algorithm.value.description,
    multiline: true,
  },
])
</script>

<template>
  <div class="dw-page-bg">
    <div class="dw-page-artwork" aria-hidden="true" />
    <div class="dw-page-scrim" aria-hidden="true" />
    <div class="dw-shell">
      <header class="dw-header-bar">
          <div class="dw-header-left">
            <div class="dw-logo-mark" aria-hidden="true" />
            <span class="dw-app-title dw-subtitle2">算法训练工具</span>
            <el-breadcrumb class="dw-breadcrumb dw-body2" separator="/">
              <el-breadcrumb-item :to="{ name: 'inference-home' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item>查看详情：{{ algorithm.name }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <nav class="dw-main-nav" aria-label="主导航">
            <button type="button" class="dw-main-nav__item" @click="router.push({ name: 'annotation-list' })">数据标注</button>
            <button type="button" class="dw-main-nav__item" @click="router.push({ name: 'training-list' })">模型训练</button>
            <button type="button" class="dw-main-nav__item" @click="router.push({ name: 'meter-configuration-home' })">表计配置</button>
          </nav>
          <div class="dw-header-right">
          <div class="dw-user">
            <div class="dw-avatar">
              <IconUser :size="16" color="var(--el-text-color-primary)" />
            </div>
            <span class="dw-body2">User</span>
            <IconChevronDown :size="18" color="var(--el-text-color-secondary)" />
          </div>
        </div>
      </header>

      <div class="dw-body">
        <aside class="dw-aside">
          <button type="button" class="dw-back dw-caption" @click="backToInference">
            <IconArrowLeft :size="16" color="var(--el-text-color-primary)" />
            <span>查看详情</span>
          </button>

          <div class="dw-version-row">
            <span class="dw-version-text dw-caption">{{ algorithmVersion }}</span>
            <button type="button" class="dw-icon-btn" aria-label="切换版本">
              <IconChevronDown :size="16" color="var(--el-text-color-secondary)" />
            </button>
          </div>

          <div class="dw-panel dw-panel--aside dw-preview">
            <div class="dw-preview-media">
              <div class="dw-task-thumb dw-task-thumb--preview">
                <img
                  alt=""
                  :src="algorithm.image || figmaAssets.sidebarAlgorithmPreview"
                  loading="lazy"
                />
                <div class="dw-preview-tags">
                  <el-tag v-for="tag in algorithm.tags" :key="tag" size="small" type="primary" effect="dark">{{ tag }}</el-tag>
                </div>
              </div>
            </div>
            <div class="dw-preview-footer">
              <div class="dw-running dw-caption">
                <span class="dw-dot" :style="{ background: 'var(--el-color-primary)' }" />
                <span>{{ algorithm.status }}</span>
              </div>
              <button type="button" class="dw-icon-btn dw-icon-btn--primary" aria-label="更多">
                <IconDots :size="20" stroke="1.75" />
              </button>
            </div>
          </div>

          <div class="dw-panel dw-panel--aside dw-meta-panel">
            <div
              v-for="(row, idx) in algorithmMetaRows"
              :key="idx"
              class="dw-meta-row"
              :class="{ 'dw-meta-row--multiline': row.multiline }"
            >
              <span class="dw-meta-label dw-caption">{{ row.label }}</span>
              <span class="dw-meta-value dw-caption">{{ row.value }}</span>
            </div>
          </div>
        </aside>

        <div class="dw-split" role="presentation" />

        <section class="dw-main">
          <div class="dw-main-board">
            <div class="dw-main-toolbar">
              <div class="dw-toolbar-left">
                <div class="dw-section-title dw-caption">
                  <span>检测任务</span>
                  <el-tooltip content="展示当前算法下的检测任务列表" placement="top">
                    <span class="dw-info">
                      <IconInfoCircle :size="16" stroke="1.75" />
                    </span>
                  </el-tooltip>
                </div>
                <el-tag
                  :effect="filterTab === 'all' ? 'dark' : 'plain'"
                  type="primary"
                  size="small"
                  class="dw-filter-tag"
                  @click="filterTab = 'all'"
                >
                  全部
                </el-tag>
                <el-tag
                  :effect="filterTab === 'abnormal' ? 'dark' : 'plain'"
                  type="danger"
                  size="small"
                  class="dw-filter-tag"
                  @click="filterTab = 'abnormal'"
                >
                  结果异常 5
                </el-tag>
                <el-button text circle aria-label="刷新">
                  <IconRefresh :size="18" stroke="1.75" />
                </el-button>
              </div>
              <div class="dw-toolbar-right">
                <el-button size="default" @click="goMeterTemplateValidation">
                  <span class="dw-btn-inner">
                    <IconGauge :size="18" stroke="1.75" />
                    表计模板 & 验证
                  </span>
                </el-button>
                <el-button type="primary" size="default" @click="quickDetect">
                  <span class="dw-btn-inner">
                    <IconPlus :size="18" stroke="2" />
                    快速检测
                  </span>
                </el-button>
              </div>
            </div>

            <div class="dw-task-grid">
              <article v-for="t in tasks" :key="t.id" class="dw-task-card">
                <div class="dw-task-thumb">
                  <img :alt="t.title" :src="t.thumb" loading="lazy" />
                </div>
                <div class="dw-task-body">
                  <div class="dw-task-title-row dw-caption">
                    <IconCamera :size="22" stroke="1.75" />
                    <span class="dw-task-title">{{ t.title }}</span>
                  </div>
                  <div class="dw-task-time dw-caption">{{ t.time }}</div>
                  <div class="dw-task-footer">
                    <div class="dw-task-status dw-caption">
                      <template v-if="t.status.kind === 'tag-danger'">
                        <el-tag type="danger" effect="dark" size="small">{{ t.status.text }}</el-tag>
                      </template>
                      <template v-else-if="t.status.kind === 'tag-success'">
                        <el-tag type="success" effect="dark" size="small">{{ t.status.text }}</el-tag>
                      </template>
                      <template v-else>
                        <span class="dw-dot" :style="{ background: dotColor(t.status.tone) }" />
                        <span>{{ t.status.text }}</span>
                      </template>
                    </div>
                    <button type="button" class="dw-icon-btn" aria-label="更多">
                      <IconDots :size="20" stroke="1.75" />
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div class="dw-pagination-wrap">
              <el-pagination
                v-model:current-page="currentPage"
                :page-size="pageSize"
                :total="total"
                background
                layout="prev, pager, next, jumper"
                small
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dw-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1;
}

.dw-logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: radial-gradient(
    circle at 30% 25%,
    var(--el-color-primary-light-3),
    var(--el-color-primary)
  );
  box-shadow: 0 0 0 1px var(--el-border-color-dark);
}

.dw-app-title {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.dw-breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--el-text-color-primary);
  font-weight: 400;
}

.dw-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--el-text-color-secondary);
}

.dw-header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
}

.dw-main-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  flex-shrink: 0;
}

.dw-main-nav__item {
  position: relative;
  height: 48px;
  min-width: 76px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.dw-main-nav__item.is-active {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dw-main-nav__item.is-active::after {
  content: '';
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--el-color-primary);
}

.dw-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dw-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--el-border-radius-base);
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--el-fill-color-light) 65%, transparent);
}

.dw-body {
  display: flex;
  position: absolute;
  inset: 48px 0 0;
  padding: 16px 20px 30px;
  gap: 0;
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
}

.dw-aside {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.dw-back {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

.dw-back:hover {
  color: var(--el-color-primary);
}

.dw-version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dw-version-text {
  color: var(--el-text-color-primary);
  line-height: 20px;
}

.dw-preview {
  padding: 0 0 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.dw-preview-media {
  width: 100%;
}

.dw-task-thumb--preview {
  position: relative;
  aspect-ratio: 212 / 124;
  border-radius: 0;
}

.dw-preview-tags {
  position: absolute;
  left: 6px;
  top: 6px;
  display: flex;
  gap: 4px;
}

.dw-preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  min-height: 32px;
}

.dw-running {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-primary);
}

.dw-meta-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dw-meta-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  min-height: 24px;
}

.dw-meta-row--multiline {
  align-items: start;
}

.dw-meta-label {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  padding-top: 3px;
}

.dw-meta-value {
  color: var(--el-text-color-primary);
  text-align: right;
  word-break: break-word;
  padding-top: 3px;
}

.dw-meta-row--multiline .dw-meta-value {
  text-align: right;
  line-height: 1.5;
}

.dw-split {
  width: 1px;
  align-self: auto;
  background: var(--el-border-color-dark);
  margin: -16px 16px -30px;
}

.dw-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: clamp(12px, 6.75vh, 54px);
  min-height: 0;
}

.dw-main-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  box-sizing: border-box;
  gap: 20px;
}

.dw-main-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  min-height: 70px;
  flex-shrink: 0;
}

.dw-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
  row-gap: 8px;
  width: 360px;
}

.dw-section-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  flex-basis: 100%;
  height: 24px;
}

.dw-info {
  display: inline-flex;
  color: var(--el-text-color-secondary);
  cursor: default;
}

.dw-filter-tag {
  cursor: pointer;
  user-select: none;
}

.dw-toolbar-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-top: 0;
}

.dw-toolbar-right :deep(.el-button + .el-button) {
  margin-left: 0;
}

.dw-task-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 219.6px;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.dw-task-card .dw-task-thumb {
  border-radius: 0;
}

.dw-task-grid {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  align-content: start;
  padding-right: 4px;
  scrollbar-width: thin;
}

.dw-task-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dw-task-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-primary);
  height: 24px;
}

.dw-task-title {
  font-weight: 600;
  line-height: 20px;
}

.dw-task-time {
  color: var(--el-text-color-secondary);
  line-height: 20px;
}

.dw-task-footer {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dw-task-status {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-primary);
}

.dw-pagination-wrap {
  margin-top: auto;
  padding-top: 0;
  padding-bottom: 0;
  min-height: 32px;
  align-items: center;
  flex-shrink: 0;
}

.dw-icon-btn {
  border: none;
  background: transparent;
  padding: 6px;
  border-radius: var(--el-border-radius-base);
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.dw-icon-btn:hover {
  background: color-mix(in srgb, var(--el-fill-color-light) 70%, transparent);
}

.dw-icon-btn--primary {
  color: var(--el-color-primary);
}
</style>
