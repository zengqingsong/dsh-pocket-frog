# DSH Pocket · dsh-pocket-frog

**English** · [简体中文](./README.zh-CN.md)

[![ci](https://github.com/zengqingsong/dsh-pocket-frog/actions/workflows/test.yml/badge.svg)](https://github.com/zengqingsong/dsh-pocket-frog/actions/workflows/test.yml)

<p align="center">
  <img src="docs/banner.jpg" alt="DSH Pocket" width="100%">
</p>

Put **DeepSeek Harness in your pocket**: `dsh web` runs on your computer, and scanning a QR code puts the very same interface in your hand — over LAN or the public internet, live, from anywhere.

> 🚧 **Work in progress — local use first**: the renamed version is **not on npm and not listed in the plugin marketplace yet** ([dsh-plugin.org](https://dsh-plugin.org/) discovers plugins automatically by scanning GitHub repos carrying the `dsh-plugin` topic, and this repo does not have that topic yet), so for now it can only be installed from GitHub source (see "Install" below). A proper release will come once the tests are in good shape.

Forked from [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) (GPL-2.0, Copyright (c) 2026 shaobeichen). The upstream notice is kept verbatim in [LICENSE](./LICENSE), and what this fork did on top of it is listed under [Credits](#credits).

- **Unofficial community plugin** — an independent project, not affiliated with or endorsed by DeepSeek.
- **GPL-2.0**, one package, with just two runtime dependencies (`qrcode` and `qrcode-terminal`).
- Traffic only ever goes through your own machine: **LAN mode makes no outbound connections**; only when you click "Enable anywhere" does it use [cloudflared](https://github.com/cloudflare/cloudflared) to open a tunnel to your own Cloudflare, and nothing else is contacted.
- Access always requires a password: the LAN has its own (on by default, can be turned off) and the public URL gets a random 8-character password (rotated on every enable, or pin your own). Details under "Security (read first)".
- **Targets DSH `0.1.7-rc.2` on the `web` profile**. Installing runs **no build script**: the client bundle ships inside the package, so it works right after install.

## What is this

**You want to use DeepSeek Harness on your computer, even when you're not at the computer.**

- On your way home, the agent is running a task on your computer — pull out your phone and see where it is, what it produced.
- Out and about, you want the agent on your computer to look something up or write a snippet — no remote desktop, no SSH.
- The computer is at home or in the office, you're elsewhere, and you want to **drive your DeepSeek Harness from your phone** — send tasks, watch the output, tap approvals.

That's what DSH Pocket does: **install it, scan a QR code, and your phone shows and controls the DeepSeek Harness UI in real time — from anywhere.**

What it looks like — the phone shows the exact same UI as your computer, live:

<p align="center">
  <img src="docs/interface.jpg" alt="DSH UI on the phone" width="100%">
</p>

## Features

| Feature                      | Description                                                                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📶 LAN QR access             | Works out of the box: Settings → Phone access — scan the LAN QR on the same Wi-Fi (auto-detects the LAN IP; **under WSL it picks the Windows host's physical NIC IP**)                                                                                                            |
| 🚪 LAN switch                | **Turn LAN access off/on with one click** in Settings (a confirmation dialog shows each time): off kills the LAN QR code and link instantly; public access is unaffected                                                                                                          |
| 🌐 Public QR (from anywhere) | Click "Enable anywhere" → cloudflared tunnel → scan the public QR over 4G / any network                                                                                                                                                                                           |
| 🏷️ Fixed public hostname     | Optional "**Named tunnel**" mode: paste a Cloudflare Tunnel Token + your own domain — the public address stays **fixed across restarts** (see below)                                                                                                                              |
| 🔐 Access PIN                | Public links use an **8-digit random PIN** by default (rotated on every tunnel start; **customizable to a fixed PIN** — custom PINs are not rotated); LAN has its own separate **8-digit random PIN** (on by default; switchable off in Settings — then LAN scans connect directly) |
| 🔑 Custom PINs               | Both the public and LAN PINs can be **set to a fixed 8–64-character PIN using letters and digits in Settings** (custom PINs are never auto-rotated)                                                                                                                               |
| 🧘 Session persistence       | Enter the PIN once and you're set for a long time (login is tied to the computer's dsh web process: as long as it stays up, the phone won't ask again; **after a dsh web restart/update, enter it once more**)                                                                    |
| ⚡ Real-time sync            | Streaming output passes through WebSocket untouched — what the computer renders, the phone renders live; fully interactive both ways; built-in WS heartbeat keep-alive (defeats silent NAT/battery link drops with auto-reconnect)                                                |
| 📱 Mobile-adaptive layout    | Narrow screens get a drawer layout automatically (ported from dsh-web-mobile, MIT): sidebar drawer, full-width conversation, safe-area insets, touch optimizations                                                                                                                |
| 🧭 Optional right sidebar    | Shows the native right-sidebar entry on mobile; disable it for a compact phone header or keep it available alongside the terminal dock on an unfolded display                                                                                                                     |
| 📁 File browser              | The mobile "Files" entries need a host-side explorer panel (a dsh-web-ui component); on stock DSH without it the entries are auto-hidden instead of doing nothing                                                                                                                 |
| 🗜️ Transfer compression      | Large JSON responses are gzip/brotli'd on the fly (17MB session history → ~1MB; brotli quality 6: fast and bandwidth-friendly) — faster loads, less mobile data                                                                                                                   |
| 🔁 Tunnel auto-restore       | After a DSH restart the previously-running public tunnel comes back automatically                                                                                                                                                                                                 |
| 🧩 Zero-dependency install   | One package, one settings tab — no core/adapter split, no account, no server. The repo ships the built frontend, so **installing from GitHub source just works with no local build**                                                                                                |

## Usage

**Where the entry is**: after installing and restarting `dsh web`, open **Settings** — the left sidebar shows **"Phone access"** at the top level (same level as General / Models):

<p align="center">
  <img src="docs/entry.jpg" alt="Phone access entry" width="70%">
</p>

**Prerequisite**: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installed. If your terminal says `dsh: command not found`, install it first:

```sh
npm install -g @deepseek-ai/dsh     # global install; verify: dsh --version
# No global install? Prefix every command with: npx @deepseek-ai/dsh
```

### Install (from GitHub source)

> ⚠️ **For now you can only install from GitHub source**: the plugin was renamed from `dsh-pocket` to `dsh-pocket-frog` and **the new name is neither on npm nor in the plugin marketplace yet** (`npm view dsh-pocket-frog` → 404; `dsh-market` only lists the old `dsh-pocket`, which points at the upstream repository). So **don't use the package name** — use the repository URL. `add dsh-pocket-frog` will only work once it is published.

```sh
# 1. Install the plugin (from GitHub source; everything in one package)
dsh plugin --profile web add github:zengqingsong/dsh-pocket-frog -w

# 2. Restart dsh web
npx @deepseek-ai/dsh web
```

The package ships the built frontend (`client/client.js`), so **it works right after install — no local build**.

> To pin a commit or branch: `... add github:zengqingsong/dsh-pocket-frog#<sha or branch> -w`.

### LAN (same Wi-Fi)

Settings → **Phone access** → scan the "📶 LAN" QR code → enter the **LAN PIN** (shown in the LAN block; hit **Refresh** to roll a new one, or **Customize** to set an 8–64-character alphanumeric PIN) → the phone opens the exact same DSH, in real time.

> The "**LAN access**" switch is **on by default** and can be **turned off/on with one click** (a confirmation dialog shows each time). Off kills the LAN QR code and link instantly (phones can't open them); **public access is unaffected**. Tap "On" to restore it.
>
> The LAN PIN is **on by default** (security-first). If you're the only user and find typing it every time annoying, flip "LAN access PIN" to **Off** in the LAN block — LAN scans then connect directly with no PIN (LAN-only devices; the **public tunnel always requires a PIN**, unaffected).
>
> After logging in once, the phone **won't ask again**: as long as the computer's dsh web keeps running, reopening the phone needs no PIN (**a dsh web restart/update asks for it once more**).
>
> Advanced option: auto-detection may not pick a reachable address for Tailscale/VPN setups. You can select a detected IP from the "LAN address" dropdown; normally no change is needed.

### Public (from anywhere)

On the same page click "**Enable anywhere**" → **a security disclaimer pops up every time — check "I understand and agree" to proceed** (on a corporate/classified network, confirm compliance first) → wait for the tunnel (first run downloads cloudflared; macOS/Linux use the Tsinghua mirror, seconds) → scan the "🌐 Public" QR code → the phone opens the link and **enters the access PIN** (shown in the settings page's public section; the default is an **8-digit random PIN rotated on every tunnel start**, or use **Customize** for a fixed 8–64-character alphanumeric PIN that is never rotated) → works from outside (4G / office network).

> **Upgrading to the latest source**: source installs ignore semver ranges, so just run the install command again (pnpm re-resolves the newest commit and replaces the local copy):
>
> ```sh
> dsh plugin --profile web add github:zengqingsong/dsh-pocket-frog -w
> ```
>
> Then restart `dsh web`. The in-page "Update" button does the same thing (`pnpm update` under the hood), but with a source install prefer the command above — it's more reliable.

### Fixed public hostname (named tunnel, optional)

The default "quick tunnel" gets a new random URL on every restart. For a **fixed public address**, use a Cloudflare **named tunnel** (requires a Cloudflare account + your own domain):

1. In [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks → Tunnels**, create a Tunnel and copy the **Tunnel Token**
2. In that Tunnel's **Public Hostname**, point your domain (e.g. `pocket.example.com`) to `http://127.0.0.1:3081`
3. Back in the settings page's public section: switch the mode to "**Named tunnel**", paste the Tunnel Token, enter the fixed hostname, and save
4. Click "Enable anywhere" → the public address is now your own hostname and **survives restarts**

Note: in named-tunnel mode the public PIN is **not auto-rotated** (the address is fixed, so the PIN stays the same across restarts) — manage it proactively with a custom PIN. The Tunnel Token is stored locally only (`$DSH_HOME/dsh-pocket-frog/settings.json`, readable by your user only) and is never echoed back in the UI.

## Security (read first)

- **DSH can execute code on your computer.** **LAN** QR/URL plus its own **8-character PIN** is the key (PIN **on by default**, switchable off — then LAN scans connect directly, same-network devices only) — **never share the LAN QR, URL or PIN**.
- **Read and accept the security disclaimer before enabling public access** (the dialog shows on every enable; the server enforces it, so it can't be bypassed): public = exposing a code-executing DSH to the internet — use a strong PIN, turn it off when done, never on classified networks.
- **Public** access uses an **8-digit random PIN** by default: the link is random, the PIN rotates on every tunnel start, and old links die instantly — even a leaked link can't get in. **A custom PIN may contain 8–64 letters and digits and is never auto-rotated**.
- Phone login state is tied to the computer's dsh web process: **no re-entry while dsh web stays up; one re-entry after a restart/update**.
- **Login rate limiting** (anti brute-force): **5** consecutive wrong PINs from the same IP lock it for **60s**; a global failure threshold briefly locks everyone (blocks distributed IP-rotation scans); a successful login resets the counter.
- The public URL is randomly assigned by cloudflared and **changes on every restart** (old links die automatically — a natural key rotation); in **named-tunnel fixed-hostname** mode the address stays and the PIN is not auto-rotated — manage it with a custom PIN.
- **Public detection is fail-closed** (issue #66): everything except loopback and private LAN addresses is treated as **public and PIN-gated** — including any self-hosted tunnel / reverse proxy pointing at the local port with its own hostname. There is no "change the domain to bypass the PIN" hole.
- LAN mode exposes nothing publicly; only devices on the same network can reach it.
- Built for personal use; the public PIN lives in `$DSH_HOME/dsh-pocket-frog/token` (re-rolled per tunnel start unless customized), the LAN PIN in `$DSH_HOME/dsh-pocket-frog/token-lan` (refreshed manually in Settings), and switches/custom flags in `$DSH_HOME/dsh-pocket-frog/settings.json`.

## DSH Desktop

- In the desktop app, **QR screen-mirroring works**; **update/restart are managed by the desktop app** (auto-disabled here).
- ⚠️ The desktop **advanced mode** doesn't support phone access yet (it disables the web layout; the phone gets no layout service → blank screen). Switch back to **compatibility** mode and restart; phones opening an advanced-mode page will see a clear notice overlay.

## Troubleshooting

| Symptom                                                                         | Cause & fix                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dsh: command not found` / "DSH is not defined"                                 | dsh CLI missing: `npm install -g @deepseek-ai/dsh`, or prefix commands with `npx @deepseek-ai/dsh`                                                                                                                                                                                                                                                                                                                               |
| `ERR_PNPM_ADDING_TO_ROOT`                                                       | pnpm 9 workspace-root restriction: append `-w` (`--workspace-root`) to install/update commands                                                                                                                                                                                                                                                                                                                                   |
| Nothing changed after install/update                                            | **You must restart `dsh web`**; the running process still loads the old code                                                                                                                                                                                                                                                                                                                                                     |
| `listen EADDRINUSE ... :3081`                                                   | A stale dsh-pocket-frog process holds the port: macOS/Linux `lsof -ti :3081 \| xargs kill -9`; Windows `netstat -ano \| findstr :3081` (find the LISTENING PID) → `taskkill /PID <PID> /F`, then retry                                                                                                                                                                                                                                |
| Want a different port (issue #70)                                               | Plugin mode: write `"proxyPort": 3082` into `$DSH_HOME/dsh-pocket-frog/settings.json` and restart `dsh web`. CLI mode: `dsh-pocket-frog --port 3082`. If the port is taken you'll get `EADDRINUSE` — kill the old process or pick another one                                                                                                                                                                                              |
| Issue a temporary PIN to a guest                                                | Not available: the temporary access PIN feature (issue #69) was removed in 2.6.x (it crashed on revoke). To share access, send the main PIN or a `?token=<main PIN>` link, then hit "Refresh" in Settings once the guest is done                                                                                                                                                                                                 |
| cloudflared install fails on a remote Linux server (issue #45)                  | If all CDN sources (GitHub / ghproxy / gh.ddlc / gh-proxy) are unreachable on a remote Linux host, install `cloudflared` yourself (e.g. `apt install cloudflared`, `dnf install cloudflared`, or download the tgz and unpack it), then add `"cloudflaredPath": "/path/to/cloudflared"` into `$DSH_HOME/dsh-pocket-frog/settings.json` and restart `dsh web`. The plugin will then use that binary directly and skip the auto-download |
| Install fails / `npm view dsh-pocket-frog` returns 404                          | The new name is **not on npm yet**: install from the repository — `dsh plugin --profile web add github:zengqingsong/dsh-pocket-frog -w` (**do not use the package name**)                                                                                                                                                                                                                                                          |
| The marketplace only shows `dsh-pocket`                                         | That is the **old name** — the entry points at the upstream repository and installs the pre-rename version. The new `dsh-pocket-frog` **is not listed yet**: the marketplace (dsh-plugin.org) picks plugins up automatically by scanning GitHub repos that carry the `dsh-plugin` topic, and this repo does not have that topic yet (nor an npm release). Use the source install command above for now, and install from the marketplace once it is released |
| Upgrading from the old `dsh-pocket` (the rename is a breaking change)            | Since the rename the package name / CLI command / RPC channel / cookie / env vars / state directory all changed (`dsh-pocket` → `dsh-pocket-frog`) and the two are **not interchangeable**: remove the old one first (`dsh plugin --profile web remove dsh-pocket -w`), install the new one from source as above (both can coexist, but each would run its own proxy for no reason), then restart `dsh web`. The old state directory `$DSH_HOME/dsh-pocket/` (PIN, settings, tunnel markers) is **not migrated** — the new `$DSH_HOME/dsh-pocket-frog/` starts fresh |
| Updating to the latest version                                                  | Source installs ignore semver ranges: run `dsh plugin --profile web add github:zengqingsong/dsh-pocket-frog -w` again to pull the newest commit, then restart `dsh web`                                                                                                                                                                                                                                                            |
| Public `error 1033`                                                             | See "Public tunnel troubleshooting" below — usually a local proxy/VPN (Clash etc. TUN mode) killing the tunnel                                                                                                                                                                                                                                                                                                                   |
| After "Restart dsh web", the page says the process is running in the background | The new process from in-page self-restart is a detached background process (not attached to your terminal) — that's the standard way to apply updates in-page; stop it: macOS/Linux `lsof -ti :3080 \| xargs kill -9`; Windows `netstat -ano \| findstr :3080` → `taskkill /PID <PID> /F` (logs under `$DSH_HOME` as `dsh-pocket-frog-restart-*.log`)                                                                                 |
| Windows: `spawn cloudflared ENOENT` (issue #82)                                 | **Happens on every machine where only the npm build of cloudflared is installed**: npm creates `cloudflared.cmd` plus an extension-less script on Windows, and Node cannot execute `.cmd` without a shell. The plugin used to read that as "already on PATH" — so it both skipped its own binary and was guaranteed to fail (deleting the `bin` cache did not help; it was empty to begin with). Fixed in the latest version: only directly executable `.exe`/`.com` are accepted and the plugin-managed binary is used (downloaded on first run). To get going immediately: `winget install cloudflared` (a real `.exe`), or put `"cloudflaredPath": "C:\\path\\to\\cloudflared.exe"` into `settings.json` and restart `dsh web` |
| Downloading cloudflared says "all sources failed"                               | Usually they are not all down (issue #82: the four sources shared a single 120s timeout budget, so one stalled source killed the rest). Fixed in the latest version: each source is timed separately, so a slow official source still lets the mirrors through; if everything really is unreachable, use the manual options under "Download fails / stalls on first enable" below                                                                                  |

## Public tunnel troubleshooting (read first)

**Symptom**: after clicking "Enable anywhere", the public URL shows `error 1033` (Tunnel error) on the phone.

**Most common cause: a local proxy/VPN (Clash, Surge, v2ray, sing-box, etc., especially in TUN mode).**
Such tools take over all traffic and often cut cloudflared's tunnel-edge connections
(`*.argotunnel.com`, Cloudflare edge IPs), so the tunnel registers but the data plane never connects.

**Fix (try in order, lightest first)**:

1. First **just turn off the proxy's TUN mode** — no need to quit the proxy; this is enough in most cases:
   - Clash: turn off the "**TUN mode**" toggle in Settings (or right-click the menu-bar icon → uncheck TUN mode)
   - Surge: turn off "**Enhanced mode**"; v2ray/sing-box: turn off "**virtual NIC / route takeover**"
   - Then go back to the settings page and click "Enable anywhere" again
2. If that's not enough, temporarily **fully quit the proxy** (not just close the window: quit Clash from the menu-bar icon; if a
   background service is installed, stop it in the service manager and confirm with `ps aux | grep clash`), then retry.
3. Add **DIRECT rules** to the proxy for the tunnel domains and Cloudflare edge (Clash example):
   ```yaml
   - DOMAIN-SUFFIX,argotunnel.com,DIRECT
   - DOMAIN-SUFFIX,trycloudflare.com,DIRECT
   - IP-CIDR,198.41.192.0/24,DIRECT,no-resolve
   ```
4. If the network really can't reach the tunnel, use **LAN mode**: turn on the phone hotspot → connect the computer to it → scan the LAN QR. Same experience, from anywhere.

**Other causes**: corporate firewalls / campus networks blocking outbound — ask IT to allow it, or use a hotspot.

**First run: "Downloading cloudflared" fails or hangs**:

- **macOS/Linux**: the plugin first downloads from the **Tsinghua mirror** (measured ~3MB/s, done in seconds); falls back to official GitHub + acceleration mirrors if it fails.
- **Windows**: no Tsinghua mirror (Homebrew doesn't support Windows) — downloads the ~50MB exe from GitHub directly; **single-threaded, so it's slower — that's expected**, wait a few minutes, or use a proxy.
- If all sources fail, the settings page shows a hint. Alternatives (any one):

1. Install the `cloudflared` command and retry (the plugin then uses the PATH binary, no download):
   - macOS: `brew install cloudflared`; Linux: `sudo apt install cloudflared` or from the official site
   - Windows: `winget install cloudflared` or from the official site
   - **Do not use `npm i -g cloudflared` on Windows**: npm only creates a `cloudflared.cmd` wrapper, which Node cannot execute directly (this is exactly what caused `spawn cloudflared ENOENT`, issue #82). It will be skipped and the plugin-managed download is used instead
2. Enable a proxy (system proxy / Clash etc.) and click "Enable anywhere" again
3. Manually download the binary into `$DSH_HOME/dsh-pocket-frog/bin/` (`$DSH_HOME` is usually `~/.dsh`, on Windows `%USERPROFILE%\.dsh`; name it `cloudflared` (add `.exe` on Windows) **or** the release asset name — both are recognized)

## Architecture (single package)

| File                 | Purpose                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/index.js`       | Plugin entry: auto-start proxy + register RPC + access-PIN management (public: 8 digits rotated per tunnel start; LAN: separate 8 digits, manually refreshable / switchable) + LAN access switch + DSH Desktop detection     |
| `lib/settings.mjs`   | Settings persistence: LAN access switch (on by default) + LAN-PIN switch (on by default) stored in `$DSH_HOME/dsh-pocket-frog/settings.json`                                                                                      |
| `lib/service.mjs`    | Service: proxy lifecycle (port auto-fallback), public tunnel (auto-restore), status snapshot (with QR data URLs)                                                                                                             |
| `lib/proxy.mjs`      | Header-rewriting reverse proxy: Host/Origin → loopback, HTTP + WebSocket passthrough + polyfill injection + gzip/brotli compression + per-host token auth (public always; LAN per switch) + blocks LAN Hosts when LAN is off |
| `lib/tunnel.mjs`     | cloudflared: multi-mirror download (Tsinghua first) / adaptive parallel / start / parse public URL (HTTP/2)                                                                                                                  |
| `lib/web-rpc.js`     | Loopback RPC: `status` / `tunnel.start` / `tunnel.stop` / `lan.setEnabled` / `version` / `update` / `restart`                                                                                                                |
| `client/`            | "Phone access" settings tab + mobile adaptation (dsh-web-mobile port)                                                                                                                                                        |
| `bin/dsh-pocket-frog.mjs` | CLI: LAN/public modes, prints URL + QR                                                                                                                                                                                       |

## Development

```sh
git clone https://github.com/zengqingsong/dsh-pocket-frog && cd dsh-pocket-frog
npm install
node client/build.mjs   # rebuild after editing client/
npm test                # proxy / auth / compression / tunnel / service / RPC / settings (180 tests)
```

**Want to try your changes locally without publishing?** Point the installed plugin at your local checkout with a symlink and restart dsh web. Full steps (including switching back to the GitHub source release) are in [LOCAL-DEV.md](./LOCAL-DEV.md).

## Credits

Written and maintained by [曾青松 (Zeng Qingsong)](https://github.com/zengqingsong).

It began as a fork of [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket) (GPL-2.0), whose upstream license notice is preserved unchanged in [LICENSE](./LICENSE). Since then this fork has renamed everything (`dsh-pocket` → `dsh-pocket-frog`: package name, CLI command, RPC channel, cookie, environment variables and state directory), added its own tests and docs, and fixed a batch of public-tunnel download traps — each download source timed separately, and only a directly executable `cloudflared` accepted (see "Troubleshooting").

Bundled third-party work, used under its own license:

- Mobile adaptation ported from [mexiaosqwq/dsh-web-mobile](https://github.com/mexiaosqwq/dsh-web-mobile) (MIT, GPL-compatible), its copyright notice kept in `client/mobile/LICENSE.dsh-web-mobile`
- Public tunnel powered by [cloudflared](https://github.com/cloudflare/cloudflared)

## License

[GPL-2.0](./LICENSE), with upstream dsh-pocket's license text kept unchanged.

Copyright (c) 2026 shaobeichen — dsh-pocket
Copyright (c) 2026 曾青松 (Zeng Qingsong) — dsh-pocket-frog, a fork of dsh-pocket

<p align="left">
  <img src="docs/logo/gzpu.jpg" alt="Guangzhou Polytechnic University" width="128" height="128" />
</p>

Developed and maintained at **Guangzhou Polytechnic University** ([gzpyp.edu.cn](https://www.gzpyp.edu.cn/)) by [曾青松 (Zeng Qingsong)](https://github.com/zengqingsong).
