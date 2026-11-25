<script setup lang="ts">
defineProps<{
  disabled: boolean;
  confirmDisabled: boolean;
  aboveTabs: boolean;
}>();

const emit = defineEmits<{
  digit: [digit: string];
  backspace: [];
  confirm: [];
}>();

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
</script>

<template>
  <div class="keypad-layout" :class="{ 'above-tabs': aboveTabs }">
    <div class="numeric-keypad" role="group" aria-label="数字小键盘">
      <button
        v-for="digit in digits"
        :key="digit"
        type="button"
        class="key"
        :disabled="disabled"
        @click="emit('digit', digit)"
      >
        {{ digit }}
      </button>
      <button
        type="button"
        class="key key-action"
        aria-label="删除一位"
        :disabled="disabled"
        @click="emit('backspace')"
      >
        删除
      </button>
      <button
        type="button"
        class="key"
        :disabled="disabled"
        @click="emit('digit', '0')"
      >
        0
      </button>
      <button
        type="button"
        class="key key-confirm"
        :disabled="disabled || confirmDisabled"
        @click="emit('confirm')"
      >
        确定
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.keypad-layout {
  --keypad-bottom: 0px;
  height: var(--m-keypad-height);
  flex-shrink: 0;

  &.above-tabs {
    --keypad-bottom: var(--m-bottom-tabs-space);
  }
}

.numeric-keypad {
  position: fixed;
  bottom: var(--keypad-bottom);
  left: 50%;
  transform: translateX(-50%);
  z-index: 15;
  width: 100%;
  max-width: 3.75rem;
  height: var(--m-keypad-height);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 0.1rem;
  padding: 0.08rem 0.2rem 0.14rem;
  background: transparent;
  box-shadow: none;
}

.key {
  min-width: 0;
  border: none;
  border-radius: 0.12rem;
  background: var(--m-cream);
  color: $text-main;
  font-family: inherit;
  font-size: 0.22rem;
  font-weight: 700;
  box-shadow: 0 0.04rem 0.08rem rgba(51, 71, 91, 0.07);
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  transition: transform 0.1s ease, background-color 0.1s ease;

  &:active:not(:disabled) {
    transform: scale(0.96);
    background: $primary-light;
  }

  &:focus-visible {
    outline: 0.03rem solid $primary;
    outline-offset: -0.03rem;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.key-action {
  background: var(--m-pink);
  color: #e45c94;
  font-size: 0.14rem;
}

.key-confirm {
  background: $primary;
  color: #fff;
  font-size: 0.17rem;
}

@media (min-width: 520px) {
  .numeric-keypad {
    max-width: 4.3rem;
  }
}
</style>
