import type { SemanticScale, ThemeMode } from '@/design-tokens'
import { buttonGroupGap, dialogSize, getDwBuildColors, getThemeColors, panelDWOps } from '@/design-tokens'

function applySemantic(
  root: HTMLElement,
  prefix: 'primary' | 'success' | 'warning' | 'danger',
  s: SemanticScale,
) {
  root.style.setProperty(`--el-color-${prefix}`, s.color)
  root.style.setProperty(`--el-color-${prefix}-dark-2`, s['color-dark-2'])
  root.style.setProperty(`--el-color-${prefix}-light-3`, s['color-3'])
  root.style.setProperty(`--el-color-${prefix}-light-5`, s['color-5'])
  root.style.setProperty(`--el-color-${prefix}-light-7`, s['color-7'])
  root.style.setProperty(`--el-color-${prefix}-light-8`, s['color-8'])
  root.style.setProperty(`--el-color-${prefix}-light-9`, s['color-9'])
}

/** 将当前主题写入 Element Plus CSS 变量（dw-design-system.md §8.1） */
export function applyTheme(mode: ThemeMode) {
  const c = getThemeColors(mode)
  const root = document.documentElement

  applySemantic(root, 'primary', c.Primary)
  applySemantic(root, 'success', c.Success)
  applySemantic(root, 'warning', c.Warning)
  applySemantic(root, 'danger', c.Danger)

  root.style.setProperty('--el-text-color-primary', c.Text.Primary)
  root.style.setProperty('--el-text-color-regular', c.Text.Regular)
  root.style.setProperty('--el-text-color-secondary', c.Text.Secondary)
  root.style.setProperty('--el-text-color-placeholder', c.Text.Placeholder)
  root.style.setProperty('--el-text-color-disabled', c.Text.Disabled)

  root.style.setProperty('--el-border-color', c.Border['1-Base'])
  root.style.setProperty('--el-border-color-light', c.Border['1-Base'])
  root.style.setProperty('--el-border-color-dark', c.Border['2-Dark'])
  root.style.setProperty('--el-border-color-darker', c.Border['3-Darker'])

  root.style.setProperty('--el-fill-color', c.Fill['3-Base'])
  root.style.setProperty('--el-fill-color-light', c.Fill['2-Light'])
  root.style.setProperty('--el-fill-color-dark', c.Fill['4-Dark'])
  root.style.setProperty('--el-fill-color-darker', c.Fill['5-Darker'])
  root.style.setProperty('--el-fill-color-blank', c.Fill['1-Blank'])

  root.style.setProperty('--el-bg-color', c.Bg['2-Base'])
  root.style.setProperty('--el-bg-color-page', c.Bg['3-Page'])
  root.style.setProperty('--el-bg-color-overlay', c.Bg['1-Dark'])

  root.style.setProperty('--el-overlay-color-lighter', c.Overlay.Lighter)

  /* DW Design Kit 面板变量（design-tokens.md §2.10）— 供 global.css 引用 */
  root.style.setProperty('--dw-panel-fill', panelDWOps.fill)
  root.style.setProperty('--dw-panel-blur', panelDWOps.backdropBlur)
  /* 面板外轮廓 — Border/2-Dark（设计令牌），非纯白高光边 */
  root.style.setProperty('--dw-panel-border-strong', c.Border['2-Dark'])
  root.style.setProperty('--dw-panel-radius', panelDWOps.borderRadius)
  root.style.setProperty('--dw-panel-border-muted', c.Border['1-Base'])
  root.style.setProperty('--dw-table-header-bg', getDwBuildColors().Bg['1-Dark'])
  // 密铺卡片略弱的模糊，避免整页「糊成一片」
  root.style.setProperty('--dw-panel-blur-dense', '72px')
  root.style.setProperty('--dw-dialog-size-confirm', dialogSize.confirm)
  root.style.setProperty('--dw-dialog-size-small', dialogSize.small)
  root.style.setProperty('--dw-dialog-size-medium', dialogSize.medium)
  root.style.setProperty('--dw-dialog-size-large', dialogSize.large)
  root.style.setProperty('--dw-dialog-max-height', dialogSize.maxHeight)
  root.style.setProperty('--dw-button-group-gap', buttonGroupGap)

  /**
   * 磨砂面板内缘高光 — 来自 Border/2-Dark，与设计令牌一致（不要用任意 rgba）。
   */
  root.style.setProperty(
    '--dw-outline-inner-glass',
    `color-mix(in srgb, ${c.Border['2-Dark']} 38%, transparent)`,
  )

  /* EP 弹窗默认 --el-dialog-bg-color → --el-bg-color，会把磨砂盖实；运营主题改为透明 + global.css 叠磨砂层 */
  if (mode === 'dw-ops') {
    root.style.setProperty('--el-dialog-bg-color', 'transparent')
    root.style.setProperty('--el-dialog-box-shadow', 'none')
    root.style.setProperty('--el-dialog-border-radius', panelDWOps.borderRadius)
    root.style.setProperty('--el-popup-modal-bg-color', 'rgba(3, 8, 14, 0.52)')
    root.style.setProperty('--el-popup-modal-opacity', '1')
    root.style.setProperty('--el-messagebox-box-shadow', 'none')
    root.style.setProperty('--el-messagebox-border-radius', panelDWOps.borderRadius)
  }

  root.dataset.dwTheme = mode
}
