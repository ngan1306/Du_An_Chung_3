# 🍲 Recipe App — Ứng dụng quản lý & chia sẻ công thức nấu ăn

Full-stack app: **Node.js + Express + SQL Server** (kết nối qua ODBC, **Windows Authentication**) phía server, **SPA HTML/CSS/JS** phía client, upload ảnh bằng **multer**, JWT auth.

## Kết nối SQL Server của bạn

Cấu hình tại `server/db/config.js`:

```js
module.exports = {
  DB_CONFIG: {
    server: process.env.MSSQL_SERVER || "localhost,1433", // hoặc "MÁY_BẠN\\SQLEXPRESS"
    database: process.env.MSSQL_DB || "RecipeAppDB",
    driver: "{ODBC Driver 17 for SQL Server}",
  },
};
```

- Dùng **Windows Authentication** (đúng như khi bạn đăng nhập SSMS bằng `Windows Authentication` trên `DESKTOP-UQULP3N\SQLEXPRESS`).
- Nếu muốn dùng SQL login (sa/...): sửa chuỗi kết nối trong `server/db/mssql.js`, thay `Trusted_Connection=Yes` bằng `UID=<user>;PWD=<pass>;`.

## Chạy dự án

```powershell
cd recipe-app
npm install

# 1. Tao database + schema (chi lan dau, hoac muon reset)
sqlcmd -S ".\SQLEXPRESS" -E -i sql\schema.sql

# 2. Nap du lieu mau (chi lan dau)
node server/db/seed-mssql.js

# Tao/bo sung du 50 cong thuc mau (khong xoa du lieu dang co)
node add-dishes.js

# (muon reset du lieu tu dau:)
node server/db/reset-mssql.js
node server/db/seed-mssql.js
node add-dishes.js

# 3. Chay server
npm start   # -> http://localhost:3000
```

Để bổ sung công thức cho đến khi danh mục **Đồ uống** có đủ 20 món, chạy:

```powershell
npm run seed:drinks
```

Lệnh này không xóa dữ liệu hiện có và có thể chạy lại an toàn; món ăn vặt bị xếp nhầm vào danh mục đồ uống sẽ được chuyển sang **Món ăn vặt**.

Để bổ sung công thức cho đến khi danh mục **Món ăn vặt** có đủ 20 món, chạy:

```powershell
npm run seed:snacks
```

Lệnh này không xóa dữ liệu hiện có và có thể chạy lại an toàn. Ảnh món ăn vặt được lưu cục bộ trong `public/img/`; nguồn và giấy phép được ghi trong `IMAGE_CREDITS.md`.

Thêm **600 món mới** (không tính những món đã có) và ảnh chụp thật:

```powershell
npm run fetch:recipes:600
npm run seed:recipes:600
```

Lệnh đầu lấy 600 công thức khác nhau cùng ảnh JPG và lưu cục bộ trong `public/img/`. Lệnh sau thêm chúng vào SQL Server, không xóa dữ liệu hiện có và dừng nếu phát hiện tên món trùng. Có thể chạy lại lệnh tải ảnh để tiếp tục nếu việc tải bị gián đoạn.

Nếu muốn tải lại ảnh chụp và dữ liệu nguồn cho 30 công thức bổ sung:

```powershell
npm run fetch:sample-recipes
```

Sau đó chạy `node add-dishes.js` để nạp công thức vào SQL Server. Trình nạp bỏ qua món đã có và chỉ bổ sung tối đa đến 50 công thức; không xóa công thức hay dữ liệu người dùng hiện có.

## Tài khoản demo

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| `admin` | `admin123` | Admin |
| `anh` (anh@recipe.app) | `123456` | User |
| `binh` | `123456` | User |

## Cơ sở dữ liệu (SQL Server: RecipeAppDB)

20 bảng: `users, password_resets, categories, ingredients, recipes, recipe_ingredients, recipe_steps, favorites, collections, collection_items, ratings, comment_likes, reports, follows, posts, post_likes, meal_plans, shopping_items, notifications, activity_logs`.

Xem dữ liệu trong SSMS: kết nối `DESKTOP-UQULP3N\SQLEXPRESS` → database `RecipeAppDB`.

## Chức năng đã triển khai (theo bảng đặc tả)

