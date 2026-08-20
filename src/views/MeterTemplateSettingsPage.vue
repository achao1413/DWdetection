<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { IconArrowLeft } from '@tabler/icons-vue'
import ProblemDiagnosisDialog from '@/components/ProblemDiagnosisDialog.vue'
import {
  getMeterConfigurationContext,
  getMeterConfigurationReturnQuery,
} from '@/router/meterConfigurationContext'
import { meterTemplateOptions, addMeterTemplate, findMeterTemplateByName } from '@/state/meterTemplates'
import {
  applyDiagnosisMockAction,
  buildAbnormalDiagnosisReport,
  type DiagnosisIssue,
  type DiagnosisReport,
} from '@/state/preflightChecks'

const router = useRouter()
const route = useRoute()

const newTemplateName = ref('')
const diagnosisOpen = ref(false)
const diagnosisReport = ref<DiagnosisReport | null>(null)

function goBack() {
  if (route.query.from === 'wizard') {
    router.push({
      name: 'meter-template-validation',
      query: {
        ...getMeterConfigurationContext(route.query),
        resumeWizard: '1',
      },
    })
  } else {
    router.push({
      name: 'meter-configuration-home',
      query: getMeterConfigurationReturnQuery(route.query),
    })
  }
}

function submitNewTemplate() {
  const name = newTemplateName.value.trim()
  if (!name || findMeterTemplateByName(name)) {
    ElMessage.warning('请输入模板名称，且勿与已有模板重复')
    return
  }
  diagnosisReport.value = buildAbnormalDiagnosisReport('template-missing')
  diagnosisOpen.value = true
}

function finishCreate() {
  const created = addMeterTemplate(newTemplateName.value)
  if (!created) {
    ElMessage.warning('请输入模板名称，且勿与已有模板重复')
    return
  }
  newTemplateName.value = ''
  ElMessage.success('模板已创建，可在「新建表计模板 & 验证」向导中选择')
}

function handleDiagnosisAction(actionKey: string, _issue: DiagnosisIssue) {
  applyDiagnosisMockAction(actionKey)
  if (actionKey === 'upload-template') {
    ElMessage.success('模板文件已完成 mock 上传')
    finishCreate()
  }
}
</script>

<template>
  <div class="dw-page-bg">
    <div class="dw-page-artwork" aria-hidden="true" />
    <div class="dw-page-scrim" aria-hidden="true" />
    <div class="dw-shell mts-shell">
      <header class="mts-head">
        <button type="button" class="mts-back dw-caption" @click="goBack">
          <IconArrowLeft :size="16" stroke="1.75" />
          <span>返回表计模板 &amp; 验证</span>
        </button>
      </header>

      <main class="mts-board dw-panel dw-panel--dense dw-panel--chrome">
        <h1 class="mts-title">表计模板设置</h1>
        <p class="mts-muted dw-caption">
          在此新建的模板会出现在「新建表计模板 &amp; 验证」第一步的下拉列表中。
        </p>

        <section class="mts-create">
          <h2 class="mts-h2 dw-caption">新建模板</h2>
          <div class="mts-create-row">
            <el-input
              v-model="newTemplateName"
              placeholder="输入模板名称，例如：压力表-110kV变电站"
              clearable
              class="mts-create-input"
              @keyup.enter="submitNewTemplate"
            />
            <el-button type="primary" @click="submitNewTemplate">创建</el-button>
          </div>
        </section>

        <section class="mts-list">
          <h2 class="mts-h2 dw-caption">已有模板（{{ meterTemplateOptions.length }}）</h2>
          <ul class="mts-ul dw-caption">
            <li v-for="t in meterTemplateOptions" :key="t.id" class="mts-li">
              {{ t.name }}
            </li>
          </ul>
        </section>
      </main>
      <ProblemDiagnosisDialog
        v-model="diagnosisOpen"
        :report="diagnosisReport"
        @continue="diagnosisOpen = false"
        @action="handleDiagnosisAction"
      />
    </div>
  </div>
</template>

<style scoped>
.mts-shell {
  padding: 20px;
  box-sizing: border-box;
  max-width: 100%;
}

.mts-head {
  margin-bottom: 16px;
}

.mts-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--el-text-color-primary);
}

.mts-back:hover {
  color: var(--el-color-primary);
}

.mts-board {
  max-width: 720px;
  padding: 24px 28px 32px;
  box-sizing: border-box;
}

.mts-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--el-text-color-primary);
}

.mts-muted {
  margin: 0 0 28px;
  color: var(--el-text-color-secondary);
}

.mts-h2 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.mts-create {
  margin-bottom: 28px;
}

.mts-create-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.mts-create-input {
  flex: 1;
  min-width: 220px;
}

.mts-list {
  padding-top: 8px;
}

.mts-ul {
  margin: 0;
  padding-left: 1.2em;
  color: var(--el-text-color-regular);
}

.mts-li {
  margin-bottom: 6px;
}
</style>
