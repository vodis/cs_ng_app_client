# CraftScript Angular client

Angular host application for CraftScript. It owns the application shell,
top-level routing, session-facing UI, and shared product experiences. Wallet
workflows are integrated from `cs_mfe-wallets` through Module Federation, and
server-side product capabilities are consumed from the CraftScript NestJS API.

## Architecture at a glance

| Area                                                 | Owner               |
| ---------------------------------------------------- | ------------------- |
| Shell, navigation, shared UX, and host routes        | This repository     |
| Wallet UI, provider lifecycle, and wallet operations | `cs_mfe-wallets`    |
| Public API contracts and service orchestration       | `cs_nestjs_backend` |

Cross-repository behavior must use documented, typed contracts. See the
[architecture guide](docs/architecture.md) and the
[wallet MFE contract](src/app/mfe-contracts/README.md) before changing an
integration boundary.

## Local development

Prerequisites:

- Node.js 18.19 or newer
- pnpm 9.15.0
- GitHub Packages read access for the private `@vodis` dependencies

Install dependencies and start the host:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

The development server runs at <http://localhost:5002>. By default, the host
uses the production CraftScript API and wallet remote. For coordinated local
wallet development, run `cs_mfe-wallets` separately and point
`src/config/mf.manifest.json` to its local remote entry as described in the
[development guide](docs/development.md).

Merges to `develop` publish the staging image and orchestrator metadata used by
<https://staging-app.craftscript.com>. The staging bundle is compiled against
the isolated staging API.

## Validation

Run the checks that match the scope of the change:

| Check                             | Command                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| ESLint                            | `pnpm run lint`                                                                 |
| Unit tests                        | `pnpm exec ng test --no-watch --no-progress --browsers=ChromeHeadlessNoSandbox` |
| Production build                  | `pnpm run build-prod`                                                           |
| Shell and critical-flow E2E tests | `pnpm run e2e`                                                                  |
| SCSS lint                         | `pnpm run stylelint-check`                                                      |

The minimum merge gates and integration smoke requirements are documented in
the [development guide](docs/development.md).

## Documentation

Start with the [documentation index](docs/README.md):

- [Architecture guide](docs/architecture.md)
- [Development guide](docs/development.md)
- [Branding guide](docs/branding.md)
- [Exchange page reference](docs/exchange-page.md)
- [Agent and contributor instructions](AGENTS.md)
- [Wallet MFE contracts](src/app/mfe-contracts/README.md)

## Branch workflow

Create focused task branches from an up-to-date `develop` branch and open pull
requests back to `develop`. Production promotion is handled separately through
the repository release workflow.
