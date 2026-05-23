# composer review for prd-react-kanban-ui.md

- Model: `composer-2.5`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

# PRD Review

## Verdict

**Needs minor clarification**

The PRD is directionally strong, aligns well with `docs/ui-design.md` and existing domain behavior, and gives a usable component/state split. It is not fully self-contained: several behaviors exist only in `docs/initial-phase.md`, `docs/ui-design.md`, or current code, and a few cursor/modal rules are underspecified enough that an implementation agent could ship the wrong UX or over-scope the migration.

---

## Top Concerns

1. **No acceptance criteria** — 55 user stories but no “done when” checklist; an agent cannot verify completion without inferring from other docs and tests.
2. **OpenTUI React migration is underspecified** — Repo today uses imperative `@opentui/core` (`Box`/`Text`); no React package, `react` dependency, or mount pattern is named.
3. **Board cursor behavior changes vs current code are implied, not flagged** — Empty-column focus and per-column slot memory conflict with `boardState.ts` (`findNextSelectableLaneIndex`, reset `cardIndex` on horizontal move); existing tests encode the old model.
4. **“Manifest actions” is ambiguous** — Could be read as components owning reducers/effects instead of dispatching existing `WatchtowerAction`s.
5. **Modal / overlay input routing is missing** — Move menu digits, search typing, confirmations, and whether `h/j/k/l` apply during search/menu are not defined in the PRD.
6. **PRD assumes required companion docs** — File paths, column order, command strings, and confirmation rules live mainly in `docs/ui-design.md` and `docs/initial-phase.md` without a explicit “must read” block.

---

## Specific Findings

### 1. Missing acceptance criteria section
**Severity:** High
**PRD section:** Entire document (no Acceptance Criteria)
**Why it matters:** An autonomous agent has no authoritative stop condition; it may stop at “compiles” or over-implement polish.
**Suggested fix:** Add an **Acceptance Criteria** section with 10–15 checkboxes, e.g. shell layout order, triage/run column sets, empty-column focus, cursor does not mutate GitHub, command bar modes, `bun test` + `tsc --noEmit` green, prototype line renderer removed.

### 2. OpenTUI React package and mount pattern unspecified
**Severity:** High
**PRD quote:** “Migrate the rendering path to OpenTUI React bindings” (Solution, Implementation Decisions)
**Why it matters:** `package.json` only has `@opentui/core`; `shell.ts` uses imperative `Box`/`Text`. Agent may invent a stack, add wrong packages, or stay on core API while claiming “React migration.”
**Suggested fix:** Name the package (e.g. `@opentui/react`), required deps (`react`, types), and where mounting happens (`index.ts` / `shell.ts`), with a pointer to OpenTUI React docs (`docs/bindings/react` per project skill).

### 3. Intentional behavior change vs current selection not called out
**Severity:** High
**PRD quotes:** Stories 21, 22, 25; “Allow empty columns to be focused”; `slotIndexByColumn`
**Why it matters:** Current `moveSelection` skips empty lanes and resets `cardIndex` to `0` on horizontal move; `boardState.test.ts` expects skipping to populated lanes. Agent may “fix” tests back to old behavior or leave inconsistent UX.
**Suggested fix:** Add **Breaking changes from prototype** bullets: (1) `h`/`l` may land on empty columns; (2) horizontal move restores `slotIndexByColumn[target]`, not slot `0`; (3) update/replace selection tests accordingly.

### 4. Cursor edge cases undefined
**Severity:** Medium
**PRD section:** Board cursor (Implementation Decisions, stories 18–22)
**Why it matters:** Ambiguity leads to inconsistent UX and flaky tests.
**Suggested fix:** Specify explicitly:
- `j`/`k` on empty focused column: no-op (slot stays `undefined`).
- `h`/`l` at first/last column: clamp, no wrap.
- After refresh/filter: clamp indices; optional note on whether slot identity is visual-only (defer stable-key tracking per `ui-design.md` open question).
- Screen switch: reset cursor vs preserve per-screen cursor (current code resets).

### 5. “Manifest actions” vs “interpret actions” tension
**Severity:** Medium
**PRD quotes:** Stories 45–46; “React components responsible for rendering state and manifesting semantic actions”
**Why it matters:** Agent may put reducers, GitHub calls, or new action types inside components, violating stories 46–47 and `ui-design.md` Action Boundary.
**Suggested fix:** Replace “manifest” with: “UI dispatches existing `WatchtowerAction` / `BoardStateAction` via callbacks; no mutations or `gh` in components.”

