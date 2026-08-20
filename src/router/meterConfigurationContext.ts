import type { LocationQuery, LocationQueryRaw } from 'vue-router'

const meterConfigurationContextKeys = [
  'modelId',
  'modelName',
  'versionId',
  'versionName',
  'source',
  'algorithmId',
] as const

export function getMeterConfigurationContext(query: LocationQuery): LocationQueryRaw {
  return meterConfigurationContextKeys.reduce<LocationQueryRaw>((result, key) => {
    const value = query[key]
    const normalized = Array.isArray(value) ? value[0] : value
    if (normalized != null && normalized !== '') result[key] = normalized
    return result
  }, {})
}

export function getMeterConfigurationReturnQuery(query: LocationQuery): LocationQueryRaw {
  const context = getMeterConfigurationContext(query)
  delete context.source
  return context
}
