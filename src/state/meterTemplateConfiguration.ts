export type MeterTemplateStepId = 'dial' | 'center' | 'range' | 'details'

export type GuideLineDensity = 'low' | 'medium' | 'high'

export type MeterStepPhase = 'active' | 'ready' | 'confirmed'

export type NormalizedPoint = {
  x: number
  y: number
}

export type NormalizedRect = NormalizedPoint & {
  width: number
  height: number
}

export type MeterTaskStep = {
  id: MeterTemplateStepId
  title: string
  description: string
  completionHint: string
  confirmLabel?: string
}

export type MeterRangeSegment = {
  id: string
  name: string
  angle: string
  startValue: string
  endValue: string
}

export const meterTaskSteps: MeterTaskStep[] = [
  {
    id: 'dial',
    title: '表盘定位',
    description: '框选指针活动区域和完整量程刻度，排除反光、外壳及其他背景干扰。',
    completionHint: '完成有效框选后可确认当前表盘区域',
    confirmLabel: '确认表盘区域',
  },
  {
    id: 'center',
    title: '指针轴心定位',
    description: '在表盘框内点击指针旋转轴心，利用放射辅助线检查刻度对齐。',
    completionHint: '选择框内轴心后可确认当前位置',
    confirmLabel: '确认轴心位置',
  },
  {
    id: 'range',
    title: '角度和量程配置',
    description: '系统已按轴心生成预设角度与多段量程，请核对首尾刻度覆盖范围。',
    completionHint: '确认预设量程无误后进入模板信息配置',
    confirmLabel: '确认量程配置',
  },
  {
    id: 'details',
    title: '选择分析类型并完成',
    description: '在右侧填写模板名称并选择分析类型，然后点击右上角“保存”。',
    completionHint: '模板名称和分析类型均为必填项',
  },
]

export const meterRangeSegments: MeterRangeSegment[] = [
  { id: 'range-1', name: '第1段', angle: '205° - 245°', startValue: '0', endValue: '200' },
  { id: 'range-2', name: '第2段', angle: '245° - 292°', startValue: '200', endValue: '400' },
  { id: 'range-3', name: '第3段', angle: '292° - 338°', startValue: '400', endValue: '600' },
]