### 6. Required reading / doc dependencies implicit
**Severity:** Medium
**PRD quote:** “durable UI direction is captured in the UI design guide” (Further Notes)
**Why it matters:** Agent may implement from PRD alone and miss directory layout (`src/components/layout|kanban|issues`), command bar strings, theme tokens, and column scroll contract.
**Suggested fix:** Add **Required references**: `docs/ui-design.md` (normative for layout/visuals), `docs/initial-phase.md` (normative for mutations/confirmations), `CONTEXT.md` (glossary).

### 7. Triage column order not enumerated
**Severity:** Medium
**PRD quote:** “columns for Inbox, canonical triage states, and Conflicted issues”
**Why it matters:** `docs/initial-phase.md` lists `ready-for-human` before `ready-for-agent`; code uses `CANONICAL_TRIAGE_ROLES` order (`ready-for-agent` then `ready-for-human`). Wrong order is a user-visible regression.
**Suggested fix:** Paste authoritative column order (match `getTriageLanes` / `TRIAGE_LANE_KEYS` in code).

### 8. Screen navigation and global keys not in PRD
**Severity:** Medium
**PRD:** Stories 7–9 only mention Header display, not bindings
**Why it matters:** `ui-design.md` and `input/actions.ts` use `1`/`t` and `2`/`r`; agent might drop or relocate them incorrectly.
**Suggested fix:** One line: “Screen switch: `1`/`t` triage, `2`/`r` run (unchanged); shown in Header.”

### 9. Move menu and confirmation flows underspecified
**Severity:** Medium
**PRD:** Stories 13–14, 28–30; “when appropriate” for promotion
**Why it matters:** Behavior is fully specified in `initial-phase.md` and `triageActions.ts` but PRD only hand-waves. Agent might re-derive confirmation rules.
**Suggested fix:** “Preserve confirmation rules from `docs/initial-phase.md` § Mark Ready To Run / Triage Moves” plus move menu: `m` opens; digits `0`–`5` select destination; `Esc` cancels; `Enter` confirms pending destructive actions.

### 10. Search / modal interaction with board keys unclear
**Severity:** Medium
**PRD:** Stories 12, 34–36
**Why it matters:** Current shell routes printable input to search when `searchFocused`; does not document whether `h/j/k/l` still move the board. Agent may block or allow both.
**Suggested fix:** “While search focused: CommandBar shows query; printable keys append; `Esc`/`Backspace` clear/cancel; board navigation keys disabled (or explicitly enabled—pick one).”

### 11. Lane vs column state migration unspecified
**Severity:** Medium
**PRD:** `BoardCursor` with `columnIndex`; codebase uses `laneKey` + `cardIndex`
**Why it matters:** Agent may duplicate models, break `getSelectedIssue` helpers, or leak domain lane keys into generic kanban.
**Suggested fix:** “Replace `BoardSelection` with `BoardCursor` + column key mapping in the issue adapter; domain modules keep lane keys internally until adapted.”

### 12. Stable slot/column keys not defined
**Severity:** Low
**PRD quote:** “Use stable column and slot keys for identity and rendering”
**Why it matters:** React list reconciliation and tests need a contract (e.g. slot key = issue number string).
**Suggested fix:** “Slot key = stringified GitHub issue number; column key = existing `BoardLaneKey`.”

### 13. Card body preview truncation unspecified
**Severity:** Low
**PRD quote:** “body preview” (story 5, Implementation Decisions)
**Why it matters:** `issueBoard.ts` uses 140-char preview; agent might change truncation without intent.
**Suggested fix:** “Preserve `formatBodyPreview` / 140-char cap unless UI design guide overrides.”

### 14. 55 user stories — low signal-to-noise
**Severity:** Low
**PRD section:** User Stories 1–55
**Why it matters:** Duplication (e.g. 3+4+35+36 on empty/search) makes traceability hard; agent may treat list as checklist and miss gaps.
**Suggested fix:** Collapse to ~15 stories + link detailed behaviors to acceptance criteria and `ui-design.md`.

### 15. No mention of deleting prototype renderer
**Severity:** Low
**PRD:** Story 48, “disposable prototype UI”
**Why it matters:** `renderIssueBoardLines` may linger alongside React path.
**Suggested fix:** Acceptance criterion: “Remove line-based board rendering from shell; no dual render paths.”

### 16. Per-column scrolling deferred but contract vague
**Severity:** Low
**PRD Out of Scope:** “component contract should still point toward per-column scrolling”
**Why it matters:** Agent may over-build ScrollBox spike or omit extension points.
**Suggested fix:** “Column accepts `maxHeight`; scrolling stub OK; selection must not require scroll implementation this iteration.”

---

## Agent Tripwires

