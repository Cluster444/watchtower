# TASK

Review the work on the current branch, which should be `{{BRANCH}}`, against the issue it implemented. Focus on whether the branch correctly satisfies the issue goals without introducing regressions. This is a review pass, not a general cleanup pass.

# CONTEXT

## Branch diff

!`git diff {{SOURCE_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{SOURCE_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Confirm branch/base**: Verify the current branch is `{{BRANCH}}`. Use `{{SOURCE_BRANCH}}` as the review base; do not assume the default branch is named `main` or `master`.

2. **Understand the issue**: Read the issue and any linked parent issue or PRD. Review the branch against that requested outcome.

3. **Review correctness first**:
   - Does the implementation match the issue goals and acceptance criteria?
   - Are important edge cases handled?
   - Are new or changed behaviours covered by meaningful tests?
   - Does the change preserve existing behavior outside the issue scope?
   - Are GitHub/API mutations safe and intentionally ordered?
   - Are there unsafe casts, `any` types, unchecked assumptions, credential leaks, or injection risks?

4. **Only edit for real review findings**: Make code changes only when you find a concrete correctness issue, missing test, regression risk, or maintainability problem that directly affects the issue work. Do not make cosmetic cleanup, broad refactors, naming-only changes, or general codebase improvements. Those will happen later with human-in-the-loop cleanup.

5. **Report findings explicitly**: If you find issues, list them by severity with file/line references before editing. If there are no material findings, say so and do not commit a cleanup-only change.

6. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md when you must change code.

7. **Verify**: If you make changes, run tests and type checking before committing.

# EXECUTION

If you find material review findings that require changes:

1. Make the changes directly on this branch
2. Run tests and type checking to ensure nothing is broken
3. Commit with a message describing the review fix

If the implementation satisfies the issue and no material changes are needed, do not edit or commit anything. Output a brief review result and `<promise>COMPLETE</promise>`.

Once complete, output <promise>COMPLETE</promise>.
