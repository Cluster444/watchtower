# Watchtower

Watchtower is the user-facing control surface for operating Sandcastle workflows. It exists to help a developer start, supervise, and steer agent-driven coding work.

## Language

**Watchtower**:
A control surface for operating **Sandcastle** workflows.
_Avoid_: "dashboard", "monitor" unless referring only to passive observation.

**Sandcastle**:
The underlying automation engine that orchestrates an **agent** inside a **sandbox**.
_Avoid_: "RALPH", "the bot", "the runner"

**Sandcastle workflow**:
A workflow performed by **Sandcastle** after an issue becomes eligible for agent work.
_Avoid_: "Ralph loop", "agent loop"

**Agent**:
The AI coding tool invoked by **Sandcastle** to work on a **task**.
_Avoid_: "bot", "worker", "RALPH"

**Sandbox**:
The isolation boundary around an **agent** during a **Sandcastle** workflow.
_Avoid_: "workspace", "container" unless referring to a specific provider implementation.

**Task**:
A backlog item selected for an **agent** to work on.
_Avoid_: "job", "ticket", "assignment"

**GitHub issue**:
A backlog item in GitHub that may become a **task** for **Sandcastle**.
_Avoid_: "ticket", "card"

**Target repo**:
The GitHub repository whose issues **Watchtower** manages.
_Avoid_: "selected repo", "workspace repo"

**Skills setup**:
The per-repo Matt Pocock skills configuration that defines the issue tracker and canonical triage labels.
_Avoid_: "Watchtower setup", "label bootstrap"

**Sandcastle config directory**:
The `.sandcastle/` directory in the **target repo** containing Sandcastle workflow configuration.
_Avoid_: ".sandcastle folder", "Watchtower config"

**Issue board**:
A triage-oriented view of **GitHub issues** grouped by their current **triage state**.
_Avoid_: "GitHub clone", "project board"

**Triage screen**:
The **Watchtower** screen for open **GitHub issues** that do not have the **Sandcastle label**.
_Avoid_: "backlog screen", "unready screen"

**Run screen**:
The **Watchtower** screen for **GitHub issues** that have the **Sandcastle label**.
_Avoid_: "Sandcastle queue" when the screen is not starting runs itself.

**Ready-to-run lane**:
The **run screen** lane for open **eligible issues**.
_Avoid_: "running", "active run"

**Closed run lane**:
The **run screen** lane for closed **eligible issues**.
_Avoid_: "done queue", "completed tasks" unless completion was confirmed by Sandcastle.

**Issue card**:
The board representation of a **GitHub issue**.
_Avoid_: "ticket card", "task card"

**Board move**:
Moving an **issue card** from one **issue board** lane to another.
_Avoid_: "drag/drop" when the input method is not relevant.

**Wontfix move**:
A **board move** into the `wontfix` triage lane that marks the **GitHub issue** as not actioned.
_Avoid_: "delete", "discard"

**Inbox**:
The derived **issue board** lane for open **GitHub issues** with no canonical triage label.
_Avoid_: "needs-triage" unless the label is actually present.

**Conflicted issue**:
A **GitHub issue** with more than one canonical triage label.
_Avoid_: "broken issue", "invalid ticket"

**Triage state**:
The current workflow role of a **GitHub issue**, expressed by one canonical triage label.
_Avoid_: "status", "column" unless referring only to presentation.

**Triage transition**:
The act of replacing a **GitHub issue**'s canonical triage label to change its **triage state**.
_Avoid_: "editing the issue", "moving status"

**Ready-for-agent label**:
The triage label indicating that a **GitHub issue** is fully specified and ready for an **agent**.
_Avoid_: "agent-ready tag", "AFK label"

**Sandcastle label**:
The `Sandcastle` GitHub label that marks a **GitHub issue** as ready to run in **Sandcastle** workflows.
_Avoid_: "Sandcastle tag", "agent tag"

**Promotion**:
The human action of marking a **GitHub issue** ready to run by applying the **Sandcastle label**.
_Avoid_: "auto-tagging", "enqueueing" unless the issue is actually entering a run queue.

