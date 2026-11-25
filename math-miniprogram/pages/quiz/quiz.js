const { saveSessionApi } = require("../../utils/api");
const { getToken } = require("../../utils/auth");
const { formatTimer, opTypeLabel } = require("../../utils/format");
const { exprText } = require("../../utils/generator");
const {
  clearQuizSession,
  getQuizSession,
  saveQuizSession,
} = require("../../utils/quiz-session");
const { play } = require("../../utils/sound");

Page({
  data: {
    ready: false,
    total: 0,
    current: 0,
    progress: "0/0",
    progressPercent: 0,
    quizMeta: "",
    timer: "00:00",
    expr: "",
    answer: "",
    answered: false,
    lastRight: false,
    wrong: false,
    isLast: false,
    finished: false,
    correctAnswer: 0,
    score: 0,
    correct: 0,
    cheer: "",
    summary: "",
    saveState: "guest",
  },

  onLoad() {
    const session = getQuizSession();
    if (
      !session ||
      !Array.isArray(session.questions) ||
      session.questions.length === 0
    ) {
      wx.showToast({ title: "请先设置答题内容", icon: "none" });
      setTimeout(() => wx.switchTab({ url: "/pages/setup/setup" }), 300);
      return;
    }

    this.session = session;
    this.session.saveState = this.session.saveState || "guest";
    this.session.wrong = Boolean(this.session.wrong);
    this.session.mistakeMade = Boolean(this.session.mistakeMade);
    this.quizStart = Date.now() - (this.session.durationMs || 0);
    this.questionStart = Date.now();
    this.ready = true;
    this.updateView();
    if (this.session.finished) {
      if (getToken() && this.session.saveState === "guest") this.saveResult();
    } else {
      this.startTimer();
      if (this.session.answered && this.session.lastRight)
        this.scheduleAdvance();
    }
  },

  onShow() {
    if (!this.ready || !this.session || this.session.finished || this.timerId)
      return;
    this.quizStart = Date.now() - (this.session.durationMs || 0);
    this.questionStart = Date.now();
    this.startTimer();
  },

  onHide() {
    if (!this.session || this.session.finished) return;
    this.session.durationMs = Date.now() - this.quizStart;
    this.stopTimer();
    saveQuizSession(this.session);
  },

  onUnload() {
    this.stopTimer();
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
  },

  startTimer() {
    this.stopTimer();
    const update = () => {
      const seconds = Math.floor((Date.now() - this.quizStart) / 1000);
      this.setData({ timer: formatTimer(seconds) });
    };
    update();
    this.timerId = setInterval(update, 1000);
  },

  stopTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  },

  updateView() {
    const session = this.session;
    const question = session.questions[session.current];
    const total = session.questions.length;
    const score = Math.round((session.correct / total) * 100);
    const cheer =
      score === 100
        ? "太棒了，满分！🎉"
        : score >= 80
        ? "很棒，继续加油！"
        : score >= 60
        ? "不错，再练练会更好！"
        : "别灰心，多多练习！";
    const timer = formatTimer(Math.floor((session.durationMs || 0) / 1000));
    this.setData({
      ready: true,
      total,
      current: session.current,
      progress: `${session.current + 1}/${total}`,
      progressPercent: ((session.current + 1) / total) * 100,
      quizMeta: `${opTypeLabel(session.config.opType)} · ${
        session.config.range
      }以内`,
      timer: session.finished ? timer : this.data.timer,
      expr: `${exprText(question)} =`,
      answer: session.answer || "",
      answered: Boolean(session.answered),
      lastRight: Boolean(session.lastRight),
      wrong: Boolean(session.wrong),
      isLast: session.current === total - 1,
      finished: Boolean(session.finished),
      correctAnswer: question.answer,
      correct: session.correct,
      score,
      cheer,
      summary: `答对 ${session.correct}/${total} 题 · 用时 ${timer}`,
      saveState: session.saveState,
    });
  },

  appendDigit(event) {
    if (!this.session || this.session.answered || this.session.finished) return;
    this.updateAnswer(`${this.session.answer || ""}${event.detail.digit}`);
  },

  eraseDigit() {
    if (!this.session || this.session.answered || this.session.finished) return;
    this.session.wrong = false;
    this.session.answer = (this.session.answer || "").slice(0, -1);
    this.setData({ answer: this.session.answer, wrong: false });
    saveQuizSession(this.session);
  },

  updateAnswer(raw) {
    const value = String(raw).replace(/\D/g, "").slice(0, 3);
    if (value) this.session.wrong = false;
    this.session.answer = value;
    this.setData({ answer: value, wrong: Boolean(this.session.wrong) });
    const question = this.session.questions[this.session.current];
    if (value && value.length >= String(question.answer).length) {
      this.checkAnswer();
    } else {
      saveQuizSession(this.session);
    }
  },

  tryCheck() {
    if (!this.session || this.session.answered || !this.session.answer) return;
    this.checkAnswer();
  },

  checkAnswer() {
    const session = this.session;
    if (!session || session.answered || session.finished) return;
    const question = session.questions[session.current];
    const right = Number.parseInt(session.answer, 10) === question.answer;
    const firstTry = !session.mistakeMade;
    const timeMs = Math.round(Date.now() - this.questionStart);
    const existing = session.records.find(
      (record) => record.seq === session.current + 1
    );
    if (existing) {
      existing.timeMs = timeMs;
    } else {
      session.records.push({
        seq: session.current + 1,
        expr: exprText(question),
        userAnswer: session.answer,
        correctAnswer: question.answer,
        isCorrect: right,
        timeMs,
      });
    }

    if (!right) {
      session.mistakeMade = true;
      session.answered = false;
      session.lastRight = false;
      session.wrong = true;
      session.answer = "";
      play("error");
      saveQuizSession(session);
      this.updateView();
      return;
    }

    session.answered = true;
    session.lastRight = true;
    session.wrong = false;
    if (firstTry) session.correct++;
    play("correct");
    if (session.current === session.questions.length - 1) {
      session.durationMs = Math.round(Date.now() - this.quizStart);
      this.stopTimer();
    }
    saveQuizSession(session);
    this.updateView();
    this.scheduleAdvance();
  },

  scheduleAdvance() {
    if (this.advanceTimer || !this.session) return;
    const questionIndex = this.session.current;
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      const session = this.session;
      if (!session || questionIndex !== session.current) return;
      if (questionIndex === session.questions.length - 1) {
        session.finished = true;
        saveQuizSession(session);
        this.updateView();
        this.saveResult();
        return;
      }
      session.current++;
      session.answer = "";
      session.answered = false;
      session.lastRight = false;
      session.wrong = false;
      session.mistakeMade = false;
      this.questionStart = Date.now();
      saveQuizSession(session);
      this.updateView();
    }, 600);
  },

  async saveResult() {
    const session = this.session;
    if (
      !session ||
      !session.finished ||
      session.saveState === "saving" ||
      session.saveState === "saved"
    )
      return;
    if (!getToken()) {
      session.saveState = "guest";
      saveQuizSession(session);
      this.setData({ saveState: "guest" });
      return;
    }

    session.saveState = "saving";
    this.setData({ saveState: "saving" });
    try {
      await saveSessionApi({
        config: session.config,
        durationMs: session.durationMs,
        questions: session.records,
      });
      session.saveState = "saved";
    } catch (error) {
      session.saveState = "failed";
    }
    saveQuizSession(session);
    if (this.session === session)
      this.setData({ saveState: session.saveState });
  },

  loginToSave() {
    wx.reLaunch({ url: "/pages/entry/entry?redirect=quiz" });
  },

  viewProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },

  goHome() {
    clearQuizSession();
    wx.switchTab({ url: "/pages/entry/entry" });
  },

  goSetup() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/setup/setup" });
  },
});
