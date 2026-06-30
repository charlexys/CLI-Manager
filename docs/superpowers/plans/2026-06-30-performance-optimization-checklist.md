# CLI-Manager Performance Optimization Checklist

**Goal:** Reduce perceived UI lag when opening the app, switching into history, and entering other heavyweight views by cutting unnecessary startup work and avoiding eager detail hydration.

## P0

- [x] Startup: avoid duplicate project bootstrap between `App` and `Sidebar`.
- [x] Startup: load project list first, defer path health checks and provider badge probing until after first screen.
- [x] History: opening history should load the session list only; do not auto-open the first session detail.
- [x] Verification: run targeted behavior tests for the new fetch policy helpers, then run `npx tsc --noEmit`.

## P1

- [x] Terminal: reduce inactive tab overhead by consolidating background session bookkeeping away from per-instance `XTermTerminal` listeners.
- [x] Terminal: narrow `TerminalTabs` subscriptions/selectors so toolbar, pane content, and side panels rerender independently.
- [ ] History: cache parsed transcript sections / expensive markdown transforms for repeated session detail views.
- [ ] Stats: defer secondary charts until visible and split heavy chart computation from modal shell render.

## P2

- [x] Settings/startup: batch store reads and reduce serial preference loading in `settingsStore.load`.
- [ ] History backend: strengthen indexed/session-summary caching to reduce repeated filesystem scans.
- [ ] Sidebar/project tree: consider incremental health/provider refresh prioritizing visible or recently used projects.
- [ ] Add a lightweight frontend test harness for future performance-sensitive pure logic and regression coverage.

## Backlog

- [ ] Terminal open transition: clicking a project start button still causes a visible terminal-area flash before the session fully mounts; evaluate placeholder-first rendering and avoiding empty-state/terminal hard switches.
