import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'inference-home',
    component: () => import('@/views/InferenceHomePage.vue'),
    meta: { title: '算法训练工具' },
  },
  {
    path: '/algorithms/:id',
    name: 'algorithm-detail',
    component: () => import('@/views/AlgorithmDetailPage.vue'),
    meta: { title: '查看详情' },
  },
  {
    path: '/annotation',
    name: 'annotation-list',
    component: () => import('@/views/AnnotationListPage.vue'),
    meta: { title: '标注' },
  },
  {
    path: '/annotation-guide',
    name: 'annotation-guide-document',
    component: () => import('@/views/AnnotationGuideDocumentPage.vue'),
    meta: { title: '标注规范说明' },
  },
  {
    path: '/annotation/:datasetId',
    name: 'annotation-tool',
    component: () => import('@/views/AnnotationToolPage.vue'),
    meta: { title: '标注工具' },
  },
  {
    path: '/training',
    name: 'training-list',
    component: () => import('@/views/TrainingPage.vue'),
    meta: { title: '训练' },
  },
  {
    path: '/meter-template-validation',
    name: 'meter-template-validation',
    component: () => import('@/views/MeterTemplateValidationPage.vue'),
    meta: { title: '表计模板 & 验证' },
  },
  {
    path: '/meter-template-settings',
    name: 'meter-template-settings',
    component: () => import('@/views/MeterTemplateSettingsPage.vue'),
    meta: { title: '表计模板设置' },
  },
  {
    path: '/meter-template-configuration',
    name: 'meter-template-configuration',
    component: () => import('@/views/MeterTemplateConfigurationPage.vue'),
    meta: { title: '表计模板配置' },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
