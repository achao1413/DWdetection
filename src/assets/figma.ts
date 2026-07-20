/**
 * 设计稿 raster 资源本地副本（public/assets/figma）。
 * 来源：Figma DW-Detection1.1.5-v2（file veQSA3UOgDDw11eAmHVS6x），经 MCP asset URL 拉取。
 */
const base = import.meta.env.BASE_URL

export const figmaAssets = {
  /** 758:7940 Frame 5876 · 侧栏预览「image 182」 */
  sidebarAlgorithmPreview: `${base}assets/figma/sidebar-algorithm-preview.jpg`,
  /** 8146:11942 · 推理首页算法卡片：安全帽 */
  algorithmHelmet: `${base}assets/figma/algorithm-helmet.jpg`,
  /** 8146:11964 · 推理首页算法卡片：音频/雷达 */
  algorithmSound: `${base}assets/figma/algorithm-sound.jpg`,
  /** 8146:11986 · 推理首页算法卡片：样本模型 */
  algorithmSample: `${base}assets/figma/algorithm-sample.jpg`,
  /** 8146:12008 · 推理首页算法卡片：视频算法 */
  algorithmVideo: `${base}assets/figma/algorithm-video.jpg`,
  /** 1245:39218 Frame 5916 · 任务卡片缩略 Rectangle1170（列表首张同款） */
  taskThumbnailDefault: `${base}assets/figma/task-thumb-default.png`,
  /** 8146:11341 Frame 5917 · 任务卡片缩略 Rectangle1171（列表普通项） */
  taskThumbnailGauge: `${base}assets/figma/task-thumb-gauge.png`,
} as const
