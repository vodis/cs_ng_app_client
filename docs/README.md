# Documentation

This directory contains the maintained project guides for the CraftScript
Angular host. The root [`README.md`](../README.md) is the onboarding entry point;
detailed and task-specific guidance belongs here.

## Guides

| Document                                                   | Purpose                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Architecture](architecture.md)                            | System ownership, Angular layering, state, storage, telemetry, and host/MFE/backend contracts   |
| [Development](development.md)                              | Local setup, branch workflow, implementation standards, testing, and change management          |
| [Branding](branding.md)                                    | Visual tokens, typography, spacing, responsive layout, and shell UI constraints                 |
| [Exchange page](exchange-page.md)                          | Token Exchange structure, data sources, styling boundaries, responsive behavior, and E2E checks |
| [Wallet MFE contracts](../src/app/mfe-contracts/README.md) | Host-side runtime interfaces and compatibility expectations for `cs_mfe-wallets`                |

Agent and contributor rules remain at [`AGENTS.md`](../AGENTS.md) so automated
tools can discover them from the repository root.

## Maintenance

- Update links in this index, the root README, and AGENTS.md when documents are
  added, renamed, or removed.
- Keep implementation-specific details next to their owning code when that
  makes the contract easier to maintain.
- Prefer one canonical guide for each topic; link to it instead of duplicating
  rules across multiple files.