- **Tài khoản**: đăng ký, đăng nhập/đăng xuất, quên & đặt lại mật khẩu, đăng nhập Google (demo), đổi mật khẩu, hồ sơ + ảnh đại diện, xóa tài khoản, xác thực email (mặc định verified).
- **Trang chủ**: món nổi bật, mới nhất, đánh giá cao, gợi ý theo sở thích (prefs), danh mục.
- **Dữ liệu mẫu**: tổng cộng 50 món ăn kèm ảnh chụp thật; trang tìm kiếm có phân trang để xem hết danh sách.
- **Công thức**: xem danh sách/chi tiết, thêm/sửa/xóa (chủ sở hữu), tải ảnh/video, nguyên liệu + số lượng + đơn vị, các bước chế biến, thời gian prep/cook, khẩu phần, độ khó, dinh dưỡng (calo/protein/carb/fat), công khai/riêng tư.
- **Tìm kiếm**: theo tên, nguyên liệu; lọc danh mục/quốc gia/thời gian/độ khó/calo/chế độ ăn; sắp xếp theo lượt xem, đánh giá, thời gian.
- **Yêu thích**: thêm/bỏ yêu thích, bộ sưu tập (tạo, tìm và chọn công thức để thêm, chia sẻ qua link token), lịch sử công thức đã xem.
- **Đánh giá & bình luận**: 1–5 sao, bình luận, trả lời, thích bình luận, đăng ảnh món đã nấu, báo cáo vi phạm.
- **Cộng đồng**: theo dõi/hủy theo dõi, trang cá nhân đầu bếp, đăng bài + ảnh, thích bài viết, feed từ người đang theo dõi, đính kèm công thức.
- **Meal Planner**: kế hoạch theo tuần, sáng/trưa/tối, chọn công thức, đánh dấu hoàn thành, tổng hợp dinh dưỡng.
- **Shopping List**: tạo tự động từ công thức (toàn bộ hoặc chỉ phần thiếu với AI), thêm/sửa/xóa, đánh dấu đã mua.
- **AI Recipe**: gợi ý món từ nguyên liệu có sẵn (chấm điểm khớp nguyên liệu), thực đơn theo khẩu vị/calo/thời gian, đề xuất nguyên liệu còn thiếu.
- **Cooking Mode**: hướng dẫn từng bước, đánh dấu hoàn thành, đồng hồ đếm ngược, phóng to chữ.
- **Thông báo**: lượt thích, bình luận/đánh giá, người theo dõi mới, thông báo hệ thống từ admin.
- **Quản trị**: dashboard thống kê, quản lý người dùng (khóa/mở khóa, phân quyền user/moderator/admin), duyệt/từ chối công thức, quản lý danh mục & nguyên liệu, quản lý bình luận, kiểm duyệt báo cáo, gửi thông báo toàn hệ thống, nhật ký hoạt động, thống kê lượt xem/đánh giá.

## Ảnh món ăn

Ảnh công thức mẫu dùng ảnh chụp lưu cục bộ trong `public/img/`; nguồn ảnh và thông tin từng công thức bổ sung được lưu trong `server/db/sample-recipes-600.json` và ghi tại [IMAGE_CREDITS.md](./IMAGE_CREDITS.md).

## Cấu trúc

```
recipe-app/
├─ sql/
│  └─ schema.sql         # Script tao RecipeAppDB + 20 bang (chay voi sqlcmd)
├─ server/
│  ├─ index.js           # Express app + /api/home + upload
│  ├─ middleware.js      # JWT auth, phân quyền, log, notify
│  ├─ db/
│  │  ├─ config.js       # Cấu hình SQL Server (server, database, driver)
│  │  ├─ mssql.js        # Lớp kết nối SQL Server (query/exec/get)
│  │  ├─ database.js     # Shim giữ tương thích API cũ
│  │  ├─ sample-recipes-30.json # 30 công thức và nguồn ảnh chụp mẫu
│  │  ├─ seed-mssql.js   # Nạp dữ liệu mẫu
│  │  └─ reset-mssql.js  # Xóa sạch dữ liệu (reset)
│  └─ routes/
│     ├─ auth.js         # Tài khoản
│     ├─ recipes.js      # Công thức, xã hội, planner, shopping, thông báo
│     ├─ admin.js        # Quản trị
│     └─ ai.js           # AI gợi ý
├─ public/
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/ (api.js, ui.js, pages.js, app.js)
│  └─ img/ (ảnh chụp món ăn JPG và ảnh đại diện)
├─ scripts/
│  └─ fetch-sample-recipes.mjs # Tải ảnh thật và công thức mẫu
└─ uploads/              # Ảnh người dùng tải lên
```
