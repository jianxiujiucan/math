<script setup lang="ts" generic="T extends string | number">
export interface PillOption<T> {
  label: string
  value: T
  disabled?: boolean
}

defineProps<{
  modelValue: T
  options: PillOption<T>[]
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div class="option-group">
    <div v-if="label" class="option-label">{{ label }}</div>
    <div class="pill-group">
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        type="button"
        class="pill"
        :class="{ active: opt.value === modelValue }"
        :disabled="opt.disabled"
        @click="emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.option-group {
  margin-bottom: 0.13rem;
}

.option-label {
  font-size: 0.12rem;
  font-weight: 700;
  color: $text-main;
  margin-bottom: 0.08rem;
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.07rem;
}

.pill {
  border: 0.01rem solid #d8e7ef;
  background: #fff;
  color: var(--m-text-sub);
  border-radius: 0.1rem;
  padding: 0.08rem 0.14rem;
  font-size: 0.12rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;

    &:active {
      transform: none;
    }
  }

  &.active {
    border-color: $primary;
    background: $primary;
    color: #fff;
    font-weight: 600;
  }
}
</style>
