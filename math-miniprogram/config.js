// 本机开发：模拟器和同一 Wi-Fi 下的真机都使用该地址。
// 电脑 IP 变化时需要同步修改；正式发布必须换成已备案的 HTTPS 合法域名。
const API_BASE = "http://192.168.3.34:3000";

module.exports = {
  API_BASE: API_BASE.replace(/\/$/, ""),
};
