<template>
  <a-layout class="basic-layout" :class="{ 'is-home': isHomePage }">
    <!-- 顶部导航栏 -->
    <GlobalHeader />

    <!-- 主要内容区域 -->
    <a-layout-content class="main-content" :class="{ 'home-content': isHomePage }">
      <router-view />
    </a-layout-content>

    <!-- 底部版权信息 -->
    <GlobalFooter />
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

const route = useRoute()
const isHomePage = computed(() => route.path === '/')
</script>

<style scoped>
.basic-layout {
  background: none;
  min-height: 100vh;
}

.basic-layout.is-home {
  background: transparent;
}

.main-content {
  width: 1200px;
  padding: 24px;
  background: white;
  margin: 16px auto 56px;
  min-height: calc(100vh - 200px);
}

.main-content.home-content {
  background: transparent;
  padding: 0;
  margin: 0;
  max-width: 100%;
  width: 100%;
}
</style>
