<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IconChartBar, IconShieldCheck } from '@tabler/icons-vue'
import {
  recordModelValidation,
  workflowState,
  type ModelItem,
  type ModelValidationResult,
  type ModelVersion,
} from '@/state/workflow'

const props = defineProps<{
  modelValue: boolean
  model?: ModelItem
  version?: ModelVersion
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: [result: ModelValidationResult]
}>()

const validationSetId = ref('')
const validating = ref(false)
const result = ref<ModelValidationResult | null>(null)

const validationSets = computed(() => workflowState.datasets.map((dataset) => ({
  id: dataset.id,
  name: dataset.name,
  total: dataset.total,
})))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    validationSetId.value = ''
    validating.value = false
    result.value = null
  },
)

function close() {
  emit('update:modelValue', false)
}

async function startValidation() {
  if (!props.version || !validationSetId.value) {
    ElMessage.warning('请选择验证集')
    return
  }
  const validationSet = validationSets.value.find((item) => item.id === validationSetId.value)
  if (!validationSet) return

  validating.value = true
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const successRate = validationSet.id.includes('defect') ? 89.2 : 96.5
  result.value = recordModelValidation(props.version.id, {
    validationSetId: validationSet.id,
    validationSetName: validationSet.name,
    successRate,
    passed: successRate >= 90,
  })
  validating.value = false
  emit('completed', result.value)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="480px"
    align-center
    class="dw-ops-dialog model-validation-dialog"
    :close-on-click-modal="false"
    @close="close"
  >
    <template #header>
      <div class="validation-title">
        <IconShieldCheck :size="22" stroke="1.8" />
        <div>
          <h2>模型验证</h2>
          <p>{{ model?.name }} V{{ version?.versionNumber }}</p>
        </div>
      </div>
    </template>

    <div class="validation-body" v-loading="validating" element-loading-text="正在验证模型效果">
      <template v-if="!result">
        <label class="validation-field">
          <span>模型</span>
          <el-input :model-value="`${model?.name ?? '--'} V${version?.versionNumber ?? '--'}`" disabled />
        </label>
        <label class="validation-field">
          <span>验证集</span>
          <el-select v-model="validationSetId" placeholder="请选择验证集">
            <el-option
              v-for="item in validationSets"
              :key="item.id"
              :label="`${item.name}（${item.total} 张）`"
              :value="item.id"
            />
          </el-select>
        </label>
      </template>

      <section v-else class="validation-result">
        <IconChartBar :size="28" stroke="1.7" />
        <div>
          <span>验证成功率</span>
          <strong>{{ result.successRate.toFixed(1) }}%</strong>
        </div>
        <el-tag :type="result.passed ? 'success' : 'danger'" size="large">
          {{ result.passed ? '通过' : '不通过' }}
        </el-tag>
      </section>
    </div>

    <template #footer>
      <div class="validation-footer">
        <el-button @click="close">{{ result ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!result" type="primary" :loading="validating" @click="startValidation">开始验证</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.validation-title,
.validation-footer,
.validation-result {
  display: flex;
  align-items: center;
}

.validation-title {
  gap: 12px;
}

.validation-title h2,
.validation-title p {
  margin: 0;
}

.validation-title h2 {
  color: var(--el-text-color-primary);
  font-size: 18px;
}

.validation-title p {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.validation-body {
  min-height: 176px;
}

.validation-field {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.validation-field :deep(.el-select) {
  width: 100%;
}

.validation-result {
  min-height: 152px;
  gap: 18px;
  padding: 20px;
  border-radius: var(--el-border-radius-base);
  background: color-mix(in srgb, var(--el-color-success) 10%, var(--el-fill-color-light));
  box-sizing: border-box;
}

.validation-result > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.validation-result span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.validation-result strong {
  color: var(--el-text-color-primary);
  font-size: 30px;
}

.validation-footer {
  justify-content: flex-end;
  gap: var(--dw-button-group-gap, 8px);
}
</style>
