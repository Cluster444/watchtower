# Use Bun and OpenTUI for the terminal UI

Watchtower will be a Bun-based TypeScript CLI using OpenTUI for its terminal UI. We chose OpenTUI over Ink, Bubble Tea, Ratatui, and raw terminal rendering because Watchtower needs a rich card-based terminal interface, future Sandcastle integration benefits from staying in TypeScript, and OpenTUI is the terminal UI stack used by OpenCode; the tradeoff is accepting OpenTUI's current Bun-first runtime constraint while Node support is still in progress.
