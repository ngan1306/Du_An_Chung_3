import { exec, query } from "../server/db/mssql.js";

const findOrCreateCategory = async (name, icon) => {
  const rows = await query("SELECT id FROM categories WHERE name=?", name);
  if (rows.length) return rows[0].id;
  return (
    await exec("INSERT INTO categories (name,icon) VALUES (?,?)", [name, icon])
  ).insertId;
};

const drinks = [
  {
    title: "Trà đào cam sả",
    description: "Trà đào thơm nhẹ, kết hợp cam tươi và sả thanh mát.",
    country: "Việt Nam",
    calories: 120,
    ingredients: [["Trà đen", "200", "ml"], ["Đào ngâm", "3", "miếng"], ["Cam", "1/2", "quả"], ["Sả", "1", "cây"], ["Đá viên", "1", "ly"]],
    steps: ["Ủ trà đen với nước nóng rồi để nguội.", "Dầm nhẹ đào, cam và sả.", "Cho trà cùng đá vào ly, khuấy đều và thưởng thức."],
  },
  {
    title: "Trà sữa trân châu",
    description: "Trà sữa béo thơm với trân châu dai mềm tự nấu.",
    country: "Đài Loan",
    calories: 260,
    ingredients: [["Trà đen", "200", "ml"], ["Sữa tươi", "100", "ml"], ["Sữa đặc", "2", "muỗng"], ["Trân châu", "50", "g"], ["Đá viên", "1", "ly"]],
    steps: ["Luộc trân châu đến khi mềm, vớt ra để ráo.", "Ủ trà đen rồi hòa cùng sữa tươi và sữa đặc.", "Thêm trân châu và đá, khuấy đều."],
  },
  {
    title: "Trà chanh mật ong",
    description: "Trà chanh chua dịu, ngọt thanh với mật ong.",
    country: "Việt Nam",
    calories: 95,
    ingredients: [["Trà xanh", "200", "ml"], ["Chanh", "1", "quả"], ["Mật ong", "2", "muỗng"], ["Đá viên", "1", "ly"]],
    steps: ["Ủ trà xanh và để nguội.", "Vắt chanh, bỏ hạt rồi hòa với mật ong.", "Thêm trà và đá, khuấy đều trước khi uống."],
  },
  {
    title: "Nước ép cam tươi",
    description: "Nước cam tươi nguyên chất, giàu vitamin C.",
    country: "Việt Nam",
    calories: 110,
    ingredients: [["Cam", "3", "quả"], ["Đường", "1", "muỗng"], ["Đá viên", "1", "ly"]],
    steps: ["Rửa sạch cam và cắt đôi.", "Vắt lấy nước, lọc bỏ hạt.", "Thêm đường và đá tùy khẩu vị."],
  },
  {
    title: "Nước ép dưa hấu",
    description: "Nước ép dưa hấu mát lành, ngọt tự nhiên.",
    country: "Việt Nam",
    calories: 85,
    ingredients: [["Dưa hấu", "400", "g"], ["Chanh", "1/2", "quả"], ["Đá viên", "1", "ly"]],
    steps: ["Bỏ hạt dưa hấu và cắt miếng nhỏ.", "Ép dưa hấu lấy nước.", "Vắt thêm chanh, cho đá vào và dùng ngay."],
  },
  {
    title: "Sinh tố bơ",
    description: "Sinh tố bơ sánh mịn, béo thơm và dễ làm.",
    country: "Việt Nam",
    calories: 280,
    ingredients: [["Bơ chín", "1", "quả"], ["Sữa tươi", "150", "ml"], ["Sữa đặc", "2", "muỗng"], ["Đá bào", "1", "ly"]],
    steps: ["Bổ bơ, bỏ hạt và lấy phần thịt.", "Xay bơ với sữa tươi, sữa đặc và đá.", "Rót ra ly, dùng lạnh."],
  },
  {
    title: "Sinh tố dâu tây",
    description: "Sinh tố dâu tây chua ngọt, thơm mát.",
    country: "Việt Nam",
    calories: 170,
    ingredients: [["Dâu tây", "200", "g"], ["Sữa chua", "1", "hũ"], ["Sữa tươi", "100", "ml"], ["Mật ong", "1", "muỗng"], ["Đá viên", "1", "ly"]],
    steps: ["Rửa sạch dâu và bỏ cuống.", "Xay dâu với sữa chua, sữa tươi, mật ong và đá.", "Rót ra ly và thưởng thức."],
  },
  {
    title: "Nước chanh dây",
    description: "Nước chanh dây thơm nồng, chua ngọt cân bằng.",
    country: "Việt Nam",
    calories: 105,
    ingredients: [["Chanh dây", "3", "quả"], ["Đường", "2", "muỗng"], ["Nước lọc", "250", "ml"], ["Đá viên", "1", "ly"]],
    steps: ["Bổ đôi chanh dây, lấy phần ruột.", "Hòa ruột chanh dây với nước và đường.", "Lọc hạt nếu muốn, thêm đá rồi dùng."],
  },
  {
    title: "Sữa đậu nành",
    description: "Sữa đậu nành nhà nấu, thơm béo và bổ dưỡng.",
    country: "Việt Nam",
    calories: 140,
    ingredients: [["Đậu nành khô", "150", "g"], ["Nước lọc", "1", "lít"], ["Lá dứa", "2", "lá"], ["Đường", "2", "muỗng"]],
    steps: ["Ngâm đậu nành qua đêm rồi đãi sạch vỏ.", "Xay đậu với nước, lọc qua vải mịn.", "Đun sữa với lá dứa nhỏ lửa, khuấy đều và thêm đường."],
  },
  {
    title: "Ca cao sữa đá",
    description: "Ca cao đậm vị hòa cùng sữa béo, uống lạnh.",
    country: "Việt Nam",
    calories: 210,
    ingredients: [["Bột ca cao", "2", "muỗng"], ["Sữa đặc", "2", "muỗng"], ["Sữa tươi", "150", "ml"], ["Nước nóng", "30", "ml"], ["Đá viên", "1", "ly"]],
    steps: ["Hòa bột ca cao với nước nóng cho tan.", "Thêm sữa đặc và sữa tươi, khuấy đều.", "Rót vào ly đá và thưởng thức."],
  },
  {
    title: "Bạc xỉu",
    description: "Cà phê sữa nhiều sữa, vị dịu nhẹ và thơm.",
    country: "Việt Nam",
    calories: 190,
    ingredients: [["Cà phê phin", "20", "g"], ["Sữa đặc", "2", "muỗng"], ["Sữa tươi", "100", "ml"], ["Đá viên", "1", "ly"]],
    steps: ["Pha cà phê phin với nước nóng.", "Cho sữa đặc và sữa tươi vào ly.", "Thêm cà phê, đá rồi khuấy đều."],
  },
  {
    title: "Cà phê muối",
    description: "Cà phê đậm đà phủ lớp kem sữa mặn béo.",
    country: "Việt Nam",
    calories: 230,
    ingredients: [["Cà phê phin", "20", "g"], ["Sữa đặc", "2", "muỗng"], ["Kem béo", "50", "ml"], ["Muối", "1/8", "muỗng cà phê"]],
    steps: ["Pha cà phê phin và cho sữa đặc vào ly.", "Đánh kem béo với một chút muối đến khi bông nhẹ.", "Rót lớp kem lên cà phê và dùng nóng hoặc thêm đá."],
  },
  {
    title: "Trà gừng mật ong",
    description: "Trà gừng ấm thơm, làm dịu cổ họng những ngày lạnh.",
    country: "Việt Nam",
    calories: 75,
    ingredients: [["Gừng tươi", "20", "g"], ["Nước nóng", "250", "ml"], ["Mật ong", "1", "muỗng"], ["Chanh", "1/4", "quả"]],
    steps: ["Gừng rửa sạch, thái lát mỏng.", "Hãm gừng trong nước nóng khoảng 5 phút.", "Để trà bớt nóng rồi thêm mật ong và chanh."],
  },
  {
    title: "Matcha latte",
    description: "Matcha thơm dịu hòa cùng sữa tươi béo nhẹ.",
    country: "Nhật Bản",
    calories: 160,
    ingredients: [["Bột matcha", "2", "g"], ["Nước nóng", "40", "ml"], ["Sữa tươi", "200", "ml"], ["Mật ong", "1", "muỗng"]],
    steps: ["Rây matcha vào chén và hòa với nước nóng.", "Đánh tan matcha đến khi mịn.", "Làm nóng hoặc đánh bọt sữa, rót cùng matcha và thêm mật ong."],
  },
  {
    title: "Nước dừa tươi",
    description: "Nước dừa tươi mát, thanh ngọt tự nhiên.",
    country: "Việt Nam",
    calories: 90,
    ingredients: [["Dừa tươi", "1", "quả"], ["Đá viên", "tùy thích", ""]],
    steps: ["Chặt dừa cẩn thận và rót nước ra ly.", "Thêm đá nếu thích uống lạnh.", "Dùng kèm cơm dừa tươi."],
  },
  {
    title: "Soda chanh bạc hà",
    description: "Soda sủi bọt với chanh tươi và lá bạc hà.",
    country: "Ý",
    calories: 100,
    ingredients: [["Soda", "200", "ml"], ["Chanh", "1/2", "quả"], ["Lá bạc hà", "6", "lá"], ["Đường", "1", "muỗng"], ["Đá viên", "1", "ly"]],
    steps: ["Dầm nhẹ bạc hà với đường và nước cốt chanh.", "Cho đá vào ly rồi rót soda.", "Khuấy nhẹ, trang trí với lát chanh."],
  },
  {
    title: "Sữa bắp",
    description: "Sữa bắp thơm ngọt, nấu cùng lá dứa.",
    country: "Việt Nam",
    calories: 180,
    ingredients: [["Bắp ngọt", "2", "trái"], ["Sữa tươi", "300", "ml"], ["Nước lọc", "500", "ml"], ["Lá dứa", "2", "lá"], ["Đường", "2", "muỗng"]],
    steps: ["Tách hạt bắp và luộc với nước đến khi mềm.", "Xay bắp với nước luộc rồi lọc bỏ bã.", "Đun phần sữa bắp với sữa tươi, lá dứa và đường."],
  },
  {
    title: "Trà vải",
    description: "Trà vải thơm ngọt, uống lạnh rất dễ chịu.",
    country: "Việt Nam",
    calories: 130,
    ingredients: [["Trà đen", "200", "ml"], ["Vải ngâm", "4", "quả"], ["Nước vải", "2", "muỗng"], ["Chanh", "1/4", "quả"], ["Đá viên", "1", "ly"]],
    steps: ["Ủ trà đen rồi để nguội.", "Cho vải và nước vải vào ly.", "Thêm trà, nước cốt chanh và đá, khuấy đều."],
  },
];

