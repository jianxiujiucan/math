<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import NumericKeypad from "@/components/NumericKeypad.vue";
import SoundToggle from "@/components/SoundToggle.vue";
import { useMobile } from "@/composables/useMobile";
import { useSound } from "@/composables/useSound";
import { useTimer } from "@/composables/useTimer";
import { useAuthStore } from "@/stores/auth";
import { useQuizStore } from "@/stores/quiz";
import { saveSessionApi } from "@/api";
import { exprText } from "@/utils/generator";
import { opTypeLabel } from "@/utils/format";
import type { QuestionRecordDto } from "@/types/api";

const router = useRouter();
const store = useQuizStore();
const auth = useAuthStore();
const { display, start, stop } = useTimer();
const { play } = useSound();
const { isMobile } = useMobile();

// 局部 UI 状态（不进 store）
const answer = ref("");
const answered = ref(false);
const lastRight = ref(false);
const wrong = ref(false);
const mistakeMade = ref(false);
const finished = ref(false);
const inputEl = ref<HTMLInputElement>();
const isActive = ref(true);

// 每题用时采集与成绩保存
const records = ref<QuestionRecordDto[]>([]);
let questionStart = 0; // performance.now() 时间戳
let quizStart = 0;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
const durationMs = ref(0);
const saveState = ref<"guest" | "saving" | "saved" | "failed">("guest");

const total = computed(() => store.state.questions.length);
const currentQ = computed(() => store.state.questions[store.state.current]);
const progress = computed(() => `${store.state.current + 1}/${total.value}`);
const progressPercent = computed(
  () => `${((store.state.current + 1) / total.value) * 100}%`
);
const quizMeta = computed(() => {
  const config = store.state.config;
  return config ? `${opTypeLabel(config.opType)} · ${config.range}以内` : "";
});
const expr = computed(() => `${exprText(currentQ.value)} =`);
const answerLen = computed(() => String(currentQ.value.answer).length);
const isLast = computed(() => store.state.current === total.value - 1);
const showKeypad = computed(() => isMobile.value && !finished.value);

// 满分 100，按正确比例扣分，四舍五入取整
const score = computed(() =>
  Math.round((store.state.correct / total.value) * 100)
);
const cheer = computed(() =>
  score.value === 100
    ? "太棒了，满分！🎉"
    : score.value >= 80
    ? "很棒，继续加油！"
    : score.value >= 60
    ? "不错，再练练会更好！"
    : "别灰心，多多练习！"
);
const summary = computed(
  () => `答对 ${store.state.correct}/${total.value} 题 · 用时 ${display.value}`
);

function focusInput() {
  if (isMobile.value || !isActive.value) return;
  nextTick(() => {
    if (!isMobile.value && isActive.value) inputEl.value?.focus();
  });
}

/* 组件被 KeepAlive 缓存：路由回来不会重建。
 * 以 store.quizId 识别「新的一场」，只有新的一场才重置局部状态。 */
const localQuizId = ref(0);

function syncWithStore() {
  if (localQuizId.value === store.state.quizId) return;
  localQuizId.value = store.state.quizId;
  if (advanceTimer !== null) clearTimeout(advanceTimer);
  advanceTimer = null;
  records.value = [];
  answer.value = "";
  answered.value = false;
  wrong.value = false;
  mistakeMade.value = false;
  lastRight.value = false;
  finished.value = false;
  saveState.value = "guest";
  start();
  questionStart = performance.now();
  quizStart = questionStart;
  focusInput();
}

onMounted(syncWithStore);
onActivated(() => {
  isActive.value = true;
  syncWithStore();
});
onDeactivated(() => {
  isActive.value = false;
});

// 切到下一题时重置作答状态并聚焦输入框
watch(
  () => store.state.current,
  () => {
    answer.value = "";
    answered.value = false;
    wrong.value = false;
    mistakeMade.value = false;
    lastRight.value = false;
    questionStart = performance.now();
    focusInput();
  }
);

