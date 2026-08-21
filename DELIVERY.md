# DW Detection v1.1.7 研发交付说明

## 交付物

| 内容 | 用途 |
| --- | --- |
| `src/`、`public/`、工程配置 | 可继续开发的 Vue 3 源码 |
| `docs/DWdetection-v1.1.7-design-handoff.md` | 设计规范、页面状态与交互验收依据 |
| `deliverables/DWdetection-v1.1.7-preview.html` | 无服务依赖的单文件演示 |
| `deliverables/DWdetection-v1.1.7-preview-20260821.html` | 2026-08-21 最新设计留存快照 |
| `release/DWdetection-v1.1.7-frontend-handoff.zip` | 源码、构建产物、文档的整包交付 |
| `release/SHA256SUMS.txt` | 交付包完整性校验 |

## 环境与命令

- 建议 Node.js 20 LTS，最低版本以 Vite 6 官方要求为准。
- 包管理器：npm，依赖版本以 `package-lock.json` 为准。

```bash
npm ci
npm run dev
npx vue-tsc --noEmit
npm run build
npm run build:standalone
```

## 工程结构

```text
src/
  components/              通用弹窗、质量面板、标注指引、训练表单
  components/meter-template/ 表计配置静态画布、工具栏、配置面板、指引
  state/                   工作流、质量、自检、验证、表计 Mock 状态
  views/                   各业务页面
  design-tokens.ts         DW 运营主题与弹窗尺寸规范
  router.ts                Hash 路由
public/assets/             原型图片资源
scripts/                   单文件构建脚本
```

## 当前数据流

1. 所有业务状态由 `src/state/workflow.ts` 统一提供，并写入 `sessionStorage`。
2. 样本质量由现有质量计算模块产生，训前自检只读取结果，不重复计算六个维度。
3. 训练、部署、验证使用短延时 Mock，部署结果按演示逻辑交替成功或失败。
4. 刷新后如需恢复初始演示数据，请清除当前站点的 `sessionStorage`。

## 后端接入替换点

| 原型模块 | 当前实现 | 后续接入建议 |
| --- | --- | --- |
| 数据集上传 | 浏览器图片列表与 Mock 元数据 | 对接图片分片上传、解析与任务进度 |
| 样本诊断 | 前端同步计算 | 后端返回质量结果和六维明细，前端只负责呈现 |
| 标注保存 | 前端更新图片和标注数组 | 对接标注版本、冲突控制和批量保存 |
| 训前自检 | 环境与依赖 Mock | 对接 GPU、内存、磁盘、镜像和算法包检查接口 |
| 训练 | 定时状态流转 | 对接训练任务创建、轮询或事件推送 |
| 部署 | 交替成功/失败 Mock | 对接部署任务、超时停止和结果通知 |
| 验证 | 固定成功率 Mock | 对接验证集运行、漏检结果和审核 |
| 表计配置 | 四步静态预设状态 | 后续单独实现真实画框、轴心、量程和保存接口 |

## 明确未实现

- 真实图像相似度、Hash 去重和模型推理。
- 真实复杂几何标注、拖拽编辑、撤销栈和多人协作。
- 真实训练、GPU 调度、镜像修复、部署和验证服务。
- 表计画布真实画框、选点、拖拽、缩放、坐标记录、角度计算、量程联动与配置保存。
- 站间数据共享仓、`.dwd` 加密解密和训练经验参数固化。
- 已取消的算法子类导入导出、`.alg` 文件及兼容性处理。

## 提交前检查

- 路由闭环可用：推理 → 详情 → 标注 → 训练 → 部署 → 推理。
- 1440×800 和矮屏下页面无非预期全局滚动，长内容在指定区域内滚动。
- 弹窗宽度与最大高度符合设计说明。
- 不提交 `node_modules/`、`.vite/`、`dist/`、本地凭据或环境文件。
