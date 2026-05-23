# gpt review for prd-react-kanban-ui.md

- Model: `gpt-5.5-extra-high`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

# PRD Review

## Verdict
Needs minor clarification.

## Top Concerns
1. The PRD is detailed but lacks a dedicated acceptance criteria section, so an implementation agent may not know when the migration is complete.
2. Cursor behavior after filtering, refreshes, mutations, and data reordering is under-specified.
3. Column order, command availability, and card truncation rules rely on referenced docs or prior behavior instead of being explicit in this PRD.
4. Several requirements say “preserve current behavior” without naming the exact behavior, which is risky for an autonomous agent.

## Specific Findings

**Severity: High**
**Section / quote:** `Testing Decisions`; no `Acceptance Criteria` section.
**Why it matters:** Tests are suggested, but there is no concise pass/fail checklist for the UI migration. An implementation agent could satisfy architecture goals while missing user-visible behavior.
**Suggested fix:** Add an `Acceptance Criteria` section covering board rendering, cursor movement, command visibility, search, mutation preservation, empty states, and verification commands.

**Severity: High**
**Section / quote:** “The cursor tracks the focused column by index and remembers a focused slot index per column.”
**Why it matters:** Index-based cursors are fragile when search filters cards, GitHub refresh reorders cards, mutations remove cards, or columns become empty. The PRD says to use stable keys for identity but does not say whether selection should preserve the same issue, same index, or clamp/reset.
**Suggested fix:** Define cursor normalization rules after search changes, refreshes, mutation success, and card removal.

**Severity: Medium**
**Section / quote:** “The triage screen will render columns for Inbox, canonical triage states, and Conflicted issues.”
**Why it matters:** The exact canonical column order is not stated here. An agent could order labels alphabetically, use config-file order, or omit `wontfix` because “Close as wontfix” closes issues.
**Suggested fix:** Explicitly list triage columns in order: `Inbox`, `needs-triage`, `needs-info`, `ready-for-human`, `ready-for-agent`, `wontfix`, `Conflicted`.

**Severity: Medium**
**Section / quote:** “closed run-screen issues to avoid unsupported commands” and “command hints to change based on the current selection.”
**Why it matters:** Command availability is central to the UI, but the PRD does not provide a definitive matrix. An agent may expose `unmark ready` for closed issues, hide `open`, or show triage moves on the run screen.
**Suggested fix:** Add a command availability table for triage selected, run open selected, run closed selected, empty column, search mode, move menu, and confirmation mode.

**Severity: Medium**
**Section / quote:** “Keep current card content fields: issue number, workflow labels, title, body preview, and updated age.”
**Why it matters:** “Compact multi-line” is vague. Without line limits and truncation rules, an agent may render oversized cards that break the board layout.
**Suggested fix:** Specify max title/body preview lines, truncation indicator, and whether labels wrap or truncate.

**Severity: Medium**
**Section / quote:** “Existing semantic actions… remain in place unless a small change is required to connect them to the new UI.”
**Why it matters:** “Small change” is subjective. The PRD also says “Do not introduce a new action vocabulary,” but cursor movement may replace the current lane/card selection model.
**Suggested fix:** State that existing semantic action names should be reused where possible, and any renamed selection actions must remain reducer-only and non-mutating.

**Severity: Low**
**Section / quote:** “The shell layout will follow the durable UI design guide.”
**Why it matters:** The PRD depends on another document but only names it indirectly until Further Notes. An agent working from this PRD alone may miss concrete layout/component-boundary guidance.
**Suggested fix:** Link or name `docs/ui-design.md` in the Solution or Implementation Decisions section.

**Severity: Low**
**Section / quote:** “Fully solving independent column scrolling… out of scope. The component contract should still point toward per-column scrolling.”
**Why it matters:** This leaves unclear what happens with more cards than vertical space in this iteration.
**Suggested fix:** Define minimum behavior: cards may be clipped or use existing scrolling, but cursor movement must remain visible within available rendering constraints where practical.

## Agent Tripwires
- Overbuilding Sandcastle run-session controls because the run screen is described as a board.
- Treating `h/j/k/l` movement as issue moves instead of visual cursor movement.
- Moving GitHub mutation logic into React components during the renderer migration.
- Making generic `Board`, `Column`, or `Slot` know about GitHub issues, labels, or Sandcastle.
- Hiding empty columns during search because they have no visible cards.
- Persisting cursor state locally even though UI persistence is out of scope.
- Replacing existing semantic actions with a new action system.
- Adding snapshot-heavy terminal rendering tests instead of pure cursor/adapter/reducer tests.

## Suggested PRD Edits

Add under `Solution`:

> This PRD should be implemented alongside `docs/ui-design.md`, which defines the shell layout, component boundaries, command examples, and theme direction.

Add under `Implementation Decisions`:

> Triage columns must render in this order: `Inbox`, `needs-triage`, `needs-info`, `ready-for-human`, `ready-for-agent`, `wontfix`, `Conflicted`. Run columns must render in this order: `Ready to run`, `Closed`.

Add cursor normalization bullets:

> When visible cards change because of search, refresh, or mutation, normalize the board cursor by clamping `columnIndex` to an existing column and clamping the focused slot index to the visible slots in that column. If the focused column has no visible slots, its slot index is `undefined`. Cursor movement should not attempt to preserve issue identity in this iteration unless that falls out naturally from existing state.

Add command availability bullets:

> Command hints must reflect the current context:
> - Triage issue selected: navigation, move, mark ready, open, search, refresh, exit.
> - Run open issue selected: navigation, unmark ready, open, search, refresh, exit.
> - Run closed issue selected: navigation, open, search, refresh, exit.
> - Empty column focused: column navigation, search, refresh, exit only.
> - Search, move menu, and confirmation modes replace normal command hints in `CommandBar`.

Add acceptance criteria:

> ## Acceptance Criteria
> - Triage and run screens each render exactly one kanban board.
> - All configured columns remain visible when empty and during search.
> - `h/l` move the focused column and `j/k` move the focused slot without mutating GitHub issues.
> - Empty focused columns have no selected issue and hide issue-specific commands.
> - Issue cards show issue number, workflow labels, title, body preview, and updated age as compact multi-line content.
> - Existing triage moves, promotion, demotion, `Close as wontfix`, search, refresh, open-in-GitHub fallback, and preflight behavior are preserved.
> - Generic kanban components contain no GitHub, Sandcastle, triage label, or mutation-planning knowledge.
> - `bun test` and TypeScript typechecking pass after implementation.
