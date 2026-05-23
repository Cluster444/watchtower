# gpt review for prd-react-kanban-ui.md

- Model: `gpt-5.5-extra-high`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

# PRD Review

## Verdict
Needs minor clarification.

## Top Concerns
- The PRD is actionable overall, but a few cursor lifecycle rules are ambiguous or slightly contradictory.
- Column label display could be implemented incorrectly because canonical lane names and configured GitHub label strings are both referenced.
- The PRD defers scrolling/virtualization but does not define what happens when cards exceed terminal height.
- Command keybindings and move-menu contents are underspecified outside `h/j/k/l`.

## Specific Findings

### Severity: High
**Section / quote:** “Triage columns render left to right in this order: Inbox, needs-triage, needs-info...” and referenced `docs/initial-phase.md` says configured tracker label strings are used for display and mutations.

**Why it matters:** An implementation agent may hard-code canonical role names as visible column titles, even when the repo maps canonical roles to different GitHub label strings.

**Suggested fix:** State that canonical role names define identity/order, while visible labels should use configured tracker label strings where applicable.

### Severity: High
**Section / quote:** “Per-column scroll viewports or virtualization... deferred” plus cursor movement across slots.

**Why it matters:** With up to 100 issues per lane, the board can exceed terminal height. Without a rule for clipping, whole-board overflow, or cursor visibility, an agent may overbuild scrolling or produce inaccessible cards.

**Suggested fix:** Define phase-one overflow behavior explicitly, e.g. “Columns may clip to available height; independent scrolling and keeping offscreen selected slots visible are out of scope.”

### Severity: Medium
**Section / quote:** “Switching screens resets the destination screen cursor to its initial position” but no initial cursor is defined.

**Why it matters:** Agents may choose different defaults: first column only, first non-empty column, first card, or preserved previous state.

**Suggested fix:** Define initial cursor as `columnIndex: 0` and slot `0` if that column has visible slots, otherwise `undefined`.

### Severity: Medium
**Section / quote:** “When visible slots change because of search, refresh, or mutation, normalize the cursor by clamping... the focused column's slot index...” and “Each column remembers its own slot index.”

**Why it matters:** Only normalizing the focused column leaves stale remembered indexes in other columns after search/refresh. Returning to those columns could select an invalid slot.

**Suggested fix:** Require normalization for every remembered `slotIndexByColumn` entry whenever visible slots change.

### Severity: Medium
**Section / quote:** “Persisting cursor position across screen switches or board refreshes” is out of scope, but refresh normalization implies cursor continuity after refresh.

**Why it matters:** “Do not persist across refresh” and “normalize after refresh” can be read differently. One agent may reset on refresh; another may preserve visual position.

**Suggested fix:** Split the rule: screen switches reset cursor; refresh/search/mutation preserve current visual cursor where possible and clamp to visible columns/slots.

### Severity: Medium
**Section / quote:** Command Availability table lists command categories, but exact keys are mostly absent.

**Why it matters:** The implementation may invent or alter keys for move, mark ready, unmark ready, open, search, refresh, quit, confirm, and cancel.

**Suggested fix:** Add a compact keybinding table or say “preserve existing raw key mappings; CommandBar labels must reflect those mappings.”

### Severity: Low
**Section / quote:** User Stories contains 55 stories, many restating implementation details.

**Why it matters:** The PRD is thorough but not concise. An implementation agent may treat every phrasing difference as a separate requirement.

**Suggested fix:** Collapse repeated stories into acceptance criteria or group them by UI, cursor, actions, and architecture.

## Agent Tripwires
- Overbuilding React architecture: the PRD explicitly says no React Context and no new CLI orchestration architecture.
- Treating cursor movement as issue movement: `h/j/k/l` must never mutate GitHub.
- Keeping both old `selection` and new `cursor` state active: the PRD says replace the selection model, not bridge it.
- Hard-coding canonical label names into UI display instead of respecting configured tracker labels.
- Adding React snapshot/rendering tests despite the testing section saying to prefer pure reducers/helpers.
- Implementing independent column scrolling because the UI guide says “eventually”; the PRD defers it.
- Moving search/move/confirmation input handling into leaf components; routing should stay high in the shell layer.
- Showing disabled issue commands for empty columns; the PRD says hide them.

## Suggested PRD Edits
- “Canonical lane names define column identity and order. For canonical triage lanes, visible column titles and issue workflow labels should use the configured tracker label strings from `docs/agents/triage-labels.md`; mutations must continue using configured label spelling.”
- “Initial cursor for any board is `columnIndex: 0`; the focused slot is `0` when the first column has visible slots, otherwise `undefined`.”
- “On search, refresh, or mutation, normalize all remembered slot indexes in `slotIndexByColumn`, not only the focused column.”
- “Screen switches reset the destination board cursor. Refresh/search/mutation preserve the current visual cursor where possible and clamp it to the current visible board.”
- “Phase one does not implement independent column scrolling. If content exceeds available height, columns may clip or truncate according to existing OpenTUI layout behavior; keeping offscreen slots visible is out of scope.”
- “Preserve existing keybindings for move, mark ready, unmark ready, open, search, refresh, quit, confirm, and cancel. CommandBar hints must reflect the actual existing keybindings.”
- “The triage move menu destinations are Inbox plus canonical triage lanes in board order. Moving to `wontfix` is presented as `Close as wontfix` and requires confirmation.”
