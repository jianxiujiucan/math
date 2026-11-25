<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PasswordInput from '@/components/PasswordInput.vue'
import { forgotPasswordApi, resetPasswordApi } from '@/api'
import { ApiError } from '@/api/http'
import { emailError, passwordError } from '@/utils/validate'

const router = useRouter()
const step = ref<'email' | 'reset' | 'done'>('email')
const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirm = ref('')
const loading = ref(false)
const cooldown = ref(0)
const errorMsg = ref('')
const successMsg = ref('')
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldown.value = 60
  cooldownTimer = setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function sendCode() {
  errorMsg.value = ''
  successMsg.value = ''
  const invalid = emailError(email.value.trim())
  if (invalid) {
    errorMsg.value = invalid
    return
  }
  if (loading.value || cooldown.value > 0) return
  loading.value = true
  try {
    const result = await forgotPasswordApi(email.value)
    step.value = 'reset'
    successMsg.value = result.message
    startCooldown()
  } catch (error) {
    errorMsg.value = error instanceof ApiError ? error.message : '发送失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

function onCodeInput(event: Event) {
  code.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
}

async function resetPassword() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!/^\d{6}$/.test(code.value)) {
    errorMsg.value = '请输入 6 位数字验证码'
    return
  }
  const invalid = passwordError(newPassword.value)
  if (invalid) {
    errorMsg.value = invalid
    return
  }
  if (newPassword.value !== confirm.value) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await resetPasswordApi(email.value, code.value, newPassword.value)
    step.value = 'done'
  } catch (error) {
    errorMsg.value = error instanceof ApiError ? error.message : '重置失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<template>
  <h1>找回密码</h1>
  <div class="card forgot-card">
    <template v-if="step === 'done'">
      <div class="success-icon">✓</div>
      <h2>密码重置成功</h2>
      <p class="desc sub">请使用新密码登录你的账号。</p>
      <button class="primary-btn" @click="router.push('/')">返回登录</button>
    </template>

    <template v-else>
      <p class="desc">通过注册邮箱接收 6 位验证码，验证后即可设置新密码。</p>
      <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="form-success">{{ successMsg }}</div>

      <form v-if="step === 'email'" @submit.prevent="sendCode">
        <div class="form-item">
          <label class="form-label" for="forgot-email">注册邮箱</label>
          <input
            id="forgot-email"
            v-model="email"
            class="text-input"
            type="email"
            autocomplete="email"
            placeholder="请输入注册时使用的邮箱"
          />
        </div>
        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '发送中…' : '发送验证码' }}
        </button>
      </form>

      <form v-else @submit.prevent="resetPassword">
        <div class="form-item">
          <label class="form-label" for="reset-email">注册邮箱</label>
          <input id="reset-email" :value="email" class="text-input" type="email" disabled />
        </div>
        <div class="form-item">
          <label class="form-label" for="reset-code">邮箱验证码</label>
          <input
            id="reset-code"
            :value="code"
            class="text-input code-input"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="请输入 6 位数字验证码"
            @input="onCodeInput"
          />
        </div>
        <div class="form-item">
          <label class="form-label" for="reset-password">新密码</label>
          <PasswordInput
            id="reset-password"
            v-model="newPassword"
            autocomplete="new-password"
            placeholder="8 位以上，字母+数字组合"
          />
        </div>
        <div class="form-item">
          <label class="form-label" for="reset-confirm">确认新密码</label>
          <PasswordInput
            id="reset-confirm"
            v-model="confirm"
            autocomplete="new-password"
            placeholder="请再次输入新密码"
          />
        </div>
        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '提交中…' : '重置密码' }}
        </button>
        <p class="resend-row">
          <button type="button" class="link-btn" :disabled="cooldown > 0 || loading" @click="sendCode">
            {{ cooldown > 0 ? `${cooldown} 秒后可重发` : '重新发送验证码' }}
          </button>
        </p>
      </form>

      <p class="back-row"><button class="link-btn" @click="router.push('/')">返回登录</button></p>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.forgot-card {
  text-align: center;
}

.desc {
  margin-bottom: 0.18rem;
  color: $text-sub;
  font-size: 0.14rem;
  line-height: 1.7;
  text-align: left;

  &.sub {
    color: $text-muted;
    text-align: center;
  }
}

.form-item {
  text-align: left;
}

.code-input {
  font-family: Inter, Arial, sans-serif;
  font-size: 0.2rem;
  font-weight: 700;
  letter-spacing: 0.08rem;
  text-align: center;
}

.resend-row,
.back-row {
  margin-top: 0.16rem;
  font-size: 0.13rem;
}

.success-icon {
  width: 0.58rem;
  height: 0.58rem;
  margin: 0 auto 0.14rem;
  border-radius: 50%;
  background: #e5f5ed;
  color: $success;
  font-size: 0.3rem;
  font-weight: 700;
  line-height: 0.58rem;
}

.form-success {
  padding: 0.1rem 0.12rem;
  border: 0.01rem solid #b7dfc8;
  border-radius: 0.08rem;
  background: #f0fff4;
  color: #23884b;
  font-size: 0.13rem;
  line-height: 1.6;
  text-align: left;
}
</style>
