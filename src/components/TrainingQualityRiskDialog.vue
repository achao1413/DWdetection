<script setup lang="ts">
import { computed } from 'vue'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-vue'
import DatasetQualityPanel from '@/components/DatasetQualityPanel.vue'
import type { DatasetItem } from '@/state/workflow'

const props = defineProps<{
  modelValue: boolean
  dataset: DatasetItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  continue: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const riskTitle = computed(() => {
  const level = props.dataset?.qualityStatus.overallLevel
  if (level === 'poor') return 'AI预警：质量风险较高，大概率返工'
  if (level === 'normal') return 'AI建议：数据集质量一般，建议优化后训练'
  return 'AI建议：数据集待评估'
})

const riskType = computed(() => (props.dataset?.qualityStatus.overallLevel === 'poor' ? 'danger' : 'warning'))
</script>

<template>
  <el-dialog v-model="visible" width="var(--dw-dialog-size-medium)" align-center append-to-body class="quality-risk-dialog">
    <template #header>
      <div class="quality-risk__title">
        <IconAlertTriangle v-if="riskType === 'danger'" :size="20" />
        <IconCircleCheck v-else :size="20" />
        <span>{{ riskTitle }}</span>
      </div>
    </template>

    <div v-if="dataset" class="quality-risk">
      <DatasetQualityPanel :dataset="dataset" />
    </div>

    <template #footer>
      <el-button @click="visible = false">返回优化</el-button>
      <el-button :type="riskType === 'danger' ? 'danger' : 'warning'" @click="emit('continue')">
        {{ dataset?.qualityStatus.overallLevel === 'poor' ? '确认风险并继续' : '继续训练' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.quality-risk__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.quality-risk {
  display: grid;
  gap: 14px;
}
</style>