// 切换输入模式时关闭系统键盘；后台 KeepAlive 页面不恢复焦点
watch(isMobile, (mobile) => {
  if (mobile) {
    inputEl.value?.blur();
  } else if (isActive.value && !answered.value && !finished.value) {
    focusInput();
  }
});

// 答题中途去登录：回来后若成绩还没保存，自动补传
watch(
  () => auth.state.token,
  (t) => {
    if (t && finished.value && saveState.value === "guest") {
      void saveResult();
    }
  }
);

// 原生输入与移动小键盘共用过滤、位数限制和自动判题逻辑
function updateAnswer(raw: string) {
  if (answered.value) return;
  const v = raw.replace(/\D/g, "").slice(0, 3);
  if (v) wrong.value = false;
  answer.value = v;
  if (inputEl.value && inputEl.value.value !== v) {
    inputEl.value.value = v;
  }
  if (v.length > 0 && v.length >= answerLen.value) {
    checkAnswer();
  }
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement;
  updateAnswer(input.value);
}

function appendDigit(digit: string) {
  updateAnswer(answer.value + digit);
}

function eraseDigit() {
  if (answered.value) return;
  wrong.value = false;
  answer.value = answer.value.slice(0, -1);
}

function tryCheck() {
  if (answered.value) return;
  if (answer.value === "") return;
  checkAnswer();
}

function checkAnswer() {
  if (answered.value) return;

  const q = currentQ.value;
  const right = parseInt(answer.value, 10) === q.answer;
  const firstTry = !mistakeMade.value;
  const timeMs = Math.round(performance.now() - questionStart);
  const existing = records.value.find(
    (record) => record.seq === store.state.current + 1
  );

  // 每题只保留首次判分；重试更新用时，但不改变首次对错和首次答案。
  if (existing) {
    existing.timeMs = timeMs;
  } else {
    records.value.push({
      seq: store.state.current + 1,
      expr: exprText(q),
      userAnswer: answer.value,
      correctAnswer: q.answer,
      isCorrect: right,
      timeMs,
    });
  }

  if (right) {
    answered.value = true;
    lastRight.value = true;
    wrong.value = false;
    if (firstTry) store.markCorrect();
    play("correct");
    scheduleAdvance();
  } else {
    mistakeMade.value = true;
    answered.value = false;
    lastRight.value = false;
    wrong.value = true;
    answer.value = "";
    play("error");
    focusInput();
  }
}

function scheduleAdvance() {
  const questionIndex = store.state.current;
  if (isLast.value) {
    stop();
    durationMs.value = Math.round(performance.now() - quizStart);
  }
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    if (questionIndex !== store.state.current) return;
    if (isLast.value) {
      finished.value = true;
      void saveResult();
    } else {
      store.nextQuestion();
    }
  }, 600);
}

async function saveResult() {
  if (!auth.state.token || !store.state.config) {
    saveState.value = "guest";
    return;
  }
  saveState.value = "saving";
  try {
    await saveSessionApi({
      config: store.state.config,
      durationMs: durationMs.value,
      questions: records.value,
    });
    saveState.value = "saved";
  } catch {
    saveState.value = "failed"; // 静默降级：仅结果区提示，可手动重试
  }
}

function goHome() {
  if (advanceTimer !== null) clearTimeout(advanceTimer);
  store.reset();
  router.push("/");
}
</script>

