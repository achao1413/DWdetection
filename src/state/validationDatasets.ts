import { reactive } from 'vue'

export interface ValidationDatasetOption {
  id: string
  name: string
  /** 演示：最近一次上传记录的图片数量 */
  uploadedCount: number
}

function newDatasetId() {
  return `vds-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 与首页演示表格中的验证集名称对齐；新建向导完成后也会登记到此列表 */
export const validationDatasetOptions = reactive<ValidationDatasetOption[]>([
  { id: 'vds-seed-001', name: '110kV-压力表验证集-V3', uploadedCount: 500 },
  { id: 'vds-seed-002', name: '园区A-水表-2025Q1', uploadedCount: 320 },
  { id: 'vds-seed-003', name: '居民-电表样本集-200', uploadedCount: 200 },
  { id: 'vds-seed-004', name: '储能站-压力表-100', uploadedCount: 100 },
  { id: 'vds-seed-005', name: '供水-水表-夜间', uploadedCount: 240 },
])

export function findValidationDatasetById(id: string) {
  return validationDatasetOptions.find((d) => d.id === id)
}

export function findValidationDatasetByName(name: string) {
  const n = name.trim()
  return validationDatasetOptions.find((d) => d.name === n)
}

/** 登记或更新验证集（同名则刷新图片数量取较大值） */
export function registerValidationDataset(name: string, uploadedCount: number): ValidationDatasetOption | null {
  const n = name.trim()
  if (!n || uploadedCount <= 0) return null
  const existing = validationDatasetOptions.find((d) => d.name === n)
  if (existing) {
    existing.uploadedCount = Math.max(existing.uploadedCount, uploadedCount)
    return existing
  }
  const item: ValidationDatasetOption = {
    id: newDatasetId(),
    name: n,
    uploadedCount,
  }
  validationDatasetOptions.push(item)
  return item
}
