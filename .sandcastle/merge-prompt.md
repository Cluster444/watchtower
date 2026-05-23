# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `npm run typecheck` and `npm run test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# CLOSE ISSUES

Do not close issues with `gh issue close` during the merge. Instead, include GitHub auto-close keywords in the final merge summary commit message so the issues close when the merge commit reaches the default branch on GitHub.

The final merge summary commit body must include one line per completed issue in this exact form:

`Closes #<ID>`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
