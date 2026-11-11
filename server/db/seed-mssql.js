// Seed du lieu mau vao SQL Server (RecipeAppDB)
const bcrypt = require("bcryptjs");
const { query, exec } = require("./mssql");

(async () => {
  const count = (await query("SELECT COUNT(*) c FROM users"))[0].c;
  if (count > 0) {
    console.log("Da co du lieu, bo qua seed.");
    process.exit(0);
  }

  const hash = (p) => bcrypt.hashSync(p, 10);
  const insUser = async (u, e, pw, dn, bio, role, prefs) =>
    (
      await exec(
        "INSERT INTO users (username,email,password_hash,display_name,bio,role,prefs) VALUES (?,?,?,?,?,?,?)",
        [u, e, hash(pw), dn, bio, role, prefs],
      )
    ).insertId;

  const idAdmin = await insUser(
    "admin",
    "admin@recipe.app",
    "admin123",
    "Quản trị viên",
    "Quản trị hệ thống",
    "admin",
    "",
  );
  const idAnh = await insUser(
    "anh",
    "anh@recipe.app",
    "123456",
    "Anh Đầu Bếp",
    "Yêu nấu ăn",
    "user",
    "chay,món nhật",
  );
  const idBinh = await insUser(
    "binh",
    "binh@recipe.app",
    "123456",
    "Bình Foodie",
    "Săn món ngon",
    "user",
    "",
  );

  const catIds = {};
  for (const [n, i] of [
    ["Món chính", "🍛"],
    ["Món chay", "🥗"],
    ["Món tráng miệng", "🍰"],
    ["Món Nhật", "🍣"],
    ["Món Việt", "🍜"],
    ["Đồ uống", "🧋"],
  ])
    catIds[n] = (
      await exec("INSERT INTO categories (name,icon) VALUES (?,?)", [n, i])
    ).insertId;

  for (const n of [
    "Thịt gà",
    "Thịt bò",
    "Tôm",
    "Cá hồi",
    "Trứng",
    "Cà chua",
    "Rau cải",
    "Tỏi",
    "Hành tây",
    "Gạo",
    "Sữa",
    "Bơ",
    "Ớt",
    "Nấm",
    "Đậu hũ",
  ])
    await exec("INSERT INTO ingredients (name) VALUES (?)", [n]);

  const r = async (
    uid,
    title,
    desc,
    img,
    cat,
    country,
    prep,
    cook,
    serv,
    diff,
    cal,
    p,
    c,
    f,
    diet,
    views,
  ) =>
    (
      await exec(
        `INSERT INTO recipes (user_id,title,description,image,video_url,category_id,country,prep_minutes,cook_minutes,servings,difficulty,calories,protein,carbs,fat,diet,is_public,views)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid,
          title,
          desc,
          img,
          '',
          catIds[cat],
          country,
          prep,
          cook,
          serv,
          diff,
          cal,
          p,
          c,
          f,
          diet,
          1,
          views,
        ],
      )
    ).insertId;

  const r1 = await r(
    idAnh,
    "Phở bò Hà Nội",
    "Phở bò truyền thống với nước dùng trong veo, gừng, quế, hồi và thịt bò tươi thái mỏng.",
    "/img/pho.jpg",
    "Món Việt",
    "Việt Nam",
    30,
    60,
    4,
    "Trung bình",
    420,
    28,
    45,
    12,
    "",
    523,
  );
  const r2 = await r(
    idAnh,
    "Sushi cá hồi",
    "Sushi roll cá hồi Na Uy kèm wasabi và gừng ngâm.",
    "/img/sushi.jpg",
    "Món Nhật",
    "Nhật Bản",
    25,
    15,
    2,
    "Khó",
    380,
    22,
    50,
    9,
    "",
    341,
  );
  const r3 = await r(
    idAnh,
    "Salad bơ mè rang",
    "Salad tươi mát với bơ, rau củ và mè rang thơm lừng.",
    "/img/salad.jpg",
    "Món chay",
    "Việt Nam",
    10,
    5,
    2,
    "Dễ",
    210,
    6,
    18,
    14,
    "Chay",
    189,
  );
  const r4 = await r(
    idBinh,
    "Gà nướng mật ong",
    "Đùi gà ướp mật ong tỏi ớt, nướng vàng giòn.",
    "/img/chicken.jpg",
    "Món chính",
    "Việt Nam",
    20,
    40,
    3,
    "Dễ",
    520,
    38,
    32,
    22,
    "",
    402,
  );
  const r5 = await r(
    idBinh,
    "Tiramisu Ý",
    "Bánh tiramisu mascarpone cà phê espresso chuẩn vị Ý.",
    "/img/tiramisu.jpg",
    "Món tráng miệng",
    "Ý",
    30,
    10,
    6,
    "Khó",
    450,
    8,
    40,
    28,
    "",
    277,
  );
  const r6 = await r(
    idBinh,
    "Canh chua cá",
    "Canh chua thanh mát với cá, đậu bắp, giá đỗ.",
    "/img/soup.jpg",
    "Món chính",
    "Việt Nam",
    15,
    25,
    4,
    "Trung bình",
    260,
    24,
    15,
    8,
    "",
    156,
  );

  const ri = (rid, arr) =>
    Promise.all(
      arr.map((x) =>
        exec(
          "INSERT INTO recipe_ingredients (recipe_id,name,quantity,unit) VALUES (?,?,?,?)",
          [rid, x[0], x[1], x[2]],
        ),
      ),
    );
  await ri(r1, [
    ["Bánh phở", "500", "g"],
    ["Thịt bò", "300", "g"],
    ["Xương bò", "1", "kg"],
    ["Hành lá", "50", "g"],
  ]);
  await ri(r2, [
    ["Cơm gạo Nhật", "300", "g"],
    ["Cá hồi", "200", "g"],
    ["Rong biển", "5", "tờ"],
    ["Wasabi", "", ""],
  ]);
  await ri(r3, [
    ["Bơ", "2", "quả"],
    ["Rau xà lách", "100", "g"],
    ["Mè rang", "2", "muỗng"],
    ["Dầu ô liu", "1", "muỗng"],
  ]);
  await ri(r4, [
    ["Đùi gà", "4", "cái"],
    ["Mật ong", "3", "muỗng"],
    ["Tỏi", "4", "tép"],
  ]);
  await ri(r5, [
    ["Bánh ladyfinger", "200", "g"],
    ["Mascarpone", "250", "g"],
    ["Cà phê espresso", "150", "ml"],
  ]);
  await ri(r6, [
    ["Cá linh", "500", "g"],
    ["Đậu bắp", "100", "g"],
    ["Me", "2", "muỗng"],
  ]);

  const st = (rid, arr) =>
    Promise.all(
      arr.map((t, i) =>
        exec(
          "INSERT INTO recipe_steps (recipe_id,step_order,text) VALUES (?,?,?)",
          [rid, i + 1, t],
        ),
      ),
    );
  await st(r1, [
    "Ninh xương 3 tiếng để lấy nước dùng trong.",
    "Thái thịt bò mỏng, trụng sơ.",
    "Chần bánh phở, chan nước dùng.",
    "Bày ra tô với hành lá, rau thơm.",
  ]);
  await st(r2, [
    "Nấu cơm sushi, trộn giấm.",
    "Thái cá hồi sợi dài.",
    "Cuộn cơm với cá và rong biển.",
    "Cắt miếng vừa ăn, ăn kèm wasabi.",
  ]);
  await st(r3, [
    "Rửa rau, thái nhỏ.",
    "Xay nhuyễn bơ với dầu ô liu.",
    "Trộn đều mọi thứ, rắc mè rang.",
  ]);
  await st(r4, [
    "Ướp gà với mật ong, tỏi, tiêu 30 phút.",
    "Nướng 200°C trong 35 phút.",
    "Phết thêm mật ong, nướng 5 phút cuối.",
  ]);
  await st(r5, [
    "Pha cà phê espresso để nguội.",
    "Đánh mascarpone với kem và đường.",
    "Xếp tầng bánh, cà phê, kem.",
    "Lạnh ngăn mát 4 giờ trước khi ăn.",
  ]);
  await st(r6, [
    "Nấu me với nước, lọc cặn.",
    "Nêm gia vị chua ngọt.",
    "Cho cá, đậu bắp vào nấu 10 phút.",
    "Thêm giá đỗ, ngò gai, ăn nóng.",
  ]);

  await exec("INSERT INTO posts (user_id,content,likes) VALUES (?,?,?)", [
    idAnh,
    "Hôm nay làm xong đĩa sushi đầu tiên, ai muốn công thức chi tiết không? 🍣",
    12,
  ]);
  await exec("INSERT INTO posts (user_id,content,likes) VALUES (?,?,?)", [
    idBinh,
    "Tìm quán nào bán phở chuẩn vị Hà Nội, ai biết chỉ mình với!",
    5,
  ]);
  await exec(
    "INSERT INTO ratings (user_id,recipe_id,stars,comment) VALUES (?,?,?,?)",
    [idBinh, r1, 5, "Nước dùng đậm đà, chuẩn vị Hà Nội!"],
  );
  await exec(
    "INSERT INTO ratings (user_id,recipe_id,stars,comment) VALUES (?,?,?,?)",
    [idAnh, r4, 4, "Gà mềm, mật ong thơm."],
  );

  console.log(
    "Seed SQL Server xong! Tai khoan: admin/admin123 - anh/123456 - binh/123456",
  );
  process.exit(0);
})().catch((e) => {
  console.error("SEED ERR:", e.message);
  process.exit(1);
});
