# Tratos — baseline tách TikTok Shop

Ngày lập: 2026-09-19
Nguồn chỉ đọc: `../candy-cal-fe`, `../candy-cal-be`

## Quyết định đã chốt

- Tratos là ứng dụng độc lập cho công ty khác: MongoDB, user, role, permission và dữ liệu tách biệt hoàn toàn.
- Database mới bắt đầu rỗng; không migrate user hay dữ liệu Candy Cal.
- FE deploy Vercel, API deploy Render, dùng domain mặc định của hai dịch vụ.
- Ưu tiên giữ hành vi TikTok Shop đang có trước, sau đó mới tinh gọn kiến trúc.
- Chỉ giữ hệ Ads mới `DailyAdsMetrics`; loại bỏ hệ `DailyAds` cũ (nhập Live Ads/Shop Ads, upload 4/6 file trước–sau 16h).
- Admin đầu tiên được seed một lần qua biến môi trường `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`.

## Chức năng nguồn cần có ở Tratos

### 1. Đăng nhập và phân quyền

- Login, refresh/check token, lấy profile hiện tại, đổi mật khẩu và avatar.
- User có `roles`, `permissions`, `active`; API dùng JWT Bearer token.
- Màn hình TikTok chỉ vào được khi có một trong hai quyền nền: `api.products.search-products` hoặc `api.incomes.get-incomes-by-date-range`.
- Cần trang/quy trình quản trị user tối thiểu để cấp quyền cho công ty mới, dù không nhất thiết mang nguyên UI admin Candy Cal ở lần đầu.

### 2. Kênh TikTok Shop

- Tên source hiện tại: `LivestreamChannel`, nhưng thực tế schema đã hỗ trợ `platform: "tiktokshop" | "shopee"`.
- TikTok workspace lọc chỉ `tiktokshop` (và alias `tiktok` ở FE). Mỗi kênh có `name`, `username`, `usernames`, `link`, `sortOrder`.
- Dữ liệu doanh thu, KPI và Ads Metrics đều gắn với một kênh. Trong app mới, tên module/entity sẽ đổi thành `Channel`/`TikTokChannel`; không mang nghiệp vụ livestream.

### 3. SKU

Route: `/tiktokshop/sku`.

- Xem/tìm kiếm SKU, bao gồm SKU đã xóa mềm.
- Tạo, sửa, xóa mềm và khôi phục sản phẩm.
- Mỗi product có tên và danh sách item/số lượng; code hiện tại tham chiếu `StorageItem`.
- Có công cụ tính file XLSX TikTok (`/v1/products/cal-xlsx`). Đây là dependency cần tách rõ ở bước API, vì Product hiện phụ thuộc `StorageItem` của Candy Cal.

Quyền FE đang dùng: `api.products.search-products`, `api.products.create-product`, `api.products.update-product`, `api.products.delete-product`, `api.products.restore-product`, `api.products.cal-xlsx`.

### 4. Workspace doanh thu

Route: `/tiktokshop/incomes?channel=<id>&tab=<tab>`; vào `/tiktokshop` sẽ chuyển về SKU.

Các tab hiện hữu:


| Tab             | Hành vi cần giữ                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `dashboard`     | Dashboard doanh thu tháng, sản lượng, KPI, xu hướng và so sánh kênh.                                                              |
| `daily-stats`   | Thống kê ngày/tuần/tháng: doanh thu, đơn, sản phẩm, nguồn, Live/Video, vận chuyển, thùng và KPI.                             |
| `ads-metrics`   | Quản lý hệ Ads mới theo ngày/kênh.                                                                                                   |
| `incomes`       | Danh sách doanh thu, lọc ngày/kênh/từ khóa/nguồn, nhập file, xóa theo ngày, cập nhật nguồn, export XLSX, xem chi tiết đơn. |
| `kpi`           | Tạo/sửa/xem KPI tháng theo kênh.                                                                                                       |
| `packing-rules` | Quản lý quy cách đóng hộp theo mã sản phẩm và khoảng số lượng.                                                               |

Trang chi tiết đơn: `/tiktokshop/incomes/$incomeId`; hiển thị khách hàng, vận chuyển, sản phẩm, nguồn, giá/chiết khấu, affiliate, nội dung và thùng.

### 5. Doanh thu và nhập file

- API hiện đại cần giữ: `POST /v1/incomes/insert-and-update-source` (nhiều file, `channel`, các `updateMode`), `GET /v1/incomes`, `DELETE /v1/incomes`, `GET /v1/incomes/export-xlsx`.
- Nhập file có ít nhất mode `full` và `status-only`; UI nguồn còn khai báo `base-only`/`affiliate-only` trong service.
- Dữ liệu Income: mã đơn, khách hàng, tỉnh, vận chuyển, trạng thái/hoàn-hủy, ngày, kênh và danh sách sản phẩm. Product line giữ giá, chiết khấu platform/seller, nguồn (`affiliate`, `affiliate-ads`, `ads`, `other`), affiliate, nội dung và thùng.
- Index nguồn: `{ channel, date }`.

### 6. KPI tháng và quy cách đóng hộp

- KPI tháng: Live, Shop, % Live Ads và Shop Ads, theo tháng/năm/kênh.
- Quy cách: nhóm `packingType`, nhiều product code, mỗi product có min/max quantity.
- Dashboard/range stats phụ thuộc số KPI và quy cách này; vì vậy đây là scope TikTok, không phải scope kho chung.