| Tripwire | Likely mistake |
|----------|----------------|
| **“OpenTUI React bindings”** | Stay on `@opentui/core` imperative API, or add React without proper renderer mount. |
| **“Manifest actions” in components** | Put `reduceBoardState`, GitHub refresh, or mutation planning inside React tree. |
| **“Reuse semantic actions”** | Invent parallel action types instead of extending `WatchtowerAction` / `BoardStateAction`. |
| **Empty columns** | Keep skipping empty lanes because old tests pass that way. |
| **Horizontal move** | Reset slot to `0` on column change instead of restoring `slotIndexByColumn`. |
| **Generic kanban purity** | Import `BoardLaneKey` or triage labels into `src/components/kanban/`. |
| **Issue adapter placement** | Push column mapping into `issueBoard.ts` / classification (violates story 43). |
| **CommandBar vs StatusBar** | Put errors or loading in CommandBar, or static key line below board (prototype pattern). |
| **55 user stories as full scope** | Gold-plate visuals, scrolling, narrow-terminal handling despite Out of Scope. |
| **“Limit shell changes”** | Under-refactor input handler (move menu, search, confirmations) that must stay in shell/app layer. |
| **Confirmation “when appropriate”** | Reimplement promotion/wontfix rules instead of preserving `triageActions` + shell pending state. |
| **Testing section** | Snapshot entire TUI or skip updating `boardState.test.ts` when cursor semantics change. |
| **Glossary “lane” vs UI “column”** | Rename domain types to `column` across `issues/` modules. |
| **Companion docs** | Implement column order from `initial-phase.md` instead of code order. |

---

## Suggested PRD Edits

Paste-friendly additions:

**After Solution — add Required references**
```markdown
## Required references (normative)

- `docs/ui-design.md` — shell layout, component paths, theme, command/status bar content, cursor visuals.
- `docs/initial-phase.md` — triage/run column semantics, mutations, confirmations, search scope, empty states.
- `CONTEXT.md` — domain glossary (**issue board** lane vs UI **column**).
```

**New section — Breaking changes from current prototype**
```markdown
## Breaking UI behavior (explicit)

- `h`/`l` MUST focus empty columns; do not skip them.
- Changing `columnIndex` MUST restore `slotIndexByColumn[columnIndex]` (or `undefined` if empty), not reset to slot 0.
- `j`/`k` on an empty focused column: no-op; no selected issue.
- Replace `BoardSelection { laneKey, cardIndex }` with `BoardCursor` + adapter mapping; update `boardState` tests.
```

**Implementation Decisions — add**
```markdown
- Add OpenTUI React per project docs (`@opentui/react` + `react`); mount from existing CLI entry; keep input → `mapInputToAction` in shell/app layer.
- Triage column order (left to right): Inbox, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, Conflicted — match `TRIAGE_LANE_KEYS` / `getTriageLanes`.
- Slot key: string issue number. Column key in adapter: existing `BoardLaneKey`.
- While `searchFocused` or move menu / confirmation active: board `h/j/k/l` disabled; see `docs/ui-design.md` CommandBar modes.
- Screen switch keys unchanged: `1`/`t` triage, `2`/`r` run.
- Preserve body preview truncation via existing `formatBodyPreview` (140 chars).
- Components call `onAction(WatchtowerAction)` only; no `gh`, no mutation execution in `src/components/**`.
```

**New section — Acceptance criteria**
```markdown
## Acceptance criteria

- [ ] Shell renders Header → Board → CommandBar → StatusBar (no static key line under board content).
- [ ] Triage board shows 7 columns; run board shows Ready to run + Closed; all columns visible when empty.
- [ ] `h/j/k/l` move visual cursor only; empty columns focusable; per-column slot memory on return.
- [ ] Selected issue derived only when focused column has a slot; issue commands hidden/disabled otherwise.
- [ ] Search filters cards globally; columns stay visible; distinct empty copy for filter vs GitHub-empty.
- [ ] CommandBar shows contextual hints per `docs/ui-design.md`; StatusBar shows status/errors/loading.
- [ ] Triage move, promotion, wontfix, demotion, open, refresh, preflight behavior unchanged vs `initial-phase.md`.
- [ ] `renderIssueBoardLines` / prototype row UI removed from active shell path.
- [ ] `bun test` and `bun run typecheck` pass.
```

**Clarify manifest actions (replace bullets 105–106)**
```markdown
- React components render props/state and invoke `onAction` with existing semantic actions; they do not run reducers, GitHub calls, or mutation side effects.
```

**User Stories — optional consolidation note**
```markdown
Detailed keyboard and command behavior is specified in Acceptance criteria and `docs/ui-design.md`; stories 1–55 are intent, not an exhaustive checklist.
```
