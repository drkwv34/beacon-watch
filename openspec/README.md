# OpenSpec — beacon-watch

Spec-driven development: **any change to product behavior starts as a change proposal here**, not as ad-hoc commits.

```
openspec/
  README.md        you are here: the workflow
  project.md       product context, conventions, and the capability map (FR IDs → capability)
  AGENTS.md        short instructions for coding agents
  specs/           current truth: one folder per shipped capability (empty until the first change is archived)
  changes/         proposed deltas, one folder per change
    _template/     copy this to start a change
    archive/       applied changes, moved here after merge
```

## Workflow

1. **Scope.** Find the FR/NFR IDs you are touching in [`project.md`](project.md) (source: the SRS).
2. **Propose.** Copy `changes/_template/` to `changes/<verb-noun>/` (kebab-case, e.g. `add-target-crud`). Fill in:
   - `proposal.md`: why, what changes, FR IDs, out of scope, risks.
   - `tasks.md`: an ordered implementation checklist.
   - `specs/<capability>/spec.md`: requirement deltas under `## ADDED`, `## MODIFIED`, or `## REMOVED Requirements`, each with at least one `#### Scenario:`.
3. **Approve.** Solo repo: set `Status: approved` with date and approver in `proposal.md`. That line is the gate.
4. **Implement** on a feature branch; reference the change folder in the PR body. Tick `tasks.md` as you go.
5. **Archive.** After merge, fold the deltas into `specs/<capability>/spec.md` and move the change folder to `changes/archive/YYYY-MM-DD-<name>/`.

## What needs a proposal

| Needs a proposal | Does not |
| --- | --- |
| New or changed endpoint, schema, or job behavior | Tooling, CI, lint config, dependency bumps |
| Changes to probe policy, cache keys/TTLs, rate limits | Docs-only or copy fixes |
| Incident state machine changes | Refactors with no observable behavior change |

The Day 1 scaffold is tooling-only and has no proposal. Day 2 (auth and targets) is the first change that must go through this flow.
