<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconFileTypePdf,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import {
  annotationGuideMap,
  type AnnotationGuideExamplePage,
  type AnnotationGuideKey,
} from '@/state/annotationGuides'

const route = useRoute()
const router = useRouter()
const pageIndex = ref(0)

function isGuideKey(value: unknown): value is AnnotationGuideKey {
  return typeof value === 'string' && value in annotationGuideMap
}

const guideKey = computed<AnnotationGuideKey>(() => {
  const value = route.query.type
  return isGuideKey(value) ? value : 'general'
})
const guide = computed(() => annotationGuideMap[guideKey.value])
const pages = computed<AnnotationGuideExamplePage[]>(() => [
  {
    displayMode: 'comparison',
    goodExample: guide.value.goodExample,
    badExample: guide.value.badExample,
    tips: guide.value.tips,
  },
  ...(guide.value.additionalExamples ?? []),
])
const currentPage = computed(() => pages.value[pageIndex.value] ?? pages.value[0])

watch(guideKey, () => {
  pageIndex.value = 0
})

function previousPage() {
  pageIndex.value = Math.max(0, pageIndex.value - 1)
}

function nextPage() {
  pageIndex.value = Math.min(pages.value.length - 1, pageIndex.value + 1)
}
</script>

<template>
  <DwAppShell>
    <section class="dw-guide-document">
      <header class="dw-guide-document__toolbar dw-ops-surface">
        <button type="button" aria-label="返回标注工具" @click="router.back()">
          <IconArrowLeft :size="18" />
        </button>
        <IconFileTypePdf :size="20" class="dw-guide-document__pdf-icon" />
        <div>
          <strong>{{ guide.guideTitle }}完整说明</strong>
          <span>标注规范说明.pdf</span>
        </div>
        <nav aria-label="PDF 页码">
          <button type="button" aria-label="上一页" :disabled="pageIndex === 0" @click="previousPage">
            <IconChevronLeft :size="17" />
          </button>
          <span>{{ pageIndex + 1 }} / {{ pages.length }}</span>
          <button type="button" aria-label="下一页" :disabled="pageIndex === pages.length - 1" @click="nextPage">
            <IconChevronRight :size="17" />
          </button>
        </nav>
      </header>

      <main class="dw-guide-document__viewport">
        <article class="dw-guide-document__page">
          <header>
            <span>DW Detection 标注规范</span>
            <strong>{{ guide.guideTitle }}</strong>
            <small>示例 {{ pageIndex + 1 }}</small>
          </header>

          <div
            class="dw-guide-document__examples"
            :class="{ 'is-good-only': currentPage.displayMode === 'good-only' }"
          >
            <section>
              <el-tag type="success" effect="dark">正确示例</el-tag>
              <img :src="currentPage.goodExample.image" :alt="currentPage.goodExample.title" />
              <h2>{{ currentPage.goodExample.title }}</h2>
              <p>{{ currentPage.goodExample.description }}</p>
            </section>
            <section v-if="currentPage.badExample">
              <el-tag type="danger" effect="dark">错误示例</el-tag>
              <img :src="currentPage.badExample.image" :alt="currentPage.badExample.title" />
              <h2>{{ currentPage.badExample.title }}</h2>
              <p>{{ currentPage.badExample.description }}</p>
            </section>
          </div>

          <div class="dw-guide-document__tips">
            <h2>标注注意事项</h2>
            <p v-for="(tip, index) in currentPage.tips" :key="tip">
              <span>{{ index + 1 }}</span>{{ tip }}
            </p>
          </div>
        </article>
      </main>
    </section>
  </DwAppShell>
</template>

<style scoped>
.dw-guide-document {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr);
  overflow: hidden;
}

.dw-guide-document__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-radius: 0;
}

.dw-guide-document__toolbar > button,
.dw-guide-document__toolbar nav button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.dw-guide-document__toolbar button:disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.dw-guide-document__pdf-icon {
  color: var(--el-color-danger);
}

.dw-guide-document__toolbar > div {
  min-width: 0;
  display: grid;
}

.dw-guide-document__toolbar strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.dw-guide-document__toolbar span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.dw-guide-document__toolbar nav {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dw-guide-document__viewport {
  min-height: 0;
  padding: 18px;
  overflow: auto;
  background: var(--el-bg-color-page);
  scrollbar-width: thin;
}

.dw-guide-document__page {
  width: min(760px, 100%);
  min-height: 920px;
  margin: 0 auto;
  padding: 42px 48px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--el-text-color-primary) 96%, var(--el-fill-color-blank));
  color: var(--el-bg-color-page);
  box-shadow: var(--el-box-shadow-dark);
}

.dw-guide-document__page > header {
  display: grid;
  gap: 8px;
  padding-bottom: 24px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-bg-color-page) 18%, transparent);
}

.dw-guide-document__page > header span,
.dw-guide-document__page > header small {
  font-size: 12px;
  opacity: 0.68;
}

.dw-guide-document__page > header strong {
  font-size: 28px;
}

.dw-guide-document__examples {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
}

.dw-guide-document__examples.is-good-only {
  grid-template-columns: 1fr;
}

.dw-guide-document__examples.is-good-only section {
  width: min(560px, 100%);
}

.dw-guide-document__examples.is-good-only img {
  aspect-ratio: 16 / 8;
}

.dw-guide-document__examples section {
  position: relative;
}

.dw-guide-document__examples :deep(.el-tag) {
  position: absolute;
  top: 10px;
  left: 10px;
}

.dw-guide-document__examples img {
  width: 100%;
  aspect-ratio: 16 / 10;
  display: block;
  object-fit: cover;
}

.dw-guide-document__page h2 {
  margin: 14px 0 6px;
  font-size: 17px;
}

.dw-guide-document__page p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}

.dw-guide-document__tips {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid color-mix(in srgb, var(--el-bg-color-page) 18%, transparent);
}

.dw-guide-document__tips p {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
}

.dw-guide-document__tips p span {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--el-text-color-primary);
  font-size: 11px;
}

@media (max-width: 760px) {
  .dw-guide-document__page {
    min-height: 760px;
    padding: 28px 24px;
  }

  .dw-guide-document__examples {
    grid-template-columns: 1fr;
  }
}
</style>
