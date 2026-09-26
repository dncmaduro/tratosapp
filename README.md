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

## API tests

Với Node.js `22.23.2` và pnpm `9.15.5`, chạy từ root:

```sh
pnpm --filter @tratosapp/api test
```

Lệnh này build API rồi chạy test xác thực bằng JWT thật và user model giả lập;
không cần kết nối MongoDB. Test kiểm tra loại token, token lỗi/hết hạn,
Authorization header và tài khoản bị khóa/xóa.

Access token phải có `type: "access"`; refresh token chỉ được dùng để đổi token.
Access token cũ chưa có `type` sẽ bị từ chối sau cập nhật: cần refresh để lấy
token mới hoặc đăng nhập lại. API kiểm tra tài khoản còn tồn tại và đang hoạt
động trên mỗi request có JWT guard.

## Deploy

- Render: tạo Blueprint từ repository để dùng `render.yaml`; điền `DATABASE_URL`, `ALLOW_ORIGIN` và thông tin seed admin. Sau lần deploy đầu, chạy `pnpm --filter @tratosapp/api seed:admin` trong Render Shell.
- Vercel: import repository ở root, Vercel tự dùng `vercel.json`; đặt `VITE_BACKEND_URL=https://<render-service>.onrender.com/api` rồi redeploy. Giá trị `ALLOW_ORIGIN` ở Render là URL Vercel không có dấu `/` cuối.

Node runtime bắt buộc: `22.23.2`; package manager: pnpm `9.15.5`.
