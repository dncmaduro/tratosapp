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
## Deploy

- Render: tạo Blueprint từ repository để dùng `render.yaml`; điền `DATABASE_URL`, `ALLOW_ORIGIN` và thông tin seed admin. Sau lần deploy đầu, chạy `pnpm --filter @tratosapp/api seed:admin` trong Render Shell.
- Vercel: import repository ở root, Vercel tự dùng `vercel.json`; đặt `VITE_BACKEND_URL=https://<render-service>.onrender.com/api` rồi redeploy. Giá trị `ALLOW_ORIGIN` ở Render là URL Vercel không có dấu `/` cuối.

Node runtime bắt buộc: `22.23.2`; package manager: pnpm `9.15.5`.
