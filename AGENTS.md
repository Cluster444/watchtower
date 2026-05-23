## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `Cluster444/watchtower`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.

## Project rules

Do not add compatibility shims, legacy re-exports, or parallel old/new APIs during refactors unless the user explicitly asks for compatibility. Prefer one clean active model and update imports/tests directly.
