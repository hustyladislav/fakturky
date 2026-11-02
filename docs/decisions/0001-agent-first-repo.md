# 0001 — Agent-first repository setup

- Date: 2026-11-02
- Status: accepted
- Decided by: founder

## Context
Most code in this repo is written and reviewed by AI agents (Claude Code, Codex) working in parallel; 109 PRs landed in one night.
Without shared rules they drift: inconsistent PRs, unverified "done", stale dependency versions, merges onto red `main`.

## Decision
`AGENTS.md` is a short index loaded every session; topic rules live in `docs/agents/*.md`; system-shaping
decisions live here. Shared skills are installed with the skills CLI into `.agents/skills` and `.claude/skills` and pinned in `skills-lock.json`.
Hooks enforce the PR template; branch protection requires CI + e2e and up-to-date branches; production deploys only from `main`.

## Rejected
- **One long AGENTS.md** (the previous file kept design, deploy and database rules inline): loads every session and buries the rules that matter.
- **Per-tool instruction files with duplicated content:** they drift; `CLAUDE.md` just imports `AGENTS.md`.

## Consequences
New rules need a home (index line + topic file). Revisit when the agent tools gain a shared standard for project memory.
