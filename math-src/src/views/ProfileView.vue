<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import editIcon from "@/assets/img/icon/edit.svg";
import logoutIcon from "@/assets/img/icon/logout.svg";
import { fetchProfileApi, fetchSessionsApi, updateNicknameApi } from "@/api";
import { ApiError } from "@/api/http";
import type { PerTypeStat, ProfileResponse, SessionSummary } from "@/types/api";
import type { OpType } from "@/types/quiz";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMsPerQ,
  opTypeLabel,
} from "@/utils/format";
import { usernameError } from "@/utils/validate";

const router = useRouter();
const auth = useAuthStore();

const profile = ref<ProfileResponse | null>(null);
const sessions = ref<SessionSummary[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const loading = ref(true);
const errorMsg = ref("");
const nicknameInput = ref<HTMLInputElement | null>(null);
const nicknameEditing = ref(false);
const nicknameDraft = ref("");
const nicknameSaving = ref(false);
const nicknameError = ref("");

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
);

const ALL_TYPES: OpType[] = ["add", "sub", "addsub", "mul", "div", "muldiv"];

/** 6 种类型完整表格行（无数据的类型显示 -） */
const perTypeRows = computed(() => {
  const map = new Map<OpType, PerTypeStat>();
  for (const r of profile.value?.stats.perType ?? []) map.set(r.opType, r);
  return ALL_TYPES.map((t) => ({
    opType: t,
    label: opTypeLabel(t),
    sessions: map.get(t)?.sessions ?? 0,
    bestAvgMs: map.get(t)?.bestAvgMs ?? null,
    bestScore: map.get(t)?.bestScore ?? null,
  }));
});

async function loadProfile() {
  profile.value = await fetchProfileApi();
}

async function loadSessions() {
  const r = await fetchSessionsApi(page.value, pageSize);
  sessions.value = r.list;
  total.value = r.total;
}

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    await Promise.all([loadProfile(), loadSessions()]);
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : "加载失败，请稍后再试";
  } finally {
    loading.value = false;
  }
}

async function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
  try {
    await loadSessions();
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : "加载失败，请稍后再试";
  }
}

function configText(s: SessionSummary): string {
  return `${opTypeLabel(s.opType)} · ${s.range}以内 · ${s.count}题`;
}

async function startNicknameEdit() {
  if (!profile.value || nicknameSaving.value) return;
  nicknameDraft.value = profile.value.user.username;
  nicknameError.value = "";
  nicknameEditing.value = true;
  await nextTick();
  nicknameInput.value?.focus();
  nicknameInput.value?.select();
}

function cancelNicknameEdit() {
  if (nicknameSaving.value) return;
  nicknameEditing.value = false;
  nicknameError.value = "";
}

async function saveNickname() {
  if (!profile.value || nicknameSaving.value) return;
  const nickname = nicknameDraft.value.trim();
  const validationError = usernameError(nickname).replace(/用户名/g, "昵称");
  if (validationError) {
    nicknameError.value = validationError;
    return;
  }
  if (nickname === profile.value.user.username) {
    cancelNicknameEdit();
    return;
  }

  nicknameSaving.value = true;
  nicknameError.value = "";
  try {
    const result = await updateNicknameApi(nickname);
    profile.value.user.username = result.user.username;
    auth.updateUsername(result.user.username);
    nicknameEditing.value = false;
  } catch (e) {
    nicknameError.value =
      e instanceof ApiError ? e.message : "昵称保存失败，请稍后再试";
  } finally {
    nicknameSaving.value = false;
  }
}

function logout() {
  auth.logout();
  router.push("/");
}

onMounted(load);
</script>

