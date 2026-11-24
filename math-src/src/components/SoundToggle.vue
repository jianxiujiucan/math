<script setup lang="ts">
import { useSound } from '@/composables/useSound'

const { soundOn, toggle } = useSound()
</script>

<template>
  <button
    class="sound-toggle"
    :class="{ off: !soundOn }"
    :aria-label="soundOn ? '关闭音效' : '打开音效'"
    @click="toggle"
  ></button>
</template>

<style scoped lang="scss">
.sound-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  bottom: 0.62rem; // 位于底部 Tab 栏上方
  right: 0.12rem;
  z-index: 10;
  width: 0.4rem;
  height: 0.4rem;
  border: none;
  border-radius: 50%;
  background: var(--m-cream);
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease;

  &:active {
    transform: scale(0.9);
  }

  &::before {
    content: '';
    width: 60%;
    height: 60%;
    background: var(--m-primary);
    -webkit-mask: url('../assets/media/sound.png') center / contain no-repeat;
    mask: url('../assets/media/sound.png') center / contain no-repeat;
  }

  &.off::before {
    -webkit-mask-image: url('../assets/media/mute.png');
    mask-image: url('../assets/media/mute.png');
  }
}
</style>
