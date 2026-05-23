# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `bun run typecheck` and `bun test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# MARK ISSUES COMPLETE

Do not close issues with `gh issue close` during the merge. Instead, include GitHub auto-close keywords in the final merge summary commit message so the issues close when the merge commit reaches the default branch on GitHub.

The final merge summary commit body must include one line per completed issue in this exact form:

`Closes #<ID>`

After the merge has succeeded, `bun run typecheck` and `bun test` pass, and the final merge summary commit has been created, remove the `Sandcastle` label from each completed issue:

`gh issue edit <ID> --remove-label Sandcastle`

This marks the issue as no longer eligible for the local Ralph planner even before the `Closes #<ID>` commit has been pushed to GitHub's default branch.

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
