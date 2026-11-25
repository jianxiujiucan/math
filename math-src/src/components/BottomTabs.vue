<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import homeIcon from "@/assets/img/icon/home.svg";
import rankingIcon from "@/assets/img/icon/ranking.svg";
import profileIcon from "@/assets/img/icon/profile.svg";

const route = useRoute();
const tabs = [
  { key: "home", label: "首页", to: "/setup", icon: homeIcon },
  { key: "leaderboard", label: "排行", to: "/leaderboard", icon: rankingIcon },
  { key: "profile", label: "我的", to: "/profile", icon: profileIcon },
];

// 个人中心详情页与答题流程分别归入“我的”和“首页”。
const active = computed(() => {
  if (route.path.startsWith("/leaderboard")) return "leaderboard";
  if (route.path.startsWith("/profile")) return "profile";
  if (
    route.path === "/" ||
    route.path.startsWith("/setup") ||
    route.path.startsWith("/quiz")
  )
    return "home";
  return "";
});
</script>

<template>
  <nav class="bottom-tabs" aria-label="主导航">
    <router-link
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="tab"
      :class="{ active: active === tab.key }"
      :aria-label="tab.label"
      :title="tab.label"
    >
      <img class="tab-icon" :src="tab.icon" :alt="tab.label" />
    </router-link>
  </nav>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.bottom-tabs {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  width: 100%;
  max-width: 3.75rem;
  border-top: 0.01rem solid rgba(63, 115, 146, 0.08);
  background: var(--m-cream);
  box-shadow: 0 -0.04rem 0.16rem rgba(51, 71, 91, 0.06);
}

.tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0.08rem 0;
  text-decoration: none;
}

.tab-icon {
  display: block;
  box-sizing: content-box;
  width: 0.3rem;
  height: 0.3rem;
  padding: 0.05rem;
  border-radius: 50%;
  opacity: 0.45;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.tab.active .tab-icon {
  background: var(--m-primary-light);
  opacity: 1;
}

@media (min-width: 520px) {
  .bottom-tabs {
    max-width: 4.3rem;
  }
}
</style>
