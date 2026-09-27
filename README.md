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
Các endpoint đọc, thống kê và xuất doanh thu cũng yêu cầu
`api.incomes.get-incomes-by-date-range`; việc ẩn menu ở web không phải là lớp
bảo vệ duy nhất. Đọc Daily Ads Metrics, KPI tháng và packing rules của dashboard
cũng dùng quyền xem doanh thu này.

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

`POST /api/v1/incomes` (tạo đơn thủ công) chỉ nhận JSON đơn hàng với `orderId`,
`channel`, `date` và ít nhất một product hợp lệ; API kiểm tra channel tồn tại,
không nhận field thừa và trả `409` khi order đã tồn tại trong cùng kênh. Luồng
import file TikTok Shop vẫn dùng `POST /api/v1/incomes/insert-and-update-source`.

Month Goals chỉ nhận tháng `0–11`, năm hợp lệ, channel tồn tại, KPI không âm và
tỷ lệ ads `0–100`; KPI trùng theo kênh/tháng trả `409`. Packing Rules chỉ nhận
loại hộp đã công bố, product không trùng và quantity nguyên dương hoặc `null`,
với `maxQuantity` không nhỏ hơn `minQuantity`.

Product chỉ nhận tên và danh sách mặt hàng không trùng, với quantity nguyên
dương và mỗi storage item phải tồn tại. Storage quick-create vẫn nhận payload
legacy từ form cũ nhưng chỉ lưu `code` và `name` trong schema Tratosapp; field
lạ ngoài payload legacy bị từ chối và code trùng trả `409`.

Tìm Product và Storage Item yêu cầu `api.products.search-products` ở cả web và
API. Search text được hiểu là literal text, không phải regular expression, và
`deleted` chỉ chấp nhận `true` hoặc `false`.

Parser chuẩn hóa BOM/khoảng trắng trong header, kiểm tra cột bắt buộc theo loại
file, và nhận các format tiền `1,234.56` hoặc `1.234,56`. Dòng tổng doanh thu
thiếu/không hợp lệ `Quantity` hay `SKU Subtotal` sẽ dừng import trước khi ghi DB.

Affiliate chỉ cập nhật các dòng product chưa `sourceChecked`; một lần cập nhật
áp dụng cho mọi dòng cùng order/SKU/quantity chưa check. Import lại file affiliate
không ghi đè các dòng đã được phân loại.

## Deploy

- Render: tạo Blueprint từ repository để dùng `render.yaml`; API dùng compute plan `free` và Node.js `22.23.2`. Điền `DATABASE_URL`, `ALLOW_ORIGIN` và thông tin seed admin trước khi deploy. Free web service sẽ sleep sau 15 phút không có traffic, có thể mất khoảng một phút để thức dậy, và không có Render Shell; đây là giới hạn của gói Free, không nên xem là production uptime.
- Seed admin trên máy local sau khi API đã deploy: điền `apps/api/.env` (file local đã bị Git ignore), mở shell với Node.js `22.23.2`, chạy `set -a && source apps/api/.env && set +a && pnpm --filter @tratosapp/api seed:admin`. Lệnh này kết nối MongoDB bằng `DATABASE_URL` trong env; không commit `.env`.
- Vercel: liên kết project với repository ở root và đặt `VITE_BACKEND_URL=https://<render-service>.onrender.com/api` trong Production Environment Variables. Vì Vercel chỉ chọn major Node.js và tự cập nhật patch, FE được build trong GitHub Actions bằng Node.js `22.23.2`, sau đó deploy prebuilt output bằng Vercel CLI. Đặt Ignored Build Step của project thành `Don't build anything` để Vercel không chạy thêm build từ Git.
- Thêm ba GitHub Actions repository secrets để bật workflow `.github/workflows/deploy-web-vercel.yml`: `VERCEL_TOKEN`, `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`. Workflow chạy khi có thay đổi liên quan web trên `main`, hoặc thủ công qua `workflow_dispatch`. Nếu chưa có đủ secrets, workflow cảnh báo và bỏ qua deploy.
- `ALLOW_ORIGIN` trên Render phải là domain FE Vercel (ví dụ `https://<project>.vercel.app`), không có dấu `/` ở cuối. Có thể nhập nhiều origin, phân tách bằng dấu phẩy.

Node runtime bắt buộc: `22.23.2`; package manager: pnpm `9.15.5`.
