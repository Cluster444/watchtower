# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --label Sandcastle --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

Select every issue that can be worked safely in parallel. Do not serialize work unless there is a concrete dependency or likely merge conflict. If you select only one issue while multiple open issues remain, the plan must make clear why the other issues are blocked.

For each unblocked issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "sandcastle/issue-42-fix-auth-bug", "rationale": "No open issue introduces required code or touches the same module."}], "blocked": [{"id": "43", "title": "Add auth UI", "blockedBy": ["42"], "rationale": "Depends on the auth API shape from issue 42."}]}
</plan>

Include only unblocked issues in `issues`. Put blocked issues in `blocked` with `blockedBy` and `rationale` so the orchestration log explains why they were not selected. If every issue is blocked, include the single highest-priority candidate in `issues` (the one with the fewest or weakest dependencies) and explain the risk in its `rationale`.

Output only the `<plan>` block. Do not include prose outside the tags.
