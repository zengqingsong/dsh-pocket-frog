# 本地联调（让本机 dsh web 跑仓库里的代码）

改完代码想在本机 `dsh web` 里直接验证，**不用发版、不用重装**：把已安装的插件换成指向本地仓库的链接，重启 `dsh web` 后加载的就是你仓库里的代码。

原理：dsh 的插件装在 profile 的 `node_modules` 里（pnpm 管的目录）。把它换成指向本地仓库的链接，插件加载路径就变成了你的工作区。

| 系统 | 插件目录 |
| --- | --- |
| Windows | `%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-pocket-frog` |
| macOS / Linux | `~/.dsh/profiles/web/node_modules/dsh-pocket-frog` |

`$DSH_HOME` 默认是 `~/.dsh`（Windows 为 `%USERPROFILE%\.dsh`），改过就换成实际路径；桌面版把路径里的 `web` 换成 `desktop`。

## 一、建立链接（只需做一次）

### Windows（PowerShell）

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web\node_modules"
Remove-Item dsh-pocket-frog -Recurse -Force

# 下面两条二选一：
# a) 有开发者模式或管理员权限 → 符号链接
New-Item -ItemType SymbolicLink -Path dsh-pocket-frog -Target "D:\path\to\dsh-pocket-frog"
# b) 两者都没有 → 目录联接（junction），对 Node 来说效果一样
New-Item -ItemType Junction -Path dsh-pocket-frog -Target "D:\path\to\dsh-pocket-frog"

# 确认
Get-Item dsh-pocket-frog | Select-Object LinkType,Target
# LinkType  SymbolicLink（或 Junction）
# Target    D:\path\to\dsh-pocket-frog
```

### macOS / Linux

```sh
cd ~/.dsh/profiles/web/node_modules

rm -rf dsh-pocket-frog
ln -s /你的/仓库/绝对路径/dsh-pocket-frog dsh-pocket-frog

