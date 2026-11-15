# CLAUDE.md

Shared implementation and review rules live in [AGENTS.md](AGENTS.md). Follow them; do not duplicate them here.

Claude Code additionally owns planning issues (label `agent:claude-code`): produce compact docs under `docs/` with one authoritative home per requirement, keep [docs/DECISIONS.md](docs/DECISIONS.md) current, and never promote a Proposed item to Confirmed without creator approval.

Codex PR reviews: address at most **two rounds** of Codex review findings per PR (creator rule, 2026-11-15). After the second round, reply to any further findings and resolve them, but do not push more changes for them; surface anything serious to the creator instead.

Backlog source: [planning/issues.yaml](planning/issues.yaml); GitHub number mapping: [planning/github-map.json](planning/github-map.json).
