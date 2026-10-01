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

- API production chạy trên VPS bằng Docker Compose; image pin Node.js `22.23.2` và pnpm `9.15.5`. Image được build trên GitHub Actions rồi chuyển nén qua SSH; VPS chỉ nạp image và chạy container, không cần build nặng tại chỗ. MongoDB vẫn là external database trong `DATABASE_URL` (ví dụ MongoDB Atlas), không chuyển database lên VPS.
- DNS A record `tra.candycal-be.space` trỏ về IPv4 VPS `222.255.215.135`. VPS hiện đã có Nginx chiếm cổng 80/443, vì vậy không chạy Caddy/container nào bind hai cổng này. API chỉ publish nội bộ `127.0.0.1:3001`; Nginx thêm server block riêng proxy hostname này tới API, giữ nguyên các vhost CandyCal hiện có. Cần TLS certificate hợp lệ cho `tra.candycal-be.space` (kiểm tra Certbot/certificate hiện tại trước khi sửa cấu hình Nginx). Mở SSH port cho GitHub Actions. Docker Engine + Docker Compose plugin đã cần có trên Ubuntu 22.04.
- Tạo riêng thư mục deploy `/opt/tratosapp` và thư mục secrets `/etc/tratosapp`. Tạo `/etc/tratosapp/api.env` từ `deploy/vps/api.env.example`, điền `DATABASE_URL`, một `JWT_SECRET` ngẫu nhiên mạnh, `ALLOW_ORIGIN=https://<project>.vercel.app` và seed admin. File thật chỉ ở VPS, không commit. GitHub Actions đăng nhập SSH trực tiếp bằng `root`, nên root sở hữu và có quyền ghi các thư mục này cũng như chạy Docker.
- Nếu dùng MongoDB Atlas, thêm public outbound IPv4 của VPS vào Network Access allowlist trước khi chạy API; không mở database cho toàn Internet.
- GitHub Actions workflow `.github/workflows/deploy-api-vps.yml` chạy API tests/build, build production image, rsync deployment files và stream image qua SSH; trên VPS workflow nạp image, restart container và health-check khi có thay đổi API/deploy trên `main`, hoặc chạy thủ công. Đường dẫn `/opt/tratosapp` là thư mục riêng dành cho app vì workflow đồng bộ nội dung vào đó. Thiếu VPS secrets thì test/build vẫn chạy nhưng deploy được skip.
- Thêm GitHub Actions repository secrets: `VPS_HOST` (IP/hostname), `VPS_SSH_PRIVATE_KEY`, `VPS_KNOWN_HOSTS`; `VPS_SSH_PORT` là tùy chọn, mặc định `22`. Workflow dùng `root` trực tiếp, không cần secret `VPS_USER`. Cấu hình public key tương ứng trong `/root/.ssh/authorized_keys`; ưu tiên SSH key-only (không bật đăng nhập root bằng password), xác minh host key trước khi lưu `VPS_KNOWN_HOSTS`, và không gửi private key qua chat. Lưu ý: quyền root cho phép workflow có toàn quyền quản trị VPS.
- Vercel vẫn host FE. Đặt `VITE_BACKEND_URL=https://tra.candycal-be.space/api` trong Production Environment Variables. `ALLOW_ORIGIN` ở `/etc/tratosapp/api.env` phải là domain Vercel chính xác, không có dấu `/` cuối; nhiều origin phân tách bằng dấu phẩy. Deploy lại FE sau khi đổi biến.
- Seed admin sau khi API lên: `cd /opt/tratosapp && docker compose -p tratosapp -f deploy/vps/docker-compose.yml exec -T api node apps/api/scripts/seed-admin.js`. Lệnh này đặt lại password và cấp quyền `*` cho email seed, nên chỉ chạy lúc tạo/khôi phục admin có chủ đích.
- Giữ Render service hiện tại để rollback trong lúc chuyển đổi. Chỉ dừng/xóa service sau khi xác nhận đăng nhập và các luồng API trên VPS hoạt động ổn định; `render.yaml` hiện được giữ làm cấu hình fallback.
- FE được build trong GitHub Actions bằng Node.js `22.23.2`, sau đó deploy prebuilt output bằng Vercel CLI. Đặt Ignored Build Step của Vercel thành `Don't build anything` để Vercel không build lần hai từ Git.
- Thêm ba GitHub Actions repository secrets để bật workflow `.github/workflows/deploy-web-vercel.yml`: `VERCEL_TOKEN`, `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`. Workflow chạy khi có thay đổi liên quan web trên `main`, hoặc thủ công qua `workflow_dispatch`. Nếu chưa có đủ secrets, workflow cảnh báo và bỏ qua deploy.

Node runtime bắt buộc: `22.23.2`; package manager: pnpm `9.15.5`.
