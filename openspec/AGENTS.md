# OpenSpec instructions for agents

- Before writing feature code, check `openspec/changes/` for an **approved** proposal covering it. If none exists, write one from `changes/_template/` and stop for approval unless the task says it is pre-approved.
- Treat `openspec/specs/` as current behavior and `openspec/changes/*/specs/` as the intended delta.
- Every requirement uses SHALL/MUST wording and has at least one `#### Scenario:` with WHEN/THEN bullets.
- Keep FR/NFR IDs from the SRS in requirement titles so traceability survives (`### Requirement: FR-INC-004 Single failure does not open an incident`).
- Architecture rules live in `docs/architecture/` and `.cursor/rules/`; a proposal may not contradict them without also updating them.