<template>
  <div class="quiz-topbar">
    <button
      type="button"
      class="back-btn"
      aria-label="返回答题设置"
      @click="router.push('/setup')"
    >
      ‹
    </button>
    <h1>口算挑战</h1>
    <SoundToggle />
  </div>

  <div class="quiz-header">
    <span class="badge">{{ progress }}</span>
    <span class="badge">{{ display }}</span>
  </div>

  <div class="card question-card">
    <div class="question-meta">
      <span class="question-type">{{ quizMeta }}</span>
      <span>第 {{ store.state.current + 1 }} 题</span>
    </div>

    <span class="decor-plus" aria-hidden="true">+</span>
    <span class="decor-number" aria-hidden="true">8</span>
    <div class="question-line">
      <p class="question-text">{{ expr }}</p>
      <input
        ref="inputEl"
        class="answer-input"
        type="text"
        :inputmode="isMobile ? 'none' : 'numeric'"
        pattern="[0-9]*"
        maxlength="3"
        autocomplete="off"
        aria-label="答案"
        placeholder="?"
        :value="answer"
        :readonly="isMobile"
        :disabled="answered"
        @input="onInput"
        @keydown.enter.prevent="tryCheck"
      />
      <span
        class="result-icon"
        :class="{ right: answered && lastRight, wrong: wrong && !answered }"
        >{{ answered && lastRight ? "✓" : wrong ? "✗" : "" }}</span
      >
    </div>
    <div v-show="!answered && !wrong" class="question-hint">
      看清运算符号，再输入答案
    </div>
    <div v-show="answered && lastRight" class="correct-feedback">回答正确</div>
    <div v-show="wrong && !answered" class="feedback">答案错误，再想想</div>
    <button v-show="!answered" class="secondary-btn" @click="tryCheck">
      确定
    </button>
  </div>

  <div v-if="!finished" class="quiz-progress-track" aria-hidden="true">
    <span :style="{ width: progressPercent }"></span>
  </div>

  <div v-if="finished" class="card result-area">
    <div class="result-title">本次得分</div>
    <div class="score-text">{{ score }} 分</div>
    <div class="cheer-text">{{ cheer }}</div>
    <div class="summary-text">{{ summary }}</div>
    <div class="save-tip">
      <template v-if="saveState === 'saved'">
        成绩已保存 ✓
        <router-link to="/profile" class="link">查看个人中心</router-link>
      </template>
      <template v-else-if="saveState === 'saving'">成绩保存中…</template>
      <template v-else-if="saveState === 'failed'">
        成绩保存失败 <button class="link-btn" @click="saveResult">重试</button>
      </template>
      <template v-else>
        <router-link
          :to="{ name: 'entry', query: { redirect: '/quiz' } }"
          class="link"
        >
          登录后可保存成绩
        </router-link>
      </template>
    </div>
    <button class="primary-btn" @click="goHome">返回首页</button>
  </div>

  <NumericKeypad
    v-if="showKeypad"
    :disabled="answered"
    :confirm-disabled="answer.length === 0"
    :above-tabs="false"
    @digit="appendDigit"
    @backspace="eraseDigit"
    @confirm="tryCheck"
  />
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.08rem 0.02rem 0.14rem;
}

.badge {
  background: var(--m-cream);
  color: $primary;
  font-size: 0.14rem;
  font-weight: 700;
  padding: 0.09rem 0.18rem;
  border-radius: 0.2rem;
  min-width: 0.94rem;
  text-align: center;
  font-variant-numeric: tabular-nums;

  &:last-child {
    background: #f7e7ed;
    color: #8c6575;
  }
}

.question-card {
  position: relative;
  justify-content: center;
  height: 2.86rem;
  padding: 0.18rem 0.2rem 0.24rem;
  overflow: hidden;
}

.question-line {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  padding: 0.1rem 0 0.18rem;
  font-size: 0.39rem;
  font-weight: 700;
  color: $text-main;
  z-index: 1;
}

.question-meta {
  position: absolute;
  top: 0.18rem;
  right: 0.2rem;
  left: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: $text-muted;
  font-size: 0.11rem;
  font-weight: 500;
}

.question-type {
  padding: 0.07rem 0.12rem;
  border-radius: 0.16rem;
  background: #f7e7ed;
  color: #8c6575;
}

.english-label {
  position: absolute;
  top: 0.72rem;
  left: 0;
  width: 100%;
  color: #9aa8b5;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.1rem;
  font-weight: 600;
  letter-spacing: 0.08rem;
  text-align: center;
}

