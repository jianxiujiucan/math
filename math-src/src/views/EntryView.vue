<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import LoginForm from "@/components/LoginForm.vue";
import RegisterForm from "@/components/RegisterForm.vue";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const tab = ref<"login" | "register">(
  route.query.tab === "register" ? "register" : "login"
);

// 已登录用户不再停留欢迎页，统一进入答题设置；保留成绩保存后的回跳。
watch(
  () => auth.state.user,
  (user) => {
    if (!user) return;
    const redirect =
      typeof route.query.redirect === "string"
        ? route.query.redirect
        : "/setup";
    void router.replace(redirect);
  },
  { immediate: true }
);

function switchTab(t: "login" | "register") {
  tab.value = t;
  router.replace({
    query: { ...route.query, tab: t === "login" ? undefined : "register" },
  });
}
</script>

<template>
  <header class="entry-hero">
    <div class="brand-copy">
      <p class="brand-kicker">DAILY MATH</p>
      <h1>速算挑战</h1>
      <p class="brand-slogan">让每一次计算，都有新收获</p>
    </div>
    <div class="math-decor" aria-hidden="true">
      <span class="math-badge number">7</span>
      <span class="math-badge plus">+</span>
      <span class="math-badge divide">÷</span>
    </div>
  </header>

  <div v-if="!auth.state.user" class="login">
      <div class="entry-heading">
        <h2>{{ tab === "login" ? "欢迎回来" : "创建账号" }}</h2>
        <p>
          {{
            tab === "login"
              ? "登录后继续你的练习之旅"
              : "保存成绩，和朋友一起挑战排行榜"
          }}
        </p>
      </div>
      <div class="auth-tabs">
        <button
          type="button"
          class="auth-tab"
          :class="{ active: tab === 'login' }"
          @click="switchTab('login')"
        >
          登录
        </button>
        <button
          type="button"
          class="auth-tab"
          :class="{ active: tab === 'register' }"
          @click="switchTab('register')"
        >
          注册
        </button>
      </div>
      <LoginForm v-if="tab === 'login'" @switch="switchTab('register')" />
      <RegisterForm v-else @switch="switchTab('login')" />
  </div>

  <div v-if="!auth.state.user" class="guest-row">
    <button class="link-btn guest-btn" @click="router.push('/setup')">
      访客模式，先试一试
    </button>
  </div>
  <p class="entry-footer">适合小学一、二年级 · 每天进步一点点</p>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.entry-hero {
  position: relative;
  min-height: 1.86rem;
  padding: 0.34rem 0.04rem 0.2rem;
}

.brand-kicker,
.eyebrow {
  color: $primary;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.1rem;
  font-weight: 700;
  letter-spacing: 0.12rem;
}

.brand-kicker {
  margin-bottom: 0.06rem;
}

.brand-copy h1 {
  margin: 0;
  color: $text-main;
  font-size: 0.34rem;
  line-height: 1.3;
  text-align: left;
}

.brand-slogan {
  margin-top: 0.08rem;
  color: $text-sub;
  font-size: 0.13rem;
}

.math-decor {
  position: absolute;
  top: 0.26rem;
  right: 0.02rem;
  width: 1.16rem;
  height: 1.16rem;
}

.math-badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: Inter, Arial, sans-serif;
  font-weight: 700;
  box-shadow: 0 0.06rem 0.14rem rgba(51, 71, 91, 0.06);

  &.number {
    top: 0;
    right: 0;
    width: 0.58rem;
    height: 0.58rem;
    background: var(--m-cream);
    color: $primary;
    font-size: 0.25rem;
    transform: rotate(8deg);
  }

  &.plus,
  &.divide {
    bottom: 0.08rem;
    width: 0.42rem;
    height: 0.42rem;
    font-size: 0.18rem;
  }

  &.plus {
    left: 0;
    background: #f7e7ed;
    color: #a5677e;
    transform: rotate(-8deg);
  }

  &.divide {
    right: 0;
    background: #fff;
    color: $primary;
    transform: rotate(7deg);
  }
}

.hero-equation {
  display: flex;
  width: max-content;
  margin-top: 0.18rem;
  padding: 0.09rem 0.16rem;
  border-radius: 0.2rem;
  background: var(--m-cream);
  color: $primary;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.15rem;
  font-weight: 700;
}

.login {
  display: flex;
  flex-direction: column;
  padding: 0.24rem;
  border-radius: 0.08rem;
  background: var(--m-cream);
  box-shadow: var(--m-card-shadow);
}

.entry-heading {
  margin-bottom: 0.16rem;

  .eyebrow {
    margin-bottom: 0.04rem;
    font-size: 0.09rem;
  }

  h2 {
    color: $text-main;
    font-size: 0.24rem;
    line-height: 1.4;
  }

  p:last-child {
    margin-top: 0.03rem;
    color: $text-muted;
    font-size: 0.12rem;
    line-height: 1.6;
  }
}

.hello {
  margin-bottom: 0.16rem;
  color: $text-main;
  font-size: 0.17rem;
  font-weight: 600;
  text-align: center;
}

.auth-tabs {
  display: flex;
  gap: 0.04rem;
  margin-bottom: 0.18rem;
  padding: 0.04rem;
  border-radius: 0.12rem;
  background: var(--m-primary-light);
}

.auth-tab {
  flex: 1;
  padding: 0.09rem 0;
  border: none;
  border-radius: 0.09rem;
  background: transparent;
  color: $text-muted;
  font-family: inherit;
  font-size: 0.14rem;
  font-weight: 500;
  cursor: pointer;

  &.active {
    background: #fff;
    color: var(--m-active-text);
    font-weight: 700;
    box-shadow: 0 0.02rem 0.06rem rgba(51, 71, 91, 0.05);
  }
}

.bottom-row {
  margin-top: 0.16rem;
  font-size: 0.14rem;
  text-align: center;
}

.guest-row {
  margin-top: 0.16rem;
  font-size: 0.12rem;
  line-height: 1.5;
  text-align: center;
}

.guest-btn {
  color: $text-sub;
  font-size: 0.12rem;
}

.entry-footer {
  margin-top: auto;
  padding-top: 0.28rem;
  color: $text-sub;
  font-size: 0.11rem;
  text-align: center;
}

@media (max-width: 360px) {
  .brand-copy h1 {
    font-size: 0.3rem;
  }

  .math-decor {
    right: -0.08rem;
    transform: scale(0.88);
    transform-origin: right top;
  }

  .login {
    padding: 0.2rem;
  }
}
</style>
