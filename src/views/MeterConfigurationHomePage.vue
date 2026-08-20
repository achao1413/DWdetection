<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconArrowLeft,
  IconChevronRight,
  IconGauge,
  IconMapPin,
  IconPlus,
  IconRoute,
} from '@tabler/icons-vue'
import DwAppShell from '@/components/DwAppShell.vue'
import {
  getMeterConfigurationContext,
  getMeterConfigurationReturnQuery,
} from '@/router/meterConfigurationContext'

const route = useRoute()
const router = useRouter()

const activeArea = computed(() => route.query.area === 'point-sync' ? 'point-sync' : 'overview')

function openTemplateValidation() {
  router.push({
    name: 'meter-template-validation',
    query: getMeterConfigurationContext(route.query),
  })
}

function createPointerTemplate() {
  router.push({
    name: 'meter-template-configuration',
    query: getMeterConfigurationContext(route.query),
  })
}

function openPointSync() {
  router.push({
    name: 'meter-configuration-home',
    query: {
      ...getMeterConfigurationReturnQuery(route.query),
      area: 'point-sync',
    },
  })
}

function backToOverview() {
  router.push({
    name: 'meter-configuration-home',
    query: getMeterConfigurationReturnQuery(route.query),
  })
}

watch(
  () => route.query.source,
  (source) => {
    if (source !== 'model-validation') return
    router.replace({
      name: 'meter-template-validation',
      query: getMeterConfigurationContext(route.query),
    })
  },
  { immediate: true },
)
</script>

<template>
  <DwAppShell>
    <div class="meter-hub dw-ops-surface">
      <template v-if="activeArea === 'overview'">
        <header class="meter-hub__heading">
          <div>
            <h1>表计配置</h1>
            <p>集中管理表计模板、模型验证与巡检点位同步。</p>
          </div>
        </header>

        <section class="meter-hub__modules" aria-label="表计配置功能">
          <article class="meter-hub__module">
            <div class="meter-hub__module-icon" aria-hidden="true">
              <IconGauge :size="22" stroke="1.8" />
            </div>
            <div class="meter-hub__module-copy">
              <h2>表计模板配置</h2>
              <p>管理表计模板与验证集，完成模板配置和模型版本验证。</p>
            </div>
            <div class="meter-hub__module-actions">
              <el-button class="dw-ops-secondary" @click="createPointerTemplate">
                <span class="dw-btn-inner"><IconPlus :size="17" />新建指针模板</span>
              </el-button>
              <el-button type="primary" @click="openTemplateValidation">
                <span class="dw-btn-inner">进入模板管理<IconChevronRight :size="17" /></span>
              </el-button>
            </div>
          </article>

          <article class="meter-hub__module">
            <div class="meter-hub__module-icon" aria-hidden="true">
              <IconMapPin :size="22" stroke="1.8" />
            </div>
            <div class="meter-hub__module-copy">
              <h2>点位同步</h2>
              <p>查看表计配置与巡检点位的同步状态，统一管理同步记录。</p>
            </div>
            <div class="meter-hub__module-actions">
              <el-button type="primary" @click="openPointSync">
                <span class="dw-btn-inner">进入点位同步<IconChevronRight :size="17" /></span>
              </el-button>
            </div>
          </article>
        </section>
      </template>

      <template v-else>
        <header class="meter-hub__heading meter-hub__heading--subpage">
          <button type="button" class="meter-hub__back" @click="backToOverview">
            <IconArrowLeft :size="17" stroke="1.8" />
            返回表计配置
          </button>
          <div>
            <h1>点位同步</h1>
            <p>管理表计配置与巡检点位之间的同步记录。</p>
          </div>
        </header>

        <section class="meter-hub__empty" aria-label="点位同步记录">
          <IconRoute :size="32" stroke="1.5" />
          <strong>暂无点位同步记录</strong>
          <span>同步任务将在这里集中展示。</span>
        </section>
      </template>
    </div>
  </DwAppShell>
</template>

<style scoped>
.meter-hub {
  width: min(1184px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: 0 2px;
  overflow: hidden;
}

.meter-hub__heading {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meter-hub__heading--subpage {
  justify-content: flex-start;
  gap: 28px;
}

.meter-hub__heading h1,
.meter-hub__module h2,
.meter-hub__heading p,
.meter-hub__module p {
  margin: 0;
}

.meter-hub__heading h1 {
  color: var(--el-text-color-primary);
  font-size: 22px;
  line-height: 1.4;
}

.meter-hub__heading p,
.meter-hub__module p,
.meter-hub__empty span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.meter-hub__modules {
  border-top: 1px solid var(--el-border-color);
}

.meter-hub__module {
  min-height: 132px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 18px 20px;
  box-sizing: border-box;
  background: var(--el-fill-color-blank);
}

.meter-hub__module:nth-child(even) {
  background: var(--el-fill-color-light);
}

.meter-hub__module-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}

.meter-hub__module-copy {
  min-width: 0;
}

.meter-hub__module h2 {
  margin-bottom: 7px;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.meter-hub__module-actions {
  display: flex;
  align-items: center;
  gap: var(--dw-button-group-gap, 8px);
}

.meter-hub__back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.meter-hub__back:hover {
  color: var(--el-color-primary);
}

.meter-hub__empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-blank);
}

.meter-hub__empty strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

@media (max-width: 760px) {
  .meter-hub__module {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .meter-hub__module-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
