# Watchtower UI Design

Watchtower's terminal UI is a keyboard-first control surface for operating Sandcastle workflows. The UI should make workflow shape, current position, available actions, and feedback visible without mixing domain behavior into generic layout components.

## Shell Layout

The primary layout stack is:

1. `Header`
2. `Board`
3. `CommandBar`
4. `StatusBar`

`Header` shows app identity and top-level navigation, including the active screen.

`Board` is the main kanban surface for the active screen.

`CommandBar` shows contextual commands for the current mode and cursor. During search, move menus, or confirmations, it switches to that interaction state.

`StatusBar` shows current state and feedback such as active screen, selected column or issue, loading status, mutation results, and errors.

## Component Boundaries

Generic shell layout components live under `src/components/layout/`.

Generic kanban components live under `src/components/kanban/`.

Issue-specific presentation components and adapters live under `src/components/issues/`.

Generic UI components should not know about GitHub, Sandcastle, triage labels, or issue mutation behavior. Issue-specific adapters map application data into generic visual structures.

## Kanban Board

The kanban UI is built from generic primitives:

- `Board`: lays out columns, owns equal column distribution, renders the board cursor, and receives cursor state as controlled input.
- `Column`: owns title, count, border/background, vertical spacing, empty state, and column fill behavior.
- `Slot`: owns selectable item chrome and visual focus state.

Issue content is rendered inside a generic `Slot`, usually by an `IssueCard` component.

Each screen renders one board. The triage screen renders its triage columns. The run screen renders its run columns. Multiple boards should not be shown on the same screen.

Columns remain visible even when empty. Empty columns occupy the same board space as populated columns and show an explicit empty state.

`Board` distributes columns evenly across the available width. The board height is controlled by its parent, and columns fill the board height.

Columns should eventually scroll independently so long columns do not move the whole board. Selection movement should keep the focused slot visible within its column.

## Board Cursor

The kanban cursor is visual and index-based. Stable keys identify data; indexes identify cursor position.

The canonical cursor shape is:

```ts
type BoardCursor = {
  columnIndex: number;
  slotIndexByColumn: Record<number, number | undefined>;
};
```

`columnIndex` is the focused column.

`slotIndexByColumn[columnIndex]` is the focused slot in that column, or `undefined` when the column has no selectable slots.

Horizontal movement changes only `columnIndex`. Each column remembers its own slot index.

Vertical movement changes only the focused column's slot index.

The focused column is highlighted even when it is empty. The focused slot is highlighted only when the focused column has a slot.

Vim-style movement is the default board interaction model:

- `h`: move column cursor left
- `l`: move column cursor right
- `j`: move slot cursor down
- `k`: move slot cursor up

Cursor movement is visual only. It must not mutate issues.

## Command And Status Bars

`CommandBar` shows commands available in the current mode and cursor context.

Examples:

- Triage issue selected: `j/k slot | h/l column | m move | p mark ready | o open | / search | Ctrl+R refresh | q exit`
- Run open issue selected: `j/k slot | h/l column | u unmark ready | o open | / search | Ctrl+R refresh | q exit`
- Closed run issue selected: `j/k slot | h/l column | o open | / search | Ctrl+R refresh | q exit`
- Empty column focused: `h/l column | / search | Ctrl+R refresh | q exit`
- Search focused: `Search: <query> | type to filter | Backspace clear | Esc cancel`
- Confirmation prompt: `<action> requires confirmation. Enter confirm | Esc cancel`

Move menus and confirmation prompts render in `CommandBar`, not inside board content.

`StatusBar` shows state and feedback, not available commands.

Search state is shown in the bottom bars rather than in the header or board content.

## Theme

Use a restrained terminal control-surface aesthetic:

- Dark terminal background.
- Slightly lighter selected column background.
- Selected slot background lighter than the selected column.
- Subtle borders for panels, columns, and slots.
- Cyan or teal for active navigation and accents.
- Yellow or amber for status and confirmations.
- Muted gray for secondary metadata.
- Strong contrast for the selected column and selected slot without visual noise.

Use a shared theme module for colors and common visual tokens. Do not scatter color literals through components.

## Action Boundary

Components render state and manifest actions. Application code interprets actions, updates state, and performs effects.

React components should dispatch existing semantic actions where possible. They should not perform GitHub loading, issue mutation, or process orchestration.

Generic kanban helpers may calculate visual cursor changes, but they should not perform domain mutations.

## Non-Goals

The current UI design does not include:

- An agent/chat command interface.
- A selected issue detail panel.
- Redesigning GitHub mutation behavior.
- Redesigning issue classification or triage rules.
- A narrow-terminal fallback.
- Per-column search.
- Mouse interaction requirements.

## Open Questions

- Which OpenTUI scroll container should power independent column scrolling?
- Should the command bar later evolve into an agent prompt?
- Should selected issues eventually have a detail panel?
- How should the board behave on narrow terminals?
- Should cursor position preserve stable slot identity across refreshes and reordering, or remain purely visual?
