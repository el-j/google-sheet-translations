<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'

const { site } = useData()
const isPreview = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.pathname.includes('/next/') || site.value.base.includes('/next/')
  }
  return site.value.base.includes('/next/')
})

const STABLE_URL = 'https://el-j.github.io/google-sheet-translations/'

function goToStable(event: MouseEvent) {
  event.preventDefault()
  if (typeof window !== 'undefined') {
    window.location.assign(STABLE_URL)
  }
}

onMounted(() => {
  if (isPreview.value) {
    document.documentElement.classList.add('has-preview-banner')
    document.documentElement.style.setProperty('--vp-layout-top-height', '40px')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('has-preview-banner')
  document.documentElement.style.removeProperty('--vp-layout-top-height')
})
</script>

<template>
  <div v-if="isPreview" class="v3-preview-banner vp-raw">
    <div class="v3-preview-banner__content">
      <span class="v3-preview-badge">v3-beta Preview</span>
      <span class="v3-preview-text">
        You are browsing the preview documentation for <strong>v3.0 (Beta)</strong>.
      </span>
      <a
        :href="STABLE_URL"
        target="_self"
        rel="noreferrer"
        class="v3-preview-link"
        @click="goToStable"
      >
        Switch to Stable (v2.2.0) →
      </a>
    </div>
  </div>
</template>

<style scoped>
.v3-preview-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  border-bottom: 1px solid rgba(14, 165, 233, 0.35);
  padding: 0 16px;
  font-size: 13px;
  color: #e2e8f0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.v3-preview-banner__content {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.v3-preview-badge {
  background: #0284c7;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.v3-preview-text {
  color: #cbd5e1;
}

.v3-preview-link {
  color: #38bdf8;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.v3-preview-link:hover {
  color: #7dd3fc;
}
</style>
