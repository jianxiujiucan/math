const { isSoundOn, toggle } = require('../../utils/sound')

Component({
  data: {
    soundOn: true,
  },

  lifetimes: {
    attached() {
      this.setData({ soundOn: isSoundOn() })
    },
  },

  methods: {
    onToggle() {
      this.setData({ soundOn: toggle() })
    },
  },
})
