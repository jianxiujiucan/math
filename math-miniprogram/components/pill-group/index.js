Component({
  properties: {
    label: { type: String, value: '' },
    value: { type: null, value: '' },
    options: { type: Array, value: [] },
  },

  methods: {
    onSelect(event) {
      const { value, disabled } = event.currentTarget.dataset
      if (disabled) return
      this.triggerEvent('change', { value })
    },
  },
})
