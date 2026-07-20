# DW Detection v1.1.7 交互原型

基于 Vue 3、TypeScript、Element Plus 的前端交互原型，覆盖推理、数据集标注、训练、部署、表计模板配置与验证流程。当前版本使用前端 Mock 和 `sessionStorage`，不连接真实算法或训练服务。

## 研发入口

- [研发交付说明](./DELIVERY.md)
- [v1.1.7 设计说明](./docs/DWdetection-v1.1.7-design-handoff.md)
- [单文件离线预览](./deliverables/DWdetection-v1.1.7-preview.html)

## 本地运行

```bash
npm ci
npm run dev
```

默认访问 `http://127.0.0.1:5173/#/`。如端口被占用，以 Vite 输出地址为准。

## 校验与构建

```bash
npx vue-tsc --noEmit
npm run build
npm run build:standalone
```

`build:standalone` 会更新 `deliverables/DWdetection-v1.1.7-preview.html`，该文件可直接双击打开，无需安装依赖或启动服务。

## 主要路由

| 路由 | 页面 |
| --- | --- |
| `#/` | 推理首页 |
| `#/algorithms/:id` | 算法详情与快速检测 |
| `#/annotation` | 标注数据集列表 |
| `#/annotation/:datasetId` | 标注工具 |
| `#/training` | 训练列表 |
| `#/meter-template-validation` | 表计模板与验证 |
| `#/meter-template-configuration` | 指针模板配置与四步指引 |

## 技术约束

- 业务图标统一使用 `@tabler/icons-vue`。
- 颜色、面板、弹窗尺寸优先使用 `src/design-tokens.ts` 和 Element Plus CSS 变量。
- 毛玻璃主要用于弹窗、浮层和工具面板，不作为所有页面区块的默认容器。
- 当前行为均为原型 Mock，接入真实接口前请先阅读 `DELIVERY.md` 中的替换边界。
