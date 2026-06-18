# wsl2-hook-and-history-support

## Goal

让用户在 Windows 上、终端 shell 选 WSL（claude/codex 实际跑在 WSL 内）时，CLI-Manager 的「历史/实时统计」能读到 WSL 里的会话、且「按项目」过滤能命中，「hook 实时回调」（SessionStart 绑定 sessionId、通知）能正常工作。补齐前一任务 `06-18-cross-platform-hook-binary` 标为 best-effort、明确 Out-of-Scope 的 WSL2 跨界部分。

## 现场已确认的事实（带证据）

* **读取链路 OK**：从 Windows 用 UNC 读 `\\wsl.localhost\Ubuntu-22.04\home\dministrator\.claude\projects` 正常，列出 `-home-dministrator`、`-mnt-d-work-pythonProject-CLI-Manager`，后者含 `8448253e-...jsonl`。即后端 `fs::read_dir` 能读 WSL 会话。
* **历史目录可配置但仅靠它不够**：`getHistoryPathArgs()`（`src/stores/historyStore.ts:490`）读 `settings.claudeHookConfigDir`/`codexHookConfigDir` 传给后端；未设时 `detect_home_dir()` 回退 Windows 家目录。设成 WSL `.claude` 后全局历史可读。
* **目录只能选、不能填**：`HookSettingsPage.tsx` 只有 `handleSelectDir`（原生 `blocking_pick_folder`），无文本输入；Windows 原生选目录弹窗进 `\\wsl.localhost\...` 体验差。
* **②按项目过滤错位（核心痛点）**：CLI-Manager 项目路径是 Windows 形式 `D:\work\pythonProject\CLI-Manager`；claude 在 WSL 按 Linux cwd `/mnt/d/work/pythonProject/CLI-Manager` 编码目录名 `-mnt-d-work-pythonProject-CLI-Manager`。后端 `claude_project_key_from_path`（`history.rs`）按 Windows 路径算出 `d-work-...`，与 `-mnt-d-work-...` 永远不等；cwd 兜底比对也错位。匹配为大小写不敏感，所以唯一差异就是 `D:\` vs `/mnt/d/` 这层。
* **手填 Linux 路径不可行**：把项目路径改成 `/mnt/d/work/...` 被 `check_paths_exist` 以"路径不存在或不可访问"拒收（Windows 侧不存在该路径）。→ 必须保留 Windows 项目路径，按 shell 在内部转换。
* **③hook 回调失败（实锤）**：WSL claude 启动报 `/bin/sh: 1: D:\work\...\cli-manager.exe: not found`——注册命令是 Windows 路径，Linux shell 不认。且 `CLI_MANAGER_*` 未跨进 WSL shell。
* **spawn 点**：`src-tauri/src/pty/manager.rs:266 cmd.cwd(dir)`、`:271 cmd.env(k,v)`；WSL=`wsl.exe`（`:64`）。`wsl.exe` 会自动把 Windows cwd 映射到 `/mnt/...`，但 `cmd.env` 设的是 Windows 进程环境，不加 `WSLENV` 不会进 Linux shell。
* **遗留文案**：`HookSettingsPage.tsx:517` 起的「安装内容」卡片仍硬编码 `notify-cli-manager-*.ps1`，而新方案已不写脚本，需更新。

## Requirements

### ② 项目路径 Windows↔WSL 映射（按项目命中）
* 保持项目路径为 Windows 形式（不破坏 `check_paths_exist` 与 Windows shell）。
* 历史「按项目」匹配时，后端 `session_matches_project_path` 对目标 Windows 路径**额外尝试 WSL 形式**：`D:\a\b` → `/mnt/d/a/b` → key `-mnt-d-a-b`，任一命中即算同项目。无需前端区分 shell，shell 无关、稳。

### ③ hook 命令跨界 + env 转发（实时回调）
* 当目标 Claude/Codex 配置目录是 WSL/UNC 路径（`\\wsl.localhost\...` 或 `\\wsl$\...`）时，安装写入的 hook 命令把 exe 路径转成 WSL 可执行形式：`C:\dir\app.exe` → `/mnt/c/dir/app.exe`（盘符小写、`\`→`/`），其余 `__hook --source --event` 不变。命令仍恒 `exit 0`。
* 生成 WSL 终端（shell=wsl/bash-on-windows）注入 `CLI_MANAGER_*` 的同时，设置 `WSLENV=CLI_MANAGER_TAB_ID/u:CLI_MANAGER_NOTIFY_PORT/u:CLI_MANAGER_NOTIFY_TOKEN/u`（与既有 WSLENV 合并，不覆盖用户的），使变量进 Linux shell、并在 interop 调 Windows exe 时回传。
* networking：exe 经 interop 跑在 Windows 侧，直连 `127.0.0.1:port` 即达通知服务，无需额外处理。

### ① 配置易用性
* 「Claude/Codex 配置目录」支持**手动粘贴路径**（文本输入），不只依赖原生选目录弹窗，方便填 `\\wsl.localhost\...`。

### 收尾
* 更新 `HookSettingsPage.tsx` 「安装内容」文案：不再展示 `.ps1` 脚本名，改为描述注册的 `__hook` 命令。

## Acceptance Criteria

* [ ] 项目路径仍为 `D:\work\pythonProject\CLI-Manager`（过 `check_paths_exist`），但 per-tab「实时统计 / 该项目会话记录」能显示该项目在 WSL 的 claude 会话。
* [ ] WSL claude 启动不再报 `not found`；SessionStart/Stop 等事件能回调到通知服务（Tab 通知/实时统计随之更新）。
* [ ] WSL 终端内 `echo $CLI_MANAGER_NOTIFY_PORT` 等三个变量非空。
* [ ] 安装到 WSL `.claude` 的 `settings.json` 命令为 `/mnt/<盘>/.../cli-manager.exe __hook ...`，无 `D:\`/`C:\`。
* [ ] 既有原生 Win/Mac/Linux 行为不回归（非 WSL 目录仍写本地 exe 路径）。
* [ ] 配置目录可手动粘贴路径并生效。
* [ ] 「安装内容」文案不再出现 `.ps1`。
* [ ] `npx tsc --noEmit`、`cd src-tauri && cargo check`、`cargo test` 通过；新增路径转换/匹配的纯逻辑下沉后端并加 `cargo test`。
* [ ] 人工验证说明（WSL）随最终回复给出。

## Definition of Done

* 最小改动、无新依赖。
* 路径转换（`D:\`↔`/mnt/d/`、`C:\`↔`/mnt/c/`）与 key 匹配为纯函数并有单测（前端无测试框架，逻辑放后端 Rust）。
* 不破坏 Windows/macOS/Linux 既有路径与 shell 行为。
* WSLENV 合并不覆盖用户已有值。

## Technical Approach

1. **路径转换纯函数（Rust）**：`windows_path_to_wsl(path) -> Option<String>`（仅当形如 `<盘>:\...` 时转），盘符小写、`\`→`/`，前缀 `/mnt/`。反向 `wsl_unc_to_*` 仅用于判断目录是否 WSL。
2. **②匹配增强**：`session_matches_project_path` 对 claude 分支同时比对 Windows key 与 WSL key（用上面的转换生成候选），任一命中即真；cwd 兜底比对同理加候选。shell 无关。
3. **③安装命令**：`hook_settings.rs::build_command` 增加"目标目录是否 WSL"判定；是则 exe 走 `windows_path_to_wsl(current_exe)`。`is_cli_manager_command` 仍认 `__hook` 标志（已兼容）。
4. **③env**：`pty/manager.rs` spawn 时若 shell 属 WSL，合并设置 `WSLENV`（仅追加我们三个变量，保留原值）。
5. **①UI**：`HookSettingsPage` 给配置目录加受控 `TextInput`（失焦/确认即 `updateSetting`+`refreshStatus`），与选目录按钮并存。
6. **文案**：更新「安装内容」卡片。

## Decision (ADR-lite)

**Context**：项目路径手填 Linux 形式被校验拒收；claude 在 WSL 用 Linux 路径编码、用 Windows exe 路径无法在 Linux shell 执行。

**Decision**：项目路径保持 Windows 形式，按需在「历史匹配（试双 key）」与「WSL 终端 cwd/exe（转 /mnt）」内部转换；hook 命令按目标目录是否 WSL 决定 exe 形式；WSL 终端注入 WSLENV 转发回调变量。

**Consequences**：用户无需改项目路径或学 Linux 路径；逻辑集中在少数转换/匹配点。WSL2 依赖 mirrored/loopback 可达本机服务（Win11 现状满足）；distro 名/用户名仍需用户在配置目录里给出，不自动探测。

## Out of Scope

* 在 WSL 内分发/运行原生 Linux 二进制（始终走 interop 调 Windows exe）。
* 自动探测 WSL 发行版名、用户名、`.claude` 位置。
* mirrored networking / loopback 的自动配置（必要时文档说明）。
* shell runtime OSC 注入（归 `06-18-fix-hooks-env-for-git-bash-wsl`）。

## Technical Notes

* 关键文件：`src-tauri/src/commands/hook_settings.rs`（build_command/WSL 判定）、`src-tauri/src/pty/manager.rs`（WSLENV、cwd）、`src-tauri/src/commands/history.rs`（`session_matches_project_path`/`claude_project_key_from_path`/`normalize_history_path`）、`src/components/settings/pages/HookSettingsPage.tsx`（手填路径 + 文案）、`src/stores/historyStore.ts`（`getHistoryPathArgs`）。
* 依赖前置任务 `06-18-cross-platform-hook-binary`（`__hook` 子命令）已落地。
* `06-18-fix-hooks-env-for-git-bash-wsl` 负责"普通 tab 是否拿到回调 env"，与本任务的 WSLENV 转发有交集，实现时需对齐避免重复。
