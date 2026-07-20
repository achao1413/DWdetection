/**
 * DW 设计令牌 — 由 design-tokens.md / dw-design-system.md 映射。
 * 禁止在组件中硬编码色值；页面样式请使用 CSS 变量或此处导出。
 */

export type ThemeMode = 'dw-build' | 'dw-ops' | 'patrol-demo' | 'nw-inspection'

export type SemanticScale = {
  color: string
  'color-dark-2': string
  'color-3': string
  'color-5': string
  'color-7': string
  'color-8': string
  'color-9': string
}

export type ThemeColors = {
  Primary: SemanticScale
  Success: SemanticScale
  Warning: SemanticScale
  Danger: SemanticScale
  Text: Record<'Primary' | 'Regular' | 'Secondary' | 'Placeholder' | 'Disabled', string>
  Border: Record<'1-Base' | '2-Dark' | '3-Darker' | '4-Darkest', string>
  Fill: Record<'1-Blank' | '2-Light' | '3-Base' | '4-Dark' | '5-Darker', string>
  Bg: Record<'1-Dark' | '2-Base' | '3-Page', string>
  Overlay: { Lighter: string }
}

const overlay = { Lighter: '#00000080' }

const darkSemantic = {
  Success: {
    color: '#69d876',
    'color-dark-2': '#7fde8a',
    'color-3': '#42c652',
    'color-5': '#359b42',
    'color-7': '#2a6d33',
    'color-8': '#1c4222',
    'color-9': '#0c190e',
  },
  Warning: {
    color: '#febe26',
    'color-dark-2': '#fec745',
    'color-3': '#e9a607',
    'color-5': '#b2810a',
    'color-7': '#7e5c0a',
    'color-8': '#4c3808',
    'color-9': '#1c1504',
  },
  Danger: {
    color: '#ff7163',
    'color-dark-2': '#ff8a7d',
    'color-3': '#f34332',
    'color-5': '#cf2a1a',
    'color-7': '#90271c',
    'color-8': '#571e19',
    'color-9': '#25100e',
  },
} satisfies Record<'Success' | 'Warning' | 'Danger', SemanticScale>

const dwPrimary: SemanticScale = {
  color: '#46a2ff',
  'color-dark-2': '#59abff',
  'color-3': '#3f92e5',
  'color-5': '#3171b3',
  'color-7': '#235180',
  'color-8': '#15314d',
  'color-9': '#071019',
}

/** DW运营面板 — Design Kit（半透明填充 / 圆角 / 模糊）；描边随当前主题的 Border 令牌走 theme.ts */
export const panelDWOps = {
  backdropBlur: '100px',
  /** rgba(71,71,71,0.3) */
  fill: 'rgba(71, 71, 71, 0.3)',
  borderRadius: '8px',
} as const

/** 与 dw-design-system.md 文档命名对齐（Design Kit 面板规范） */
export const panelDWBuild = panelDWOps

/** DW 弹窗尺寸规范：确认框与三档模态弹窗。 */
export const dialogSize = {
  confirm: '400px',
  small: '480px',
  medium: '600px',
  large: '800px',
  maxHeight: '600px',
} as const

/** DW 操作区规范：同一按钮组内的按钮间距统一为 8px。 */
export const buttonGroupGap = '8px' as const

/** DW构建（暗色实底） */
export function getDwBuildColors(): ThemeColors {
  return {
    Primary: dwPrimary,
    ...darkSemantic,
    Text: {
      Primary: '#ffffffe5',
      Regular: '#ffffffcc',
      Secondary: '#ffffffb2',
      Placeholder: '#ffffff80',
      Disabled: '#ffffff4d',
    },
    Border: {
      '1-Base': '#ffffff33',
      '2-Dark': '#ffffff4d',
      '3-Darker': '#ffffff66',
      '4-Darkest': '#ffffff99',
    },
    Fill: {
      '1-Blank': '#25262c',
      '2-Light': '#8c8c8c26',
      '3-Base': '#8c8c8c66',
      '4-Dark': '#8c8c8c99',
      '5-Darker': '#8c8c8ccc',
    },
    Bg: {
      '1-Dark': '#181818',
      '2-Base': '#25262c',
      '3-Page': '#34353e',
    },
    Overlay: overlay,
  }
}

/** DW运营（半透明暗色） */
export function getDwOpsColors(): ThemeColors {
  return {
    Primary: dwPrimary,
    ...darkSemantic,
    Text: {
      Primary: '#ffffffe5',
      Regular: '#ffffffcc',
      Secondary: '#ffffffb2',
      Placeholder: '#ffffff80',
      Disabled: '#ffffff4d',
    },
    Border: {
      '1-Base': '#ffffff33',
      '2-Dark': '#ffffff4d',
      '3-Darker': '#ffffff66',
      '4-Darkest': '#ffffff99',
    },
    Fill: {
      '1-Blank': '#4747474d',
      '2-Light': '#8c8c8c26',
      '3-Base': '#8c8c8c66',
      '4-Dark': '#8c8c8c99',
      '5-Darker': '#8c8c8ccc',
    },
    Bg: {
      '1-Dark': '#4747471a',
      '2-Base': '#4747474d',
      '3-Page': '#47474766',
    },
    Overlay: overlay,
  }
}

export function getThemeColors(mode: ThemeMode): ThemeColors {
  switch (mode) {
    case 'dw-ops':
      return getDwOpsColors()
    case 'dw-build':
      return getDwBuildColors()
    default:
      return getDwOpsColors()
  }
}

export const fontFamily = {
  primary: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  mono: `'JetBrains Mono', 'Fira Code', 'Consolas', monospace`,
} as const
