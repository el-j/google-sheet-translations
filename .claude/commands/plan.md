# Plan Command

Use this command to create a structured development plan before making any code
changes. Always run this first.

## Usage

Call `report_progress` with a markdown checklist as your first action on any
non-trivial task. This creates the PR, establishes the plan, and provides a
commit trail.

## Plan template

```markdown
- [ ] **Category 1** – short description
  - [ ] Sub-task A
  - [ ] Sub-task B
- [ ] **Category 2**
  - [ ] Sub-task C
- [ ] Build + lint + tests pass
- [ ] Code review (code_review tool)
- [ ] Security scan (codeql_checker tool)
```

## Planning checklist

Before writing code, answer:

1. **Scope** – What files will change?
2. **Tests** – Which existing tests cover this area? Do we need new ones?
3. **Dependencies** – Are there npm packages involved? Run `gh-advisory-database`
   before adding any new dependency.
4. **Security** – Does this touch auth, file paths, user input, env vars?
5. **Breaking changes** – Does this change any exported API?
6. **CI** – Will existing workflows pass? Do any workflows need updating?

## Plan sizing

| Task size | Approach |
|-----------|----------|
| 1–2 file edits | Inline, no sub-agents needed |
| 3–5 file edits | Plan + sequential execution |
| 6+ file edits | Plan + orchestrate.md swarm |
| Security remediation | Always use orchestrate.md |

## Example plan output (report_progress)

```
- [ ] **Security fixes**
  - [ ] Downgrade semantic-release to ^24.2.9
  - [ ] Add dependabot.yml
- [ ] **Pre-release gate**
  - [ ] Add quality-gate job to release.yml
  - [ ] Verify release job needs quality-gate
- [ ] Build + lint + 205 tests pass
- [ ] code_review + codeql_checker
```