**Demotion**:
The human action of removing the **Sandcastle label** from an **eligible issue**.
_Avoid_: "unqueue" unless the issue is actually leaving a run queue.

**Eligible issue**:
A **GitHub issue** carrying the **Sandcastle label**.
_Avoid_: "assigned work", "queued task"

**Run session**:
A user-supervised execution of a **Sandcastle workflow**.
_Avoid_: "run" when the meaning could be confused with Sandcastle's `run()` API.

## Relationships

- **Watchtower** operates **Sandcastle** workflows
- A **Sandcastle workflow** may operate on an **eligible issue**
- **Watchtower** presents an **issue board** for **GitHub issues**
- The **triage screen** contains open **GitHub issues** without the **Sandcastle label**
- The **run screen** contains a **ready-to-run lane** for open **eligible issues** and a **closed run lane** for closed **eligible issues**
- The **issue board** contains canonical triage lanes plus **Inbox** and **Conflicted issue** lanes
- An **issue card** represents one **GitHub issue** on the **issue board**
- A **board move** changes canonical triage labels according to the destination lane while preserving non-triage labels
- A **wontfix move** is presented as `Close as wontfix` and closes the **GitHub issue**
- The **target repo** is the current git repository where **Watchtower** is running
- The **target repo** is expected to have completed **skills setup** before **Watchtower** is used
- The **target repo** must have a **Sandcastle config directory** before **Watchtower** is used
- **Skills setup** supplies the label strings used for **triage states**
- Missing canonical triage labels indicate incomplete **skills setup**
- A missing **Sandcastle label** indicates incomplete Sandcastle label setup
- A **GitHub issue** has a **triage state** expressed by one canonical triage label
- The **Inbox** contains open **GitHub issues** with no canonical triage label
- Moving an **issue card** to **Inbox** removes canonical triage labels while preserving non-triage labels
- A **conflicted issue** has multiple canonical triage labels and needs a **triage transition** to resolve it
- A **triage transition** changes only labels, not issue content or project metadata
- A **GitHub issue** with the **ready-for-agent label** is ready for an **agent**
- **Promotion** is explicit; the **ready-for-agent label** alone does not make a **GitHub issue** an **eligible issue**
- **Promotion** can apply to any open **GitHub issue** on the **triage screen**, but requires confirmation when the issue does not have the **ready-for-agent label**
- **Watchtower** manages the **Sandcastle label** on **GitHub issues**
- **Sandcastle** invokes an **agent** inside a **sandbox**
- Applying the **Sandcastle label** through **promotion** makes a **GitHub issue** an **eligible issue**
- **Promotion** preserves the current **triage state**
- **Promotion** moves an open **GitHub issue** from the **triage screen** to the **run screen**
- Removing the **Sandcastle label** through **demotion** makes an **eligible issue** return to the **triage screen** if it is still open
- An **eligible issue** may be selected as a **task** during a **run session**
- An **agent** works on a **task** during a **run session**

## Example dialogue

> **Dev:** "Is Watchtower replacing Sandcastle?"
> **Domain expert:** "No. **Watchtower** operates **Sandcastle** workflows; **Sandcastle** remains the engine that invokes the **agent** inside the **sandbox**."

> **Dev:** "Do I tag this issue for Sandcastle?"
> **Domain expert:** "Use the **Sandcastle label**. Once it is applied, the **GitHub issue** becomes an **eligible issue** that **Sandcastle** may select as a **task**."

> **Dev:** "Why did this issue disappear from triage after I marked it ready to run?"
> **Domain expert:** "**Promotion** applied the **Sandcastle label**, so the issue moved from the **triage screen** to the **run screen**."

## Flagged ambiguities

- "watch" can imply passive observation, but **Watchtower** is intended to both observe and orchestrate **Sandcastle** workflows.
- "tag" was used to describe GitHub issue metadata -- resolved: use **Sandcastle label** because GitHub and Sandcastle both call this a label.
- "Ralph loop" was used for post-eligibility automation -- resolved: use **Sandcastle workflow** for the broad concept and **run session** for active execution.
- "Sandcastle queue" was considered as a triage board lane -- resolved: use a separate **run screen** with **ready-to-run lane** and **closed run lane**.
