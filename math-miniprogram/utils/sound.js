let soundOn = true
const players = {}

function play(name) {
  if (!soundOn || (name !== 'correct' && name !== 'error')) return
  try {
    if (!players[name]) {
      const audio = wx.createInnerAudioContext()
      audio.src = `/assets/media/${name}.wav`
      players[name] = audio
    }
    players[name].stop()
    players[name].play()
  } catch (e) {
    // 音频不可用时不能影响判题流程。
  }
}

function toggle() {
  soundOn = !soundOn
  return soundOn
}

function isSoundOn() {
  return soundOn
}

module.exports = {
  isSoundOn,
  play,
  toggle,
}
