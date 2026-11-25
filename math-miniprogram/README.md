# 速算挑战微信小程序

由 `math-src` 的 Vue Web 版移植而来的原生微信小程序，与 `math-server` 共用账号、成绩和排行榜接口。不依赖 Taro、uni-app 或第三方组件库。

## 已实现功能

- 注册、登录、退出及 token 本地持久化
- 注册邮箱验证码找回密码，支持 60 秒重发倒计时
- 访客答题和登录后保存成绩
- 10、20、50、100 题一组
- 加、减、加减混合、乘、除、乘除混合
- 10、20、100 以内，两个数或三个数运算
- 进位/退位倾向、组内去重及候选不足时补足题数
- 一页一题、内置数字键盘、首次作答计分、答错重试、答对自动跳题
- 进度、计时、音效、百分制得分及结果总结
- 成绩自动上传、失败重试、访客登录后恢复并补传成绩
- 个人统计、分页答题记录、逐题详情、分类排行榜
- 忘记密码指引和管理员重置密码页面

## 导入项目

1. 打开微信开发者工具，选择“导入项目”。
2. 目录选择本文件夹 `math-miniprogram`。
3. 测试时可使用测试号；正式发布前，把 `project.config.json` 中的 `appid` 换成自己的小程序 AppID。
4. 点击“编译”，首页为登录/注册页，也可以直接选择“访客模式”。

无需执行 `npm install`。`package.json` 中的命令只用于在 Node.js 下测试纯逻辑，不是小程序构建命令。

## 配置后端

接口地址集中在 `config.js`：

```js
const API_BASE = 'https://scoreeverything.com'
```

### 开发者工具联调

默认地址沿用 Web 版线上接口。若该域名尚未配置到当前小程序账号，可在开发者工具的“详情 → 本地设置”中勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。

连接本机后端时：

1. 按 `../math-server/README.md` 启动后端，默认端口为 3000。
2. 模拟器可将 `API_BASE` 临时改为 `http://localhost:3000`。
3. 真机不能通过电脑的 `localhost` 访问后端，应改为电脑局域网 IP，并保证手机与电脑在同一网络。

### 真机预览与发布

正式环境必须使用 HTTPS。登录微信公众平台，在“开发管理 → 开发设置 → 服务器域名”中，将接口域名加入 `request 合法域名`。仅关闭开发者工具的域名校验不会绕过真机正式发布要求。

本项目沿用原系统的用户名/密码账号体系，不调用 `wx.login`、`getUserProfile`，也不会把微信 openid 与现有账号自动绑定。

## 页面与目录

```text
math-miniprogram/
├── assets/media/          # 正误音效及声音开关图标
├── components/
│   ├── numeric-keypad/    # 内置数字键盘
│   ├── pill-group/        # 设置项与排行榜选项
│   └── sound-toggle/      # 音效开关
├── custom-tab-bar/        # 登录后显示的底部导航
├── pages/
│   ├── entry/             # 登录、注册、访客入口
│   ├── setup/             # 答题设置
│   ├── quiz/              # 判题、计时、结果与上传
│   ├── leaderboard/       # 排行榜
│   ├── profile/           # 统计和答题记录
│   ├── session-detail/    # 单场逐题明细
│   ├── forgot/            # 找回密码说明
│   └── admin/             # 管理员重置密码
├── utils/
│   ├── api.js             # wx.request 与统一错误处理
│   ├── auth.js            # token 和用户信息存储
│   ├── generator.js       # 与 Web 版一致的出题算法
│   ├── quiz-session.js    # 当前场次恢复与登录后补传
│   └── ...                # 校验、格式化、选项、音效
├── app.json               # 页面、窗口和自定义 tabBar 配置
├── config.js              # 后端地址
└── project.config.json    # 微信开发者工具项目配置
```

## 测试

建议使用 Node.js 22：

```bash
cd math-miniprogram
npm test
```

测试直接运行小程序使用的 CommonJS 工具模块，覆盖全部运算类型、范围、运算项个数和进位/退位组合，同时检查答案、非负整数、除法整除、去重、输入校验和时间格式化。

## 同步维护

出题规则分别存在于：

- `math-src/src/utils/generator.ts`
- `math-miniprogram/utils/generator.js`
- `math-server/src/expr.ts`（服务端复核表达式）

修改出题规则时需要同步检查这三处。账号校验规则也需与 `math-src/src/utils/validate.ts` 和 `math-server/src/validate.ts` 保持一致。
