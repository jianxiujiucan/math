# math-server

速算挑战盒后端（Hono + MySQL 8）：注册登录、答题成绩存档、个人中心、记录详情和排行榜。

- 运行环境：Node.js 22（本地开发或 VPS）
- 数据库：MySQL 8+，驱动为 `mysql2`
- 数据表：首次请求时自动创建缺少的表，已有数据不会被清空
- 找回密码：注册邮箱验证码，也保留管理员人工重置

> MySQL 驱动依赖 Node.js 网络能力，当前版本不再使用 Cloudflare Workers、Hyperdrive 或 Supabase。

## 一、准备 MySQL

可以使用本机 MySQL，也可以使用远程 MySQL。数据库需要允许创建表和索引，推荐 `utf8mb4`：

```sql
CREATE DATABASE IF NOT EXISTS math_quiz
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'math_quiz_app'@'localhost' IDENTIFIED BY '请换成应用账号密码';
GRANT ALL PRIVILEGES ON math_quiz.* TO 'math_quiz_app'@'localhost';
FLUSH PRIVILEGES;
```

通过 `127.0.0.1` 连接但提示账号不存在时，再为 `'math_quiz_app'@'127.0.0.1'` 创建同名账号并授予相同权限。

## 二、本地启动

```bash
cd math-server
npm install
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```env
DATABASE_URL=mysql://math_quiz_app:应用账号密码@127.0.0.1:3306/math_quiz
JWT_SECRET=一个足够长的随机字符串
ADMIN_TOKEN=管理员口令
```

密码中的 `@`、`+`、`#`、`:`、`/` 等字符需要进行 URL 编码，例如 `+` 写成 `%2B`。`.dev.vars` 已被 Git 忽略，不要提交真实密码。

邮箱验证码还需要 SMTP 配置（以 QQ 邮箱为例，密码位置填写 SMTP 授权码）：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的邮箱地址
SMTP_PASS=邮箱SMTP授权码
MAIL_FROM="速算挑战 <你的邮箱地址>"
```

验证码为 6 位数字，15 分钟有效，每个邮箱每分钟最多发送一次，错误 5 次后失效。无论邮箱是否注册，发送接口均返回统一提示。

启动并验证：

```bash
npm run dev
# 另一个终端：
curl http://localhost:3000/api/health
# {"ok":true}
```

修改 `.dev.vars` 后需要重启进程。健康检查也会初始化数据表，因此数据库不可用时会返回 500。

## 三、网页版与小程序共用数据库

两端只有请求**同一个后端地址**时才共享账号、答题记录和排行榜。

网页版本地配置（`math-src/.env.development`）：

```env
VITE_API_BASE=http://localhost:3000
```

微信小程序模拟器（`math-miniprogram/config.js`）：

```js
const API_BASE = 'http://127.0.0.1:3000'
```

手机真机不能使用电脑的 `127.0.0.1`，应改成电脑局域网 IP：

```js
const API_BASE = 'http://192.168.x.x:3000'
```

开发阶段可在微信开发者工具的“详情 → 本地设置”中关闭合法域名校验。正式发布必须使用 HTTPS，并在微信公众平台配置 `request 合法域名`。

## 四、接口清单

统一错误格式：`{ "error": { "code": "...", "message": "..." } }`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册并登录 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户（需 Bearer token） |
| POST | `/api/auth/forgot-password` | 向注册邮箱发送找回验证码 |
| POST | `/api/auth/reset-password` | 校验邮箱验证码并重置密码 |
| POST | `/api/admin/reset-password` | 管理员重置密码（需 `X-Admin-Token`） |
| POST | `/api/quiz-sessions` | 保存一场答题成绩，事务写入场次与逐题记录 |
| GET | `/api/profile` | 用户信息与统计（需登录） |
| GET | `/api/profile/sessions?page=1&pageSize=10` | 分页答题记录（需登录） |
| GET | `/api/profile/sessions/:id` | 单场逐题详情（仅本人） |
| GET | `/api/leaderboard?op_type=add` | 排行榜（公开） |
| GET | `/api/health` | 健康检查 |

排行榜按每种运算类型取每用户「平均每题用时」最佳的一场，仅正确率不低于 90% 的场次上榜，前 50 名。

## 五、开发检查

```bash
npm run dev          # tsx watch 热重载
npm run start        # 非 watch 模式启动
npm test             # 表达式、配置、MySQL DDL 和找回验证码测试
npm run type-check   # TypeScript 检查
```

## 六、VPS 部署

当前版本按 Node 服务部署：

1. VPS 安装 Node.js 22 和 MySQL 8+，创建数据库及应用账号。
2. 将代码放到 `/opt/math/math-server`，执行 `npm install`。
3. 配置 `.dev.vars`，不要把密码写入 Git。
4. 参考 `deploy/math-api.service` 配置 systemd。
5. 使用 `deploy/Caddyfile.example` 配置 HTTPS 反向代理。

```bash
systemctl daemon-reload
systemctl enable --now math-api
curl http://127.0.0.1:3000/api/health
```

## 七、MySQL 兼容说明

- 用户表使用 `utf8mb4_unicode_ci`，用户名和邮箱按大小写不敏感处理，数据库唯一约束防止重复注册。
- `carry`、`is_correct` 使用 `TINYINT(1)`，接口返回前转换为布尔值。
- `DATETIME` 按 UTC 处理，接口序列化为 ISO 时间，前端转换为本地时区。
- 排行榜使用 MySQL 8 的 CTE 与窗口函数；MySQL 5.7 及更早版本不受支持。