const drinkImages = {
  "Trà đào cam sả": "/img/drink-peach-tea.jpg",
  "Trà sữa trân châu": "/img/drink-bubble-tea.jpg",
  "Trà chanh mật ong": "/img/drink-lemon-tea.jpg",
  "Nước ép cam tươi": "/img/drink-orange-juice.jpg",
  "Nước ép dưa hấu": "/img/drink-watermelon-juice.jpg",
  "Sinh tố bơ": "/img/drink-avocado-smoothie.jpg",
  "Sinh tố dâu tây": "/img/drink-strawberry-smoothie.jpg",
  "Nước chanh dây": "/img/drink-passion-fruit.jpg",
  "Sữa đậu nành": "/img/drink-soy-milk.jpg",
  "Ca cao sữa đá": "/img/drink-cocoa.jpg",
  "Bạc xỉu": "/img/drink-vietnamese-coffee.jpg",
  "Cà phê muối": "/img/coffee.jpg",
  "Trà gừng mật ong": "/img/drink-ginger-tea.jpg",
  "Matcha latte": "/img/drink-matcha-latte.jpg",
  "Nước dừa tươi": "/img/drink-coconut-water.jpg",
  "Soda chanh bạc hà": "/img/drink-mojito.jpg",
  "Sữa bắp": "/img/drink-soy-milk.jpg",
  "Trà vải": "/img/drink-lychee-tea.jpg",
  "Cà phê sữa đá": "/img/drink-vietnamese-coffee.jpg",
  "Sinh tố xoài": "/img/smoothie.jpg",
};

