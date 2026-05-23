# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Confirm the worktree is clean before starting.
2. First try `git merge --ff-only <branch>`.
3. If the fast-forward merge succeeds, continue to verification.
4. If the fast-forward merge fails because the branch is not a descendant of the current branch, do not create a merge commit. Instead, squash the branch's work into one commit on top of the current branch, then fast-forward merge that squashed branch:
   - Create or reset a temporary branch at the current branch.
   - Squash the issue branch's full diff onto the temporary branch.
   - Reuse the issue branch's single existing commit message when it has one commit.
   - When the issue branch has multiple commits, create one squashed commit message that summarizes the implementer/reviewer work.
   - Fast-forward the current branch to the temporary squashed branch with `git merge --ff-only <temporary-branch>`.
5. If conflicts occur while creating the squashed branch, resolve them intelligently by reading both sides and choosing the correct resolution.
6. Run `bun run typecheck` and `bun test` after the branch is merged.
7. If verification fails after a clean fast-forward, do not create a new commit on the current branch. Stop and report the failure so the issue branch can be fixed by the implementer/reviewer loop.
8. If verification fails while using the temporary squashed branch fallback, fix the squashed branch before fast-forwarding the current branch, then rerun verification.

The merger must not create merge commits, empty summary commits, or extra follow-up commits on the current branch. The implementer already made the work commit, and the reviewer may have made review-fix commits. The final main history must remain linear.

# MARK ISSUES COMPLETE

Do not close issues with `gh issue close` during the merge. After the merge has succeeded and `bun run typecheck` and `bun test` pass, remove the `Sandcastle` label from each completed issue:

`gh issue edit <ID> --remove-label Sandcastle`

This marks the issue as no longer eligible for the local Ralph planner and prevents the same completed work from being planned again.

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
