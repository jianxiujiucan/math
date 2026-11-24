<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import BottomTabs from "@/components/BottomTabs.vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const showTabs = computed(
  () => Boolean(auth.state.token) && route.name !== "quiz"
);
</script>

<template>
  <!-- 未登录时隐藏底部 Tab 栏，页面底部也不需要留位 -->
  <main class="page" :class="{ 'no-tabs': !showTabs }">
    <RouterView v-slot="{ Component }">
      <!-- 缓存答题页：答题中途跳登录/注册再回来时保留作答与结果状态 -->
      <KeepAlive include="QuizView">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </main>
  <BottomTabs v-if="showTabs" />
</template>