async function main() {
  const drinkCategoryId = await findOrCreateCategory("Đồ uống", "🧋");
  const snackCategoryId = await findOrCreateCategory("Món ăn vặt", "🍟");

  await exec(
    "UPDATE recipes SET category_id=? WHERE title=? AND category_id=?",
    [snackCategoryId, "Phô mai que", drinkCategoryId],
  );

  for (const [title, image] of Object.entries(drinkImages)) {
    await exec("UPDATE recipes SET image=? WHERE title=? AND category_id=?", [
      image,
      title,
      drinkCategoryId,
    ]);
  }

  let count = Number(
    (await query("SELECT COUNT(*) AS count FROM recipes WHERE category_id=?", drinkCategoryId))[0].count,
  );
  if (count > 20) {
    throw new Error(`Danh mục Đồ uống đã có ${count} món; không xóa món nào.`);
  }

  const existing = new Set(
    (await query("SELECT title FROM recipes")).map((recipe) => recipe.title),
  );
  const user = await query("SELECT TOP 1 id FROM users WHERE role<>'admin' ORDER BY id");
  if (!user.length) throw new Error("Không tìm thấy tài khoản người dùng để tạo món.");

  for (const drink of drinks) {
    if (count >= 20) break;
    if (existing.has(drink.title)) continue;

    const image = drinkImages[drink.title];
    if (!image) throw new Error(`Chưa khai báo ảnh cho món ${drink.title}.`);

    const recipeId = (
      await exec(
        `INSERT INTO recipes (user_id,title,description,image,video_url,category_id,country,prep_minutes,cook_minutes,servings,difficulty,calories,protein,carbs,fat,diet,is_public,views)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          user[0].id,
          drink.title,
          drink.description,
          image,
          "",
          drinkCategoryId,
          drink.country,
          10,
          0,
          2,
          "Dễ",
          drink.calories,
          3,
          25,
          4,
          "",
          1,
          0,
        ],
      )
    ).insertId;

    for (const [name, quantity, unit] of drink.ingredients) {
      await exec(
        "INSERT INTO recipe_ingredients (recipe_id,name,quantity,unit) VALUES (?,?,?,?)",
        [recipeId, name, quantity, unit],
      );
    }

    for (let index = 0; index < drink.steps.length; index += 1) {
      await exec(
        "INSERT INTO recipe_steps (recipe_id,step_order,text) VALUES (?,?,?)",
        [recipeId, index + 1, drink.steps[index]],
      );
    }

    existing.add(drink.title);
    count += 1;
    console.log(`+ ${drink.title}`);
  }

  if (count !== 20) {
    throw new Error(`Đã có ${count}/20 món đồ uống; còn thiếu dữ liệu để bổ sung.`);
  }
  console.log("Danh mục Đồ uống hiện có đúng 20 món.");
}

main().catch((error) => {
  console.error("Không thể bổ sung đồ uống:", error.message);
  process.exitCode = 1;
});
