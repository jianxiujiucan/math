<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import PillGroup, { type PillOption } from "@/components/PillGroup.vue";
import { useQuizStore } from "@/stores/quiz";
import { opTypeOptions } from "@/utils/options";
import type {
  CountOption,
  OperandCount,
  OpType,
  QuizConfig,
  RangeLimit,
} from "@/types/quiz";

const router = useRouter();
const store = useQuizStore();

const countOptions: PillOption<CountOption>[] = [
  { label: "10题", value: 10 },
  { label: "20题", value: 20 },
  { label: "50题", value: 50 },
  { label: "100题", value: 100 },
];

const baseRangeOptions: PillOption<RangeLimit>[] = [
  { label: "10以内", value: 10 },
  { label: "20以内", value: 20 },
  { label: "100以内", value: 100 },
];

const operandOptions: PillOption<OperandCount>[] = [
  { label: "两个数", value: 2 },
  { label: "三个数", value: 3 },
];

// 默认值与原版本一致：10题 / 仅加法 / 20以内 / 两个数
const form = reactive<{
  count: CountOption;
  opType: OpType;
  range: RangeLimit;
  operands: OperandCount;
  carry: boolean;
}>({
  count: 10,
  opType: "add",
  range: 20,
  operands: 2,
  carry: false,
});

const mulDivTypes: OpType[] = ["mul", "div", "muldiv"];

// 进位/退位只对加减法有意义，乘除类型时隐藏该选项
const isAddSub = computed(() => !mulDivTypes.includes(form.opType));
const isMulDiv = computed(() => mulDivTypes.includes(form.opType));

// 乘除类只允许 100 以内，其余范围禁用
const rangeOptions = computed<PillOption<RangeLimit>[]>(() =>
  baseRangeOptions.map((opt) => ({
    ...opt,
    disabled: isMulDiv.value && opt.value !== 100,
  }))
);

// 切到乘/除/乘除混合时，统一重置为 100 以内
watch(
  () => form.opType,
  () => {
    if (isMulDiv.value) form.range = 100;
  }
);

function start() {
  const config: QuizConfig = {
    count: form.count,
    opType: form.opType,
    range: isMulDiv.value ? 100 : form.range,
    operands: form.operands,
    carry: form.carry && isAddSub.value,
  };
  store.startQuiz(config);
  router.push("/quiz");
}
</script>

<template>
  <header class="setup-hero">
    <div class="setup-brand">
      <h1>速算挑战</h1>
    </div>
    <div class="setup-greeting">
      <div>
        <h2>今天也要加油呀！</h2>
        <p>选好规则，开始今天的计算小挑战</p>
      </div>
    </div>
  </header>

  <div class="card setup-card">
    <PillGroup v-model="form.count" :options="countOptions" label="题目数量" />
    <PillGroup
      v-model="form.opType"
      :options="opTypeOptions"
      label="运算类型"
    />
    <PillGroup
      v-model="form.range"
      :options="rangeOptions"
      label="计算结果范围"
    />
    <PillGroup
      v-model="form.operands"
      :options="operandOptions"
      label="运算项个数"
    />

    <div v-show="isAddSub" class="option-group">
      <label class="checkbox-label" for="carry-checkbox">
        <input id="carry-checkbox" v-model="form.carry" type="checkbox" />
        <span>进位 / 退位练习（加大出题概率）</span>
      </label>
    </div>

    <button class="primary-btn start-btn" @click="start">开始挑战 →</button>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.setup-hero {
  padding: 0.2rem 0.04rem 0.18rem;
}

.setup-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h1 {
    margin: 0;
    font-size: 0.2rem;
    text-align: left;
  }
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: var(--m-cream);
  color: $primary;
  font-family: Inter, Arial, sans-serif;
  font-size: 0.18rem;
  font-weight: 700;
}

.setup-greeting {
  position: relative;
  margin-top: 0.24rem;

  h2 {
    color: $text-main;
    font-size: 0.25rem;
    line-height: 1.4;
  }

  p {
    margin-top: 0.05rem;
    color: $text-sub;
    font-size: 0.12rem;
  }
}

.setup-symbols {
  position: absolute;
  top: -0.02rem;
  right: 0.08rem;
  width: 0.86rem;
  height: 0.68rem;

  span {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-family: Inter, Arial, sans-serif;
    font-weight: 700;

    &:first-child {
      top: 0;
      right: 0;
      width: 0.44rem;
      height: 0.44rem;
      background: var(--m-cream);
      color: $primary;
      font-size: 0.22rem;
      transform: rotate(7deg);
    }

    &:last-child {
      bottom: 0;
      left: 0;
      width: 0.34rem;
      height: 0.34rem;
      background: #f7e7ed;
      color: #a5677e;
      font-size: 0.17rem;
      transform: rotate(-8deg);
    }
  }
}

.setup-card {
  padding: 0.2rem 0.22rem;

  :deep(.pill-group) {
    display: grid;
    gap: 0.07rem;
  }

  .option-group:nth-child(1) :deep(.pill-group) {
    grid-template-columns: repeat(4, 1fr);
  }

  .option-group:nth-child(2) :deep(.pill-group),
  .option-group:nth-child(3) :deep(.pill-group) {
    grid-template-columns: repeat(3, 1fr);
  }

  .option-group:nth-child(4) :deep(.pill-group) {
    grid-template-columns: repeat(2, 1fr);
  }

  :deep(.pill) {
    width: 100%;
    padding-right: 0.04rem;
    padding-left: 0.04rem;
    white-space: nowrap;
  }
}

.option-group {
  margin-bottom: 0.13rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.08rem;
  font-size: 0.12rem;
  color: $text-main;
  cursor: pointer;
  user-select: none;

  input {
    width: 0.18rem;
    height: 0.18rem;
    accent-color: $primary;
    cursor: pointer;
  }
}

.start-btn {
  margin-top: 0.02rem;
}

.setup-tip {
  align-self: center;
  margin-top: 0.2rem;
  padding: 0.08rem 0.16rem;
  border-radius: 0.18rem;
  background: #f7e7ed;
  color: #e45c94;
  font-size: 0.11rem;

  span {
    margin-right: 0.06rem;
    color: #a5677e;
    font-family: Inter, Arial, sans-serif;
    font-size: 0.13rem;
    font-weight: 700;
  }
}

@media (max-width: 360px) {
  .setup-greeting h2 {
    font-size: 0.22rem;
  }

  .setup-symbols {
    right: -0.04rem;
    transform: scale(0.84);
    transform-origin: right top;
  }
}
</style>
