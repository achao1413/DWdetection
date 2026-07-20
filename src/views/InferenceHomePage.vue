<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  IconChevronRight,
  IconCpu,
  IconEye,
  IconPlayerPlay,
  IconPlus,
  IconRocket,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import TrainingDialog from '@/components/TrainingDialog.vue'
import { getAnalysisType, runAlgorithm, workflowState } from '@/state/workflow'

const router = useRouter()
const trainingOpen = ref(false)

function viewAlgorithm(id: string) {
  router.push({ name: 'algorithm-detail', params: { id } })
}

function run(id: string) {
  const algorithm = workflowState.algorithms.find((item) => item.id === id)
  const record = runAlgorithm(id)
  ElMessage.success(`${algorithm?.name ?? '算法'}已创建${record.title}任务`)
}
</script>

<template>
  <DwAppShell>
    <div class="dw-home">
      <section class="dw-home-left dw-ops-surface">
        <div class="dw-section-head">
          <div>
            <h1>算法运行</h1>
          </div>
          <el-button type="primary" @click="trainingOpen = true">
            <span class="dw-btn-inner"><IconPlus :size="18" />导入算法</span>
          </el-button>
        </div>

        <div class="dw-algorithm-grid">
          <article
            v-for="algorithm in workflowState.algorithms"
            :key="algorithm.id"
            class="dw-algo-card"
            role="button"
            tabindex="0"
            @click="viewAlgorithm(algorithm.id)"
            @keydown.enter="viewAlgorithm(algorithm.id)"
            @keydown.space.prevent="viewAlgorithm(algorithm.id)"
          >
            <div class="dw-algo-media">
              <img :src="algorithm.image" :alt="algorithm.name" loading="lazy" />
              <div class="dw-algo-tags">
                <el-tag v-for="tag in algorithm.tags" :key="tag" size="small" effect="dark">{{ tag }}</el-tag>
              </div>
            </div>
            <div class="dw-algo-body">
              <div class="dw-algo-title-row">
                <h2>{{ algorithm.name }}</h2>
                <span class="dw-status" :class="`is-${algorithm.status}`">{{ algorithm.status }}</span>
              </div>
              <div class="dw-algo-meta">
                <span>{{ algorithm.version }}</span>
                <span>{{ getAnalysisType(algorithm.defaultAnalysisTypeId).name }}</span>
              </div>
              <div class="dw-algo-actions">
                <el-button link type="primary" size="small" @click.stop="viewAlgorithm(algorithm.id)">
                  <span class="dw-btn-inner"><IconEye :size="16" />查看</span>
                </el-button>
                <el-button plain size="small" type="primary" @click.stop="run(algorithm.id)">
                  <span class="dw-btn-inner"><IconPlayerPlay :size="16" />运行</span>
                </el-button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <aside class="dw-home-right">
        <section class="dw-side-block dw-overview">
          <div class="dw-card-title">
            <IconCpu :size="18" />
            <span>算力概览</span>
          </div>
          <div class="dw-meter-row">
            <span>CPU</span>
            <el-progress :percentage="86" :stroke-width="8" />
          </div>
          <div class="dw-meter-row">
            <span>GPU</span>
            <el-progress :percentage="53" :stroke-width="8" status="success" />
          </div>
          <div class="dw-overview-stats">
            <div><strong>{{ workflowState.algorithms.length }}</strong><span>算法</span></div>
            <div><strong>{{ workflowState.trainingJobs.length }}</strong><span>训练</span></div>
            <div><strong>{{ workflowState.datasets.length }}</strong><span>数据集</span></div>
          </div>
        </section>

        <section class="dw-side-block dw-online">
          <div class="dw-card-title">
            <IconRocket :size="18" />
            <span>在线训练</span>
          </div>
          <div class="dw-step-list">
            <div class="dw-step is-done"><span>1</span><p>上传数据</p></div>
            <div class="dw-step is-done"><span>2</span><p>标注</p></div>
            <div class="dw-step"><span>3</span><p>训练</p></div>
          </div>
          <el-button type="primary" class="dw-online-action" @click="trainingOpen = true">
            <span class="dw-btn-inner">新建训练<IconChevronRight :size="18" /></span>
          </el-button>
        </section>
      </aside>
    </div>

    <TrainingDialog v-model="trainingOpen" @created="router.push({ name: 'training-list' })" />
  </DwAppShell>
</template>

<style scoped>
.dw-home {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 20px;
}

.dw-home-left,
.dw-home-right {
  min-height: 0;
}

.dw-home-left {
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
  border-radius: 12px;
}

.dw-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  margin-bottom: 20px;
}

.dw-section-head h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 28px;
}

.dw-algo-body p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

.dw-algorithm-grid {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  align-content: start;
  gap: 20px;
  padding-right: 4px;
  scrollbar-width: thin;
}

.dw-algo-card {
  border-radius: 8px;
  background: var(--el-fill-color-light);
  overflow: hidden;
  min-width: 0;
  border: 0;
  cursor: pointer;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.dw-algo-card:hover,
.dw-algo-card:focus-visible {
  background: var(--el-fill-color);
}

.dw-algo-card:focus-visible {
  outline: 1px solid var(--el-color-primary);
  outline-offset: 2px;
}

.dw-algo-media {
  position: relative;
  aspect-ratio: 305 / 178.4;
  background: var(--el-fill-color-blank);
}

.dw-algo-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dw-algo-tags {
  position: absolute;
  left: 8px;
  top: 8px;
  display: flex;
  gap: 4px;
}

.dw-algo-body {
  padding: 8px 12px 12px;
}

.dw-algo-title-row,
.dw-algo-actions,
.dw-card-title,
.dw-meter-row,
.dw-overview-stats,
.dw-step {
  display: flex;
  align-items: center;
}

.dw-algo-title-row {
  justify-content: space-between;
  gap: 8px;
}

.dw-algo-title-row h2 {
  margin: 0;
  min-width: 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-color-success);
}

.dw-status.is-待部署 {
  color: var(--el-color-warning);
}

.dw-status.is-已停止 {
  color: var(--el-text-color-placeholder);
}

.dw-algo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0;
}

.dw-algo-meta span {
  height: 20px;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border-radius: 0;
  border: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-algo-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  min-height: 32px;
}

.dw-home-right {
  display: grid;
  grid-template-rows: 267px 256px;
  gap: 20px;
  width: 330px;
}

.dw-overview,
.dw-online {
  padding: 20px;
  overflow: hidden;
}

.dw-side-block {
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  overflow: hidden;
}

.dw-card-title {
  gap: 8px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 18px;
}

.dw-meter-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 18px;
}

.dw-overview-stats {
  justify-content: space-between;
  gap: 8px;
  margin-top: 28px;
}

.dw-overview-stats div {
  flex: 1;
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 72px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 0;
}

.dw-overview-stats strong {
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.dw-overview-stats span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dw-step-list {
  display: grid;
  gap: 12px;
}

.dw-step {
  gap: 12px;
  min-height: 52px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.dw-step span {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.dw-step.is-done span {
  background: var(--el-color-primary);
  color: var(--el-text-color-primary);
}

.dw-step p {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.dw-online-action {
  width: 100%;
  margin-top: 18px;
}
</style>
