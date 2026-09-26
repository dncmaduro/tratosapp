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

Lệnh này build API rồi chạy test xác thực bằng JWT thật và model giả lập;
không cần kết nối MongoDB. Test kiểm tra loại token, token lỗi/hết hạn,
Authorization header, tài khoản bị khóa/xóa, quyền ghi kênh/vật tư, validation
user/kênh/Ads/import và khả năng nạp AppModule/schema (không thay thế test
khởi động với MongoDB thật).

Access token phải có `type: "access"`; refresh token chỉ được dùng để đổi token.
Access token cũ chưa có `type` sẽ bị từ chối sau cập nhật: cần refresh để lấy
token mới hoặc đăng nhập lại. API kiểm tra tài khoản còn tồn tại và đang hoạt
động trên mỗi request có JWT guard.

Quyền ghi kênh giữ tên tương thích với ứng dụng gốc dù URL API là `/channels`:

- `api.livestreamchannels.create-livestream-channel`: tạo kênh.
- `api.livestreamchannels.update-livestream-channel`: sửa kênh.
- `api.livestreamchannels.delete-livestream-channel`: xóa kênh.
- `api.storageitems.create-item`: tạo vật tư.

Admin có thể lấy các khóa này qua `GET /api/v1/users/permissions` để cấp quyền.
User chỉ có quyền xem sẽ bị trả 403 khi ghi; tài khoản có `*` vẫn được phép.

API kiểm tra body trước khi ghi dữ liệu: kênh chỉ là `tiktokshop`, chỉ nhận các
trường đã công bố và báo `409` khi trùng username. API user kiểm tra email,
mật khẩu (8 ký tự, không quá 72 byte UTF-8), URL avatar, ID, `active` và các
quyền có trong catalog; field thừa hoặc dữ liệu sai nhận `400`, user không có
nhận `404`, email trùng nhận `409`.

Import doanh thu chỉ chấp nhận file `.xlsx`, `.xls` hoặc `.csv` có dữ liệu và
đúng số file cho từng mode: `full` là 2 file, còn `base-only`, `affiliate-only`
và `status-only` là 1 file. API xác thực kênh tồn tại và kiểm tra thứ tự chunk
trước khi đọc file; điều này giữ tương thích với luồng import chunk ở web.

DailyAdsMetrics lưu ngày theo `Asia/Ho_Chi_Minh` thay vì timezone của server;
sáu trường nhập là bắt buộc và phải là số không âm. Công thức metrics được giữ
nguyên từ ứng dụng nguồn.

`SKU Subtotal Before/After Discount` của file TikTok Shop là tổng tiền của từng
dòng SKU, đã bao gồm `Quantity`. Dashboard cộng subtotal một lần; quantity chỉ
dùng cho các chỉ số số lượng và đối chiếu dữ liệu affiliate.

Ngày `Created Time` khi import được hiểu theo giờ Việt Nam cho Excel serial,
`dd/MM/yyyy HH:mm:ss` và chuỗi ISO không có timezone; chuỗi ISO có offset hoặc
`Z` giữ nguyên thời điểm gốc.

Các endpoint đọc, xóa và xuất doanh thu cũng hiểu `YYYY-MM-DD` là trọn một ngày
theo `Asia/Ho_Chi_Minh`; báo cáo tháng dùng đúng ranh giới tháng Việt Nam. API
trả `400` cho ngày, tháng, ID, page hoặc limit không hợp lệ thay vì âm thầm đổi
query; text tìm kiếm được escape để tìm theo đúng ký tự người dùng nhập.

Parser chuẩn hóa BOM/khoảng trắng trong header, kiểm tra cột bắt buộc theo loại
file, và nhận các format tiền `1,234.56` hoặc `1.234,56`. Dòng tổng doanh thu
thiếu/không hợp lệ `Quantity` hay `SKU Subtotal` sẽ dừng import trước khi ghi DB.

Affiliate chỉ cập nhật các dòng product chưa `sourceChecked`; một lần cập nhật
áp dụng cho mọi dòng cùng order/SKU/quantity chưa check. Import lại file affiliate
không ghi đè các dòng đã được phân loại.

## Deploy

- Render: tạo Blueprint từ repository để dùng `render.yaml`; điền `DATABASE_URL`, `ALLOW_ORIGIN` và thông tin seed admin. Sau lần deploy đầu, chạy `pnpm --filter @tratosapp/api seed:admin` trong Render Shell.
- Vercel: import repository ở root, Vercel tự dùng `vercel.json`; đặt `VITE_BACKEND_URL=https://<render-service>.onrender.com/api` rồi redeploy. Giá trị `ALLOW_ORIGIN` ở Render là URL Vercel không có dấu `/` cuối.

Node runtime bắt buộc: `22.23.2`; package manager: pnpm `9.15.5`.
