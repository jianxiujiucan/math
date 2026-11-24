// 真机预览和发布必须使用已在小程序后台配置的 HTTPS request 合法域名。
// 本地联调可改为 http://192.168.x.x:3000，并在开发者工具中关闭域名校验。
const API_BASE = 'https://scoreeverything.com'

module.exports = {
  API_BASE: API_BASE.replace(/\/$/, ''),
}