.decor-plus {
  position: absolute;
  top: 0.54rem;
  right: 0.32rem;
  color: #f2dce4;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
}

.decor-number {
  position: absolute;
  bottom: 0.2rem;
  left: 0.24rem;
  color: #e8f1f5;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
}

.question-text {
  white-space: nowrap;
  font-family: Inter, "PingFang SC", sans-serif;
}

.answer-input {
  width: 0.62rem;
  height: 0.66rem;
  padding: 0;
  font-size: 0.32rem;
  font-weight: 700;
  text-align: center;
  color: $text-main;
  border: 0.02rem solid #8ebed8;
  border-radius: 0.12rem;
  outline: none;
  background: #fff;
  caret-color: $primary;
  margin: 0 0 0 0.12rem;

  &:focus {
    box-shadow: 0 0 0 0.03rem rgba(63, 115, 146, 0.14);
  }

  &:disabled {
    background: #f2f2f2;
    color: #888;
    border-color: #ccc;
  }
}

.secondary-btn {
  display: none;
}

.result-icon {
  width: 0.4rem;
  font-size: 0.26rem;
  font-weight: 800;
  text-align: center;

  &.right {
    color: $success;
  }

  &.wrong {
    color: $danger;
  }
}

.feedback {
  position: absolute;
  bottom: 0.22rem;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 0.13rem;
  font-weight: 600;
  color: $danger;
}

.correct-feedback {
  position: absolute;
  bottom: 0.22rem;
  left: 0;
  width: 100%;
  color: $success;
  font-size: 0.13rem;
  font-weight: 700;
  text-align: center;
}

.question-hint {
  position: absolute;
  bottom: 0.24rem;
  left: 0;
  width: 100%;
  color: $text-muted;
  font-size: 0.12rem;
  text-align: center;
}

.quiz-progress-track {
  height: 0.07rem;
  margin: 0.16rem 0.02rem 0;
  overflow: hidden;
  border-radius: 0.04rem;
  background: #d8edf8;

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: $primary;
    transition: width 0.2s ease;
  }
}

.keypad-label {
  margin: 0.14rem 0.04rem 0.02rem;
  color: $text-main;
  font-size: 0.12rem;
  font-weight: 600;
}

.quiz-topbar {
  display: grid;
  grid-template-columns: 0.4rem 1fr 0.4rem;
  align-items: center;
  padding-top: 0.12rem;

  h1 {
    margin: 0;
    font-size: 0.18rem;
  }

  .sound-toggle {
    position: static;
    width: 0.38rem;
    height: 0.38rem;
    margin-left: auto;
    background-color: var(--m-cream);
  }
}

.back-btn {
  width: 0.4rem;
  height: 0.4rem;
  border: none;
  background: transparent;
  color: $text-main;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.32rem;
  line-height: 1;
  cursor: pointer;
}

.next-btn {
  margin-top: 0.16rem;
}

.result-area {
  margin-top: 0.16rem;
  text-align: center;
}

.result-title {
  font-size: 0.16rem;
  color: #888;
  font-weight: 600;
}

.score-text {
  font-size: 0.44rem;
  font-weight: 800;
  color: $accent-to;
  margin: 0.06rem 0 0.02rem;
}

.cheer-text {
  font-size: 0.17rem;
  font-weight: 600;
  color: $primary;
  margin-bottom: 0.08rem;
}

.summary-text {
  font-size: 0.15rem;
  color: $text-main;
  margin-bottom: 0.1rem;
  font-variant-numeric: tabular-nums;
}

.save-tip {
  font-size: 0.13rem;
  color: $text-muted;
  margin-bottom: 0.14rem;
  min-height: 0.18rem;
  span {
    color: green;
  }
}

@media (min-width: 520px) {
  .question-line {
    justify-content: center;
  }
}
</style>
