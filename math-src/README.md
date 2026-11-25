# 速算挑战（math-src）

面向小学一、二年级的移动端口算练习 Web 应用。支持加法、减法、乘法、除法及混合运算，并提供账号、成绩存档、答题明细和排行榜。

## 功能

- 每组可选 10、20、50、100 题，一页一题。
- 支持仅加法、仅减法、加减混合、仅乘法、仅除法、乘除混合。
- 加减法支持 10、20、100 以内，以及两个数或三个数运算。
- 乘除法使用 100 以内的表内乘除，保证除法可以整除。
- 可开启进位/退位练习，提高相应题目的出现概率。
- 按每题首次作答计分；答错后可重试，答对后自动跳题，并提供数字键盘、计时、音效和百分制成绩。
- 支持访客练习；登录后自动保存成绩。
- 提供注册登录、邮箱验证码找回密码、个人统计、历史记录、逐题详情、排行榜和管理员重置密码。

## 技术栈

- Vue 3 + TypeScript
- Vue Router（hash 模式）
- Vite 8
- Sass
- Vitest

项目未使用 UI 组件库和全局状态库。轻量共享状态位于 `src/stores/`，页面、组件和纯工具函数分层组织。

## 本地开发

建议使用 Node.js 22。

```bash
cd math-src
npm install
npm run dev
```

开发服务器默认地址为 `http://localhost:5173/`。前端开发环境默认请求 `http://localhost:3000`，因此联调账号、记录和排行榜前，还需启动同级目录的 `math-server`：

```bash
cd ../math-server
npm install
# 按 math-server/README.md 配置 .dev.vars
npm run dev
```

只使用出题和访客答题功能时，不启动后端也可以运行页面。

## 环境变量

| 文件 | 变量 | 当前用途 |
| --- | --- | --- |
| `.env.development` | `VITE_API_BASE=http://localhost:3000` | 本地后端 |
| `.env.production` | `VITE_API_BASE=https://scoreeverything.com` | 线上后端 |

`VITE_API_BASE` 末尾不要带 `/`。留空时表示请求与页面同源。

## 常用命令

```bash
npm run dev         # 启动开发服务器
npm run type-check  # Vue 与 TypeScript 类型检查
npm test            # 运行出题、校验和登录状态测试
npm run build       # 类型检查并构建生产版本
npm run preview     # 本地预览构建产物
```

构建配置中的 `base` 为 `/`，产物输出到 `math-src/dist/`。部署时将 `dist/` 内的文件发布到站点根目录；如果以后需要恢复子路径部署，再同步调整 `vite.config.ts` 中的 `base`。

## 目录结构

```text
math-src/
├── src/
│   ├── api/          # 请求封装、接口与本地 token
│   ├── assets/       # 音效和声音开关图标
│   ├── components/   # 登录表单、选项组、数字键盘等
│   ├── composables/  # 计时、音效和移动端检测
│   ├── router/       # 页面路由与登录守卫
│   ├── stores/       # 当前用户和当前答题状态
│   ├── styles/       # 全局样式与设计变量
│   ├── types/        # 答题及 API 类型
│   ├── utils/        # 出题、校验、格式化和选项
│   └── views/        # 入口、设置、答题、个人中心等页面
├── tests/            # Vitest 测试
├── docs/             # 原始需求文档
└── vite.config.ts    # 开发、构建和测试配置
```

## 出题规则要点

- 加减法操作数不为 0；两数减法的结果不为 0，三个数连减允许结果为 0。
- 开启进位/退位后优先使用不小于 4 的操作数，约 75% 的题强制满足进位或退位；组合无解时自动放宽约束。
- 纯加法、纯乘法按排序后的操作数去重，其余按算式顺序去重。
- 候选组合不足时会补足题数，因此小范围、高题量的组合可能出现重复题。
- 每题记录表达式、用户答案、正确答案、正误和单题耗时，最后一场结束后整体提交，由服务端复核。

## 后端接口

后端实现及部署说明见 [`../math-server/README.md`](../math-server/README.md)。主要接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册并登录 |
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/quiz-sessions` | 保存一场答题成绩 |
| `GET` | `/api/profile` | 用户资料和统计 |
| `GET` | `/api/profile/sessions` | 分页答题记录 |
| `GET` | `/api/profile/sessions/:id` | 单场逐题详情 |
| `GET` | `/api/leaderboard` | 分运算类型排行榜 |
| `POST` | `/api/admin/reset-password` | 管理员重置密码 |

微信小程序版本位于同级目录 [`../math-miniprogram`](../math-miniprogram)，与本项目共用后端接口。
