import { reactive } from 'vue'

export interface MeterTemplateOption {
  id: string
  name: string
}

function newTemplateId() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 与演示验证配置里出现过的模板名称对齐；新建模板会 push 进同一数组 */
export const meterTemplateOptions = reactive<MeterTemplateOption[]>([
  { id: 'tpl-seed-001', name: '压力表-110kV变电站' },
  { id: 'tpl-seed-002', name: '水表-工业园区A' },
  { id: 'tpl-seed-003', name: '电表-居民配电' },
  { id: 'tpl-seed-004', name: '压力表-储能站' },
  { id: 'tpl-seed-005', name: '水表-城市供水' },
])

export function findMeterTemplateByName(name: string) {
  const n = name.trim()
  return meterTemplateOptions.find((t) => t.name === n)
}

export function findMeterTemplateById(id: string) {
  return meterTemplateOptions.find((t) => t.id === id)
}

/** 新增模板；名称重复则返回 null */
export function addMeterTemplate(name: string): MeterTemplateOption | null {
  const n = name.trim()
  if (!n) return null
  if (meterTemplateOptions.some((t) => t.name === n)) return null
  const item: MeterTemplateOption = { id: newTemplateId(), name: n }
  meterTemplateOptions.push(item)
  return item
}
