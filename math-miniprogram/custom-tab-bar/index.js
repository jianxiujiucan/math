const { getToken } = require("../utils/auth");

Component({
  data: {
    loggedIn: false,
    selected: -1,
    tabs: [
      { label: "首页", icon: "/assets/img/icon/home.svg", path: "/pages/setup/setup" },
      { label: "排行", icon: "/assets/img/icon/ranking.svg", path: "/pages/leaderboard/leaderboard" },
      { label: "我的", icon: "/assets/img/icon/profile.svg", path: "/pages/profile/profile" },
    ],
  },

  methods: {
    refresh(route) {
      const selected = this.data.tabs.findIndex(
        (tab) => tab.path === `/${route}`
      );
      this.setData({
        loggedIn: Boolean(getToken()),
        selected: route === "pages/entry/entry" ? 0 : selected,
      });
    },

    onSwitch(event) {
      const path = event.currentTarget.dataset.path;
      if (!path) return;
      wx.switchTab({ url: path });
    },
  },
});