<template>
  <h1>个人中心</h1>

  <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
  <p v-if="loading && !profile" class="loading-text">加载中…</p>

  <template v-else-if="profile">
    <!-- 用户信息卡 -->
    <div class="card user-card">
      <button
        type="button"
        class="logout-btn"
        aria-label="退出登录"
        title="退出登录"
        @click="logout"
      >
        <img :src="logoutIcon" alt="" />
      </button>
      <div v-if="!nicknameEditing" class="username-row">
        <div class="username">{{ profile.user.username }}</div>
        <button
          type="button"
          class="nickname-edit-btn"
          aria-label="编辑昵称"
          title="编辑昵称"
          @click="startNicknameEdit"
        >
          <img :src="editIcon" alt="" />
        </button>
      </div>
      <div v-else class="nickname-edit-form">
        <input
          ref="nicknameInput"
          v-model="nicknameDraft"
          class="nickname-input"
          :class="{ 'input-error': nicknameError }"
          type="text"
          aria-label="昵称"
          maxlength="20"
          autocomplete="off"
          :disabled="nicknameSaving"
          @keyup.enter="saveNickname"
          @keyup.esc="cancelNicknameEdit"
        />
        <button
          type="button"
          class="nickname-confirm-btn"
          :disabled="nicknameSaving"
          @click="saveNickname"
        >
          {{ nicknameSaving ? "保存中" : "确定" }}
        </button>
      </div>
      <p v-if="nicknameEditing && nicknameError" class="nickname-error">
        {{ nicknameError }}
      </p>
      <div class="user-meta">{{ profile.user.email }}</div>
      <div class="user-meta">
        注册于 {{ formatDate(profile.user.createdAt) }}
      </div>
    </div>

    <!-- 统计卡 -->
    <div class="card">
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-num">{{ profile.stats.totalSessions }}</div>
          <div class="stat-label">总场次</div>
        </div>
        <div class="stat-cell">
          <div class="stat-num">{{ profile.stats.totalQuestions }}</div>
          <div class="stat-label">总题数</div>
        </div>
        <div class="stat-cell">
          <div class="stat-num">{{ profile.stats.accuracy }}%</div>
          <div class="stat-label">正确率</div>
        </div>
      </div>
      <table class="type-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>场次</th>
            <th>最佳每题用时</th>
            <th>最高分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in perTypeRows" :key="row.opType">
            <td>{{ row.label }}</td>
            <td>{{ row.sessions || "-" }}</td>
            <td>{{ formatMsPerQ(row.bestAvgMs) }}</td>
            <td>{{ row.bestScore ?? "-" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 记录列表卡 -->
    <div class="card">
      <div class="card-title">答题记录</div>
      <div v-if="sessions.length === 0" class="empty">
        <p>还没有答题记录</p>
        <button class="primary-btn" @click="router.push('/setup')">
          去答一组
        </button>
      </div>
      <template v-else>
        <button
          v-for="s in sessions"
          :key="s.id"
          class="record-row"
          @click="router.push(`/profile/sessions/${s.id}`)"
        >
          <span class="record-main">
            <span class="record-config">{{ configText(s) }}</span>
            <span class="record-time">{{ formatDateTime(s.createdAt) }}</span>
          </span>
          <span class="record-result">
            <span class="record-score" :class="{ low: s.score < 60 }"
              >{{ s.score }}分</span
            >
            <span class="record-sub"
              >对 {{ s.correct }}/{{ s.total }} ·
              {{ formatDuration(s.durationMs) }}</span
            >
          </span>
        </button>
        <div v-if="totalPages > 1" class="pager">
          <button
            class="link-btn"
            :disabled="page <= 1"
            @click="goPage(page - 1)"
          >
            ‹ 上一页
          </button>
          <span class="pager-info">{{ page }}/{{ totalPages }}</span>
          <button
            class="link-btn"
            :disabled="page >= totalPages"
            @click="goPage(page + 1)"
          >
            下一页 ›
          </button>
        </div>
      </template>
    </div>
  </template>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.loading-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.15rem;
}

.card {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.14rem;
}

.user-card {
  position: relative;
  text-align: center;
}

.logout-btn {
  position: absolute;
  top: 0.1rem;
  right: 0.12rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0.34rem;
  height: 0.34rem;
  padding: 0.04rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--m-primary-light);
  }

  img {
    display: block;
    width: 0.26rem;
    height: 0.26rem;
  }
}