## Ads mới: `DailyAdsMetrics`

Đây là hệ Ads được chọn cho Tratos. Một record duy nhất trên `{ channel, date }`.

### Dữ liệu người dùng nhập

- `roiProtect`
- `tinRefundAmount`
- `gmvAds`
- `affiliateCost`
- `totalRevenue`
- `refundCancelRate`

### Dữ liệu API tự tính/lưu

- `actualAdsCost`, `affiliateRefundAmount`, `totalCost`, `adjustedRevenue`, `costAfterRefund`
- `incomeBeforeDiscount`, `incomeAfterDiscount`
- Các tỉ lệ chi phí/doanh thu và `updatedAt`

API giữ lại:

- `POST /v1/dailyads/metrics`
- `GET /v1/dailyads/metrics?date=&channelId=`
- `DELETE /v1/dailyads/metrics/delete`

Quyền FE đang dùng: `api.dailyads.upsert-daily-ads-metrics`, `api.dailyads.delete-daily-ads-metrics`.

### Loại trừ có chủ đích

Không port collection, API hay giao diện `DailyAds` cũ:

- `POST /v1/dailyads`
- `POST /v1/dailyads/update-with-saved-before4pm`
- `GET /v1/dailyads/before4pm`
- `POST /v1/dailyads/simpledailyads`

Lưu ý: UI `Incomes` nguồn hiện còn nút mở `DailyAdsModal` cũ. Khi tách Tratos, nút này phải bị gỡ; đây là khác biệt được chủ dự án duyệt, không phải lỗi sót tính năng.

## API/module backend cần port

API NestJS dùng prefix `/api/v1`; FE hiện gọi base URL + các path `/v1/...`.


| Nhóm                   | Cần port                            | Ghi chú                                                                                                                          |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Auth/User/Permission    | Có                                  | User độc lập, JWT, seed admin, tạo/cấp quyền user.                                                                          |
| Channel                 | Có, đổi tên                      | Lấy CRUD/search từ`livestreamchannels`, chỉ cho TikTok Shop.                                                                   |
| Products                | Có                                  | Cần quyết định thay dependency`StorageItem` bằng schema item tối thiểu của Tratos.                                        |
| Incomes                 | Có                                  | Import, list/filter, delete ngày, export, detail, dashboard/range statistic.                                                     |
| MonthGoals              | Có                                  | Được các tab KPI/dashboard/range stats dùng.                                                                                 |
| PackingRules            | Có                                  | Được tab packing rules và xử lý Income dùng.                                                                               |
| DailyAdsMetrics         | Có                                  | Chỉ 3 API metrics, không port Ads cũ.                                                                                          |
| SystemLogs              | Có, tối thiểu                     | Các controller nguồn ghi audit log. Không cần UI log lúc đầu.                                                              |
| Notifications/WebSocket | Chưa nằm trong baseline bắt buộc | Không thấy TikTok routes cần notification để hoàn tất nghiệp vụ. Chỉ thêm lại nếu có yêu cầu vận hành cụ thể. |

## Dependency/rủi ro đã nhận diện

1. `IncomeModule` nguồn import `PackingRules`, `SystemLogs`, `Notifications`, `DailyAds`, `DailyAdsMetrics`, `LivestreamChannel`. Bản Tratos phải tách dependency để chỉ giữ thứ có trong scope.
2. `Product` nguồn tham chiếu `StorageItem`; copy nguyên schema sẽ kéo module kho không thuộc scope. Bước 5 sẽ quyết định schema sản phẩm/item tối thiểu để công cụ XLSX vẫn hoạt động.
3. Nhiều component đặt tên `LivestreamChannel` và text “kênh livestream”. Tratos phải đổi sang tên TikTok Channel nhưng giữ contract/luồng chọn kênh ở lần đầu.
4. `DailyAdsMetricsManager` hiện gọi API từng ngày trong khoảng lọc. Hành vi được giữ ở lần tương thích; tối ưu batch endpoint là việc sau baseline.
5. `DailyAdsMetrics` tự lưu các giá trị tính toán. Cần giữ nguyên công thức nguồn trong lần tách để dashboard không đổi kết quả.
6. Các title và thương hiệu hiện hiển thị `MyCandy` cần đổi thành Tratos khi tách FE.

* [ ]  Source of truth

- FE routes: `../candy-cal-fe/src/routes/tiktokshop/`
- Shared income workspace: `../candy-cal-fe/src/routes/marketing-storage/incomes/`
- SKU UI: `../candy-cal-fe/src/components/storage/ProductsV2.tsx`
- Ads mới: `../candy-cal-fe/src/components/incomes/DailyAdsMetricsManager.tsx`, `../candy-cal-be/src/dailyads/dailyads.service.ts`
- Domain schemas: `../candy-cal-be/src/database/mongoose/schemas/`

## Tiêu chí hoàn thành bước 1

- [X]  Scope đã được chủ dự án phê duyệt.
- [X]  Xác định route, tab, API và model dữ liệu TikTok cần tách.
- [X]  Phân biệt Ads cũ và Ads mới; đánh dấu Ads cũ là out of scope.
- [X]  Liệt kê dependency không được copy mù quáng.
- [ ]  Rà soát thủ công cùng chủ dự án nếu muốn bổ sung màn hình ngoài danh sách trên.
