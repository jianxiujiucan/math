Component({
  properties: {
    disabled: { type: Boolean, value: false },
    confirmDisabled: { type: Boolean, value: true },
  },

  data: {
    digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  },

  methods: {
    onDigit(event) {
      if (this.data.disabled) return
      this.triggerEvent('digit', { digit: event.currentTarget.dataset.digit })
    },

    onBackspace() {
      if (!this.data.disabled) this.triggerEvent('backspace')
    },

    onConfirm() {
      if (!this.data.disabled && !this.data.confirmDisabled) this.triggerEvent('confirm')
    },
  },
})
