import { figmaAssets } from '@/assets/figma'

export type AnnotationGuideKey =
  | 'general'
  | 'pointer-meter'
  | 'digital-meter'
  | 'liquid-level'
  | 'state-recognition'
  | 'defect-recognition'

export type AnnotationGuideExample = {
  image: string
  title: string
  description: string
}

export type AnnotationGuideExamplePage = {
  displayMode?: 'comparison' | 'good-only'
  goodExample: AnnotationGuideExample
  badExample?: AnnotationGuideExample
  tips: string[]
}

export type AnnotationGuide = {
  analysisType: AnnotationGuideKey
  guideTitle: string
  goodExample: AnnotationGuideExample
  badExample: AnnotationGuideExample
  tips: string[]
  additionalExamples?: AnnotationGuideExamplePage[]
}

export const annotationGuideMap: Record<AnnotationGuideKey, AnnotationGuide> = {
  general: {
    analysisType: 'general',
    guideTitle: '通用标注参照',
    goodExample: {
      image: figmaAssets.taskThumbnailDefault,
      title: '目标边缘完整覆盖',
      description: '框选目标完整区域，边缘留出少量安全边距。',
    },
    badExample: {
      image: figmaAssets.taskThumbnailGauge,
      title: '框选范围过小',
      description: '目标边缘被截断，后续训练容易学习到错误特征。',
    },
    tips: ['优先框选可见主体，不把无关背景框进来。', '多个目标应拆成多个独立标注。'],
  },
  'pointer-meter': {
    analysisType: 'pointer-meter',
    guideTitle: '指针表标注参照',
    goodExample: {
      image: figmaAssets.taskThumbnailDefault,
      title: '表盘与指针完整',
      description: '表盘、指针、刻度区域应完整覆盖，避免漏出指针尖端。',
    },
    badExample: {
      image: figmaAssets.taskThumbnailGauge,
      title: '只框局部指针',
      description: '只覆盖指针局部会导致读数区域缺失。',
    },
    tips: ['表盘倾斜时仍按可见外接区域框选。', '指针和刻度可分标签标注，避免混成一个目标。'],
    additionalExamples: [
      {
        displayMode: 'good-only',
        goodExample: {
          image: figmaAssets.taskThumbnailDefault,
          title: '倾斜表盘完整覆盖',
          description: '表盘存在倾斜时，沿可见外接区域完整框选表盘、指针与刻度。',
        },
        tips: ['保留完整表盘边缘，避免因倾斜漏出角点。', '标注范围内尽量减少相邻设备和文字干扰。'],
      },
      {
        displayMode: 'good-only',
        goodExample: {
          image: figmaAssets.taskThumbnailGauge,
          title: '指针与刻度分别标注',
          description: '按标签配置分别框选指针和有效刻度区域，保证目标关系清晰。',
        },
        tips: ['细长指针应覆盖首尾端点。', '刻度区域应包含读数所需的完整量程。'],
      },
      {
        displayMode: 'good-only',
        goodExample: {
          image: figmaAssets.taskThumbnailDefault,
          title: '远景表计保持完整',
          description: '远景样本仍需完整覆盖可辨识表盘，不因目标较小而仅框选局部。',
        },
        tips: ['目标过小时优先确认图像清晰度。', '同一画面存在多个表计时逐个标注。'],
      },
    ],
  },
  'digital-meter': {
    analysisType: 'digital-meter',
    guideTitle: '数字表标注参照',
    goodExample: {
      image: figmaAssets.taskThumbnailGauge,
      title: '读数窗口完整',
      description: '框选完整数字显示区域，包含全部有效字符。',
    },
    badExample: {
      image: figmaAssets.taskThumbnailDefault,
      title: '截断首尾数字',
      description: '数字左右边缘缺失会影响识别位数和读数精度。',
    },
    tips: ['反光区域不单独扩框，保持读数窗口边界清晰。', '无效单位文字不要混入读数区域。'],
  },
  'liquid-level': {
    analysisType: 'liquid-level',
    guideTitle: '液位表标注参照',
    goodExample: {
      image: figmaAssets.sidebarAlgorithmPreview,
      title: '液位线清晰覆盖',
      description: '框选液位线和刻度参照区域，保证上下边界完整。',
    },
    badExample: {
      image: figmaAssets.taskThumbnailGauge,
      title: '只标局部液面',
      description: '只标液面局部会丢失刻度参照，影响液位判断。',
    },
    tips: ['透明管边缘和液位线需保持相对位置完整。', '遮挡严重样本先标注可见区域并复核。'],
  },
  'state-recognition': {
    analysisType: 'state-recognition',
    guideTitle: '状态识别标注参照',
    goodExample: {
      image: figmaAssets.algorithmHelmet,
      title: '状态主体完整',
      description: '框选能判断状态的完整主体，安全帽与人员头部都应覆盖。',
    },
    badExample: {
      image: figmaAssets.algorithmVideo,
      title: '缺少关键状态信息',
      description: '只框局部人体或背景，无法支撑状态判断。',
    },
    tips: ['状态类标签需要覆盖可判断状态的关键区域。', '同一画面多个人员应分别标注。'],
    additionalExamples: [
      {
        goodExample: {
          image: figmaAssets.algorithmHelmet,
          title: '单人目标独立框选',
          description: '每个人员及其关键状态区域使用独立标注框，标签关系清晰。',
        },
        badExample: {
          image: figmaAssets.algorithmVideo,
          title: '多人合并为一个目标',
          description: '将多个人员合并框选会造成状态标签归属不明确。',
        },
        tips: ['画面中存在多个人员时逐个标注。', '遮挡目标只框选可判断状态的可见区域。'],
      },
      {
        goodExample: {
          image: figmaAssets.algorithmHelmet,
          title: '关键状态特征清晰',
          description: '框内保留安全帽、头部与必要的人体关系，便于判断佩戴状态。',
        },
        badExample: {
          image: figmaAssets.algorithmSample,
          title: '无关背景占比过大',
          description: '框内背景过多会削弱安全帽与人员关系特征。',
        },
        tips: ['标注框贴合目标主体并保留少量边缘。', '无法判断状态的模糊样本应进入复核。'],
      },
    ],
  },
  'defect-recognition': {
    analysisType: 'defect-recognition',
    guideTitle: '缺陷识别标注参照',
    goodExample: {
      image: figmaAssets.algorithmSample,
      title: '缺陷边界完整',
      description: '框选缺陷真实范围，尽量贴合锈蚀、裂纹或污渍边缘。',
    },
    badExample: {
      image: figmaAssets.taskThumbnailGauge,
      title: '背景占比过大',
      description: '框内包含大量无关背景，会稀释缺陷特征。',
    },
    tips: ['缺陷较长时按完整缺陷外接框标注。', '相互分离的缺陷应拆开标注。'],
  },
}

export const annotationGuideList = Object.values(annotationGuideMap)

export function getGuideKeyByAnalysisType(analysisTypeId: string): AnnotationGuideKey {
  if (analysisTypeId === 'meter-reading') return 'pointer-meter'
  if (analysisTypeId === 'helmet-state') return 'state-recognition'
  if (analysisTypeId === 'defect') return 'defect-recognition'
  return 'general'
}
