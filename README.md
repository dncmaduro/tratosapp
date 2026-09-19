# Tratosapp

TikTok Shop application extracted from Candy Cal as an independent monorepo.

## Workspace layout

```text
apps/
  api/         NestJS API, deployed to Render
  web/         React/Vite web application, deployed to Vercel
packages/
  contracts/   Shared API contracts and types
```

The repository uses pnpm workspaces and requires Node.js **22.23.2 exactly**.
`.nvmrc` and `engine-strict` prevent dependencies from being installed using a
different Node version. Application dependencies and runnable scripts are
added as each extraction step completes.