.username-row {
  display: flex;
  align-items: center;
  gap: 0.04rem;
  min-height: 0.36rem;
}

.username {
  font-size: 0.24rem;
  font-weight: 800;
  color: $text-main;
  overflow-wrap: anywhere;
}

.nickname-edit-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 0.32rem;
  height: 0.32rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: $primary-light;
  }

  img {
    display: block;
    width: 0.16rem;
    height: 0.16rem;
  }
}

.nickname-edit-form {
  display: flex;
  align-items: center;
  gap: 0.08rem;
  min-height: 0.36rem;
}

.nickname-input {
  width: min(2.2rem, 55vw);
  height: 0.36rem;
  padding: 0 0.12rem;
  border: 0.01rem solid #d8e7ef;
  border-radius: 0.18rem;
  outline: none;
  background: #fff;
  color: $text-main;
  font-family: inherit;
  font-size: 0.16rem;

  &:focus {
    border-color: $primary;
  }

  &.input-error {
    border-color: $danger;
  }
}

.nickname-confirm-btn {
  flex: none;
  min-width: 0.62rem;
  height: 0.36rem;
  padding: 0 0.14rem;
  border: none;
  border-radius: 0.18rem;
  background: $primary;
  color: #fff;
  font-family: inherit;
  font-size: 0.13rem;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
}

.nickname-error {
  max-width: 3.2rem;
  margin: 0.06rem auto 0;
  color: $danger;
  font-size: 0.12rem;
  line-height: 1.4;
}

.user-meta {
  font-size: 0.13rem;
  color: $text-muted;
  margin-top: 0.04rem;
}

.stat-grid {
  display: flex;
  margin-bottom: 0.14rem;
}

.stat-cell {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 0.24rem;
  font-weight: 800;
  color: $primary;
}

.stat-label {
  font-size: 0.13rem;
  color: $text-muted;
}

.type-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.13rem;

  th {
    color: $text-muted;
    font-weight: 600;
    padding: 0.04rem;
    border-bottom: 0.01rem solid #eee;
  }

  td {
    text-align: center;
    padding: 0.05rem 0.04rem;
    color: $text-main;
    border-bottom: 0.01rem solid #f5f5f5;
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.card-title {
  font-size: 0.15rem;
  font-weight: 600;
  color: $text-sub;
  margin-bottom: 0.1rem;
}

.empty {
  text-align: center;
  color: $text-muted;
  font-size: 0.14rem;
  padding: 0.1rem 0;

  p {
    margin-bottom: 0.12rem;
  }
}

.record-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 0.01rem solid #f0f0f0;
  padding: 0.1rem 0.02rem;
  cursor: pointer;
  font-family: inherit;
  text-align: left;

  &:active {
    background: #f7f8ff;
  }
}

.record-main {
  display: flex;
  flex-direction: column;
  gap: 0.03rem;
}

.record-config {
  font-size: 0.15rem;
  font-weight: 600;
  color: $text-main;
}

.record-time {
  font-size: 0.12rem;
  color: $text-muted;
  font-variant-numeric: tabular-nums;
}

.record-result {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.03rem;
}

.record-score {
  font-size: 0.17rem;
  font-weight: 800;
  color: $accent-to;

  &.low {
    color: $danger;
  }
}

.record-sub {
  font-size: 0.12rem;
  color: $text-sub;
  font-variant-numeric: tabular-nums;
}

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.12rem;
  font-size: 0.14rem;

  .link-btn:disabled {
    color: #ccc;
    cursor: not-allowed;
  }
}

.pager-info {
  color: $text-muted;
}
</style>