ls -l dsh-pocket-frog
# dsh-pocket-frog -> /你的/仓库/绝对路径/dsh-pocket-frog
```

## 二、日常改代码

| 改了哪里 | 要做什么 |
| --- | --- |
| `lib/**`（代理、隧道、RPC、设置） | 重启 `dsh web` |
| `client/**`（设置页 / 移动端适配） | 先打包，再重启 `dsh web` |
| `package.json`、`cordis.patch.yml`（`inject`、`dsh` 字段） | 重启 `dsh web`（刷新页面不够） |

```sh
npm install              # 首次（仓库要有依赖，否则 cordis/cosmokit 解析不到）
node client/build.mjs    # 改 client/ 后必做，等价 npm run build:client
npm test                 # 纯本地单测，建议顺手跑（当前 180 个用例）
npm run test:local       # 真机冒烟：需 dsh web 在 3080 跑着 + cloudflared 可用
```

**为什么改前端也得重启**：前端 bundle 的 URL 带一个内容哈希 `rev`（`.../client.js&rev=0879dc0ff8ba`），响应头是 `cache-control: immutable`。这个 `rev` 在 `dsh web` 启动时就定好了，之后你重新打包、文件内容确实变了（服务端是实时读盘的），但 URL 没变，浏览器就一直拿缓存里的旧文件。所以：**打包 → 重启 → 再刷新页面**。

### 重启 dsh web

先停掉旧的，再重新拉起。日志在哪取决于你怎么起：终端里前台跑 → 日志就在终端里（正好给第三节用）；用下面的 detached 一行 → 日志落在临时文件。

Windows（PowerShell）：

```powershell
# 1) 停掉当前 dsh web（插件自带的提示同义：netstat -ano | findstr :3080 → taskkill /PID <PID> /F）
Get-NetTCPConnection -LocalPort 3080 -State Listen | Select-Object LocalAddress,OwningProcess
Stop-Process -Id <PID> -Force

# 2) 重新拉起：新开一个终端跑 dsh web 最省事
dsh web

#    想让它脱离终端（关掉终端也不停、日志落文件）就用这条
Start-Process -FilePath "cmd.exe" -ArgumentList '/c dsh web > "%TEMP%\dsh-web-dev.log" 2>&1' -WindowStyle Hidden

# 3) 等服务起来
curl.exe -s -o NUL -w "3080:%{http_code}`n" http://127.0.0.1:3080/   # dsh web（未带启动 token 会 401，正常）
curl.exe -s -o NUL -w "3081:%{http_code}`n" http://127.0.0.1:3081/   # 插件代理（未登录会返回登录页）
```

macOS / Linux：

```sh
# 1) 停掉当前 dsh web
kill $(lsof -ti :3080 -sTCP:LISTEN)

# 2) 重新拉起
dsh web

#    想让它脱离终端、日志落文件：把 dsh 换成下面这段
node -e "
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const out = fs.openSync('/tmp/dsh-web-dev.log', 'a');
const err = fs.openSync('/tmp/dsh-web-dev.log', 'a');
spawn('$(command -v dsh)', ['web'], {
  detached: true, stdio: ['ignore', out, err], env: process.env, cwd: process.env.HOME,
}).unref();
"

# 3) 等服务起来
curl -s -o /dev/null -w "3080:%{http_code}\n" http://127.0.0.1:3080/
curl -s -o /dev/null -w "3081:%{http_code}\n" http://127.0.0.1:3081/
```

> 为什么要 detached：在终端里前台跑，关掉终端进程就没了。插件自己的「一键更新 / 重启」（`lib/restart.js`）用的是同一套做法：先起 detached 辅助进程，轮询等端口真正释放（最多 20s）再拉起新 dsh，日志写在临时目录 `dsh-pocket-frog-restart-*.out.log`。

## 三、确认加载的确实是本地代码

**1）装的位置就是你的仓库**（决定性证据：dsh 从那里加载插件）

上面 `Get-Item` / `ls -l` 看到的 Target/LinkType 指向你的工作区，而不是 `.pnpm/...` 里的正式安装。

**2）页面拿到的 bundle 里有你刚改的东西**

dsh web 自己（3080）有启动 token 保护，直接 `curl` 会 401；从插件代理（3081）走，带上局域网密码就行（代理会把启动 token 补上）。

Windows（PowerShell）：

```powershell
$jar = "$env:TEMP\pocket-cookie.txt"

# 局域网密码开着才需要先登录（本机 curl 也按局域网地址处理）
$pin = (Get-Content "$env:USERPROFILE\.dsh\dsh-pocket-frog\token-lan" -Raw).Trim()
curl.exe -s -c $jar -d "token=$pin" http://127.0.0.1:3081/pocket-login -o NUL

# 取页面（boot manifest 在里面），抽出插件那组 bundle 的 URL
$html = (curl.exe -s -b $jar http://127.0.0.1:3081/) -join "`n"
$url  = ($html -split '"' | Where-Object { $_ -like '*dsh-pocket-frog/client.js*' } | Select-Object -First 1) -replace '&amp;','&'
$url

# 下载真正下发给浏览器的 bundle，搜你刚改的那句界面文案
curl.exe -s -b $jar "http://127.0.0.1:3081/$url" -o "$env:TEMP\pocket-bundle.js"
Select-String -Path "$env:TEMP\pocket-bundle.js" -Pattern '你刚改的那句界面文案' -SimpleMatch
```

macOS / Linux：

```sh
JAR=/tmp/pocket-cookie.txt
PIN=$(cat ~/.dsh/dsh-pocket-frog/token-lan)
curl -s -c $JAR -d "token=$PIN" http://127.0.0.1:3081/pocket-login -o /dev/null

URL=$(curl -s -b $JAR http://127.0.0.1:3081/ | tr '"' '\n' | grep 'dsh-pocket-frog/client.js' | head -1 | sed 's/&amp;/\&/g')
echo "$URL"

curl -s -b $JAR "http://127.0.0.1:3081/$URL" -o /tmp/pocket-bundle.js
grep -c '你刚改的那句界面文案' /tmp/pocket-bundle.js
```

搜得到 = 本地产物已上线。搜不到 = 忘了打包、重启没成功（看日志），或者浏览器还在用旧 bundle（硬刷新 `Ctrl+Shift+R` / `Cmd+Shift+R`）。

**3）后端（`lib/`）看启动日志**

插件启动时会打印自己的行，能在其中确认代理端口、桌面端、自定义 cloudflared 等分支（在终端里跑 `dsh web` 就直接看终端输出）：

```powershell
Select-String -Path "$env:TEMP\dsh-web-dev.log" -Pattern 'dsh-pocket-frog' | Select-Object -Last 5
```

```sh
grep 'dsh-pocket-frog' /tmp/dsh-web-dev.log | tail -5
```

看到 `dsh-pocket-frog: proxy ready on :3081 | 局域网代理已就绪` 说明代理起来了。想确认「跑到的是我改的那行」，临时在 `lib/index.js` 里加一句 `logger.info('[local-dev] loaded')`，重启后在这份日志里找它，验证完删掉即可。

## 四、换回正式版本（GitHub 源码）

新版重命名后**尚未发布到 npm**，正式版从 GitHub 仓库装（详见 README 的[安装（从 GitHub 源码）](./README.zh-CN.md#安装从-github-源码)）：

```sh
dsh plugin --profile web add github:zengqingsong/dsh-pocket-frog -w
```

重装会把链接换回 pnpm 的正式安装：

```powershell
# Windows：LinkType 为空 = 已经是真实目录（换回来了）
Get-Item "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-pocket-frog" | Select-Object LinkType,Target
```

```sh
# macOS / Linux：不再指向你的仓库就说明换回来了
ls -l ~/.dsh/profiles/web/node_modules/dsh-pocket-frog
```

之后重启 `dsh web` 即可。

> 从更老的版本（原名 `dsh-pocket`）过来，先卸掉旧包，避免两个插件各起一个代理：`dsh plugin --profile web remove dsh-pocket -w`。

---

## 注意事项

- **链接期间，你日常用的 dsh web 跑的都是本地仓库代码**（包括未提交的改动）；别人从仓库装到的仍是正式版，两边互不影响。
- 本地仓库需要装过依赖（`npm install`），否则 `lib/` 用到的 `cordis` / `cosmokit` 等解析不到，插件会静默加载失败。
- 改完 `client/` 忘了打包，界面不会变（dsh web 加载的是 `client/client.js` 产物，不是 `index.jsx` 源码）；改完 `lib/` 忘了重启，行为也不会变。
- 电脑重启后自己正常启动 dsh web 即可，链接是持久的，仍然加载本地代码。
- 桌面版（`desktop` profile）不吃这套：更新与重启由 DSH Desktop 自己管，本插件不接管自重启。

## 常见问题

**手机页面没变化**：多半是忘了 `node client/build.mjs`，或者重启没成功——看 `%TEMP%\dsh-web-dev.log` / `/tmp/dsh-web-dev.log`，然后硬刷新。

**代理端口 3081 起不来**：插件没加载成功。检查链接路径、仓库依赖；也可以看日志里有没有 `proxy ready on :3081`。

**端口被占**：代理会自己顺延到下一个端口，日志里会写 `port 3081 busy, proxy on 3082 | 端口 3081 被占用，代理改用 3082`（最多试 10 个，`lib/service.mjs`）。想固定端口就在 `$DSH_HOME/dsh-pocket-frog/settings.json` 写 `"proxyPort": 3082` 再重启 `dsh web`。查占用：Windows `Get-NetTCPConnection -LocalPort 3081 -State Listen`，macOS/Linux `lsof -ti :3081`。

**Windows 建链接被拒（要管理员）**：改用目录联接 `New-Item -ItemType Junction`，它不需要管理员也不需要开发者模式。

**只想验证代理 / 隧道逻辑，不想动 dsh 的安装**：`dsh web` 在 3080 跑着的前提下直接 `node bin/dsh-pocket-frog.mjs`（可加 `--port` / `--pin` / `--public`）。这条路径不经过 dsh 的插件加载，所以设置页 UI 的改动验证不了。
