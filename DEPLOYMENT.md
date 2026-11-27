# 自动上线

推送到 `master` 会自动部署网页和后端。为兼容仓库当前分支，`main` 也会触发同一套流程。

- 网页：`https://jianxiujiucan.cn/math/`
- 健康检查：`https://jianxiujiucan.cn/math/api/health`
- 工作流：`.github/workflows/deploy.yml`
- 服务器脚本：`deploy/production.sh`

> 本地 `git commit` 不会上线；必须 `git push` 到 GitHub。

## 一次性配置

首次使用需要让 GitHub Actions 能通过 SSH 登录现有阿里云服务器。不要把私钥提交到仓库。

### 1. 创建专用部署密钥

在本地 PowerShell 执行，自动化用途不要设置私钥密码：

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\math-github-deploy" -C "github-actions-math"
Get-Content "$env:USERPROFILE\.ssh\math-github-deploy.pub" |
  ssh root@47.107.142.221 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
```

第二条命令需要输入一次现有服务器密码。公钥只授权登录，不包含私钥。

验证专用密钥：

```powershell
ssh -i "$env:USERPROFILE\.ssh\math-github-deploy" root@47.107.142.221 "systemctl is-active math-challenge"
```

### 2. 配置 GitHub Secrets

打开 GitHub 仓库 `jianxiujiucan/math`，进入 **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret | 值 |
| --- | --- |
| `DEPLOY_HOST` | `47.107.142.221` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | 本地 `math-github-deploy` 私钥文件的完整内容，包括首尾 `OPENSSH PRIVATE KEY` 行 |

私钥只粘贴到 GitHub Secrets，不要发到聊天、提交到 Git 或写进项目文件。

服务器必须保留 `/opt/math-challenge/math-server/.dev.vars`。脚本会保留该文件，不会把本地开发密钥上传生产。

## 日常上线

当前分支：

```bash
git add -A
git commit -m "更新速算挑战"
git push origin main
```

使用 `master` 时：

```bash
git push origin master
```

然后在 GitHub 仓库的 **Actions** 页面查看部署。任何一个测试、类型检查或构建步骤失败，都不会修改线上版本。

## 发布与回滚保护

服务器先在暂存目录安装生产依赖，再替换程序目录并重启 `math-challenge.service`。本地 API 和公网 HTTPS 健康检查都通过才算发布成功。

失败时脚本自动恢复旧目录并重启旧版本。最近五份可用备份保存在：

```text
/opt/math-challenge/.deploy-backup-*
```

排查命令：

```bash
systemctl status math-challenge
journalctl -u math-challenge -n 100 --no-pager
curl https://jianxiujiucan.cn/math/api/health
```
