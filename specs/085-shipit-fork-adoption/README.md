# ShipIt Fork Adoption Plans

Detailed implementation plans for adopting changes from `jrmatherly/shipit` back into `shep-ai/cli`.

Source analysis: [TODOS.md](../../TODOS.md)

## Plan Index

| Plan | Priority | Items | Status |
|------|----------|-------|--------|
| [P0 Security](./p0-security.md) | P0 | 1-4 | Pending |
| [P1 Correctness & Performance](./p1-correctness-perf.md) | P1 | 5-8 | Pending |
| [P1 Architecture Refactors](./p1-architecture-refactors.md) | P1 | 9-15 | Pending |
| [P1 TypeSpec Modernization](./p1-typespec-modernization.md) | P1 | 16-18 | Pending |
| [P2 Agent System](./p2-agent-system.md) | P2 | 19-21 | Pending |
| [P2 Testing & DX](./p2-testing-dx.md) | P2 | 22-26 | Pending |
| [P2 Accessibility](./p2-a11y.md) | P2 | 27-29 | Pending |
| [P2 CI/CD](./p2-cicd.md) | P2 | 30-33 | Pending |
| [P3 Dependency Upgrades](./p3-dependency-upgrades.md) | P3 | 34-37 | Pending |

## Suggested Ordering

- **Week 1**: P0 (security + correctness bugs) - low-risk cherry-picks
- **Week 2**: P1 architecture cleanup - compounds; later items easier after DI modularization
- **Week 3**: P1 TypeSpec + perf - date emitter patch, batch SSE, validate script
- **Week 4**: P2 agents - Copilot/RovoDev integration, per-agent permission modes
- **Ongoing**: P2 testing/DX/A11y/CI improvements, P3 dependency upgrades
