import type { ModelItem, ModelVersion } from '@/state/workflow'

export function downloadModelVersionMock(model: ModelItem, version: ModelVersion) {
  const payload = {
    model: { id: model.id, name: model.name },
    version: {
      id: version.id,
      name: `V${version.versionNumber}`,
      dataset: version.datasetName,
      datasetLabelType: version.datasetLabelType,
      baseModel: version.baseModel,
      trainingMethod: version.trainingMethod,
      parameters: version.parameters,
      releaseRole: version.releaseRole,
      publishedAt: version.publishedAt,
    },
    prototypeNote: 'DW Detection v1.1.7 模型下载 Mock',
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${model.name}-V${version.versionNumber}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
