// 线上后端；本机调试时改为 http://127.0.0.1:3000 或电脑局域网 IP。
const API_BASE = "https://jianxiujiucan.cn/math";

module.exports = {
  API_BASE: API_BASE.replace(/\/$/, ""),
};
