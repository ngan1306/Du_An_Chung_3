import { exec, query } from "../server/db/mssql.js";

const snacks = [
  {
    title: "Khoai tây chiên giòn",
    description: "Khoai tây chiên vàng ruộm, giòn bên ngoài và mềm bên trong.",
    image: "/img/snack-fries.jpg",
    calories: 310,
    ingredients: [["Khoai tây", "3", "củ"], ["Dầu ăn", "500", "ml"], ["Muối", "1/2", "muỗng cà phê"]],
    steps: ["Gọt vỏ khoai, thái thanh đều và ngâm nước lạnh 15 phút.", "Thấm khoai thật khô rồi chiên sơ ở lửa vừa.", "Chiên lần hai đến khi vàng giòn, để ráo dầu và rắc muối."],
  },
  {
    title: "Gà viên chiên giòn",
    description: "Gà viên tẩm bột chiên xù, thơm ngon và dễ ăn.",
    image: "/img/snack-nuggets.jpg",
    calories: 290,
    ingredients: [["Thịt gà xay", "300", "g"], ["Trứng gà", "1", "quả"], ["Bột chiên xù", "100", "g"], ["Bột mì", "50", "g"], ["Muối", "1/3", "muỗng cà phê"]],
    steps: ["Trộn thịt gà xay với muối, vo thành viên nhỏ.", "Lăn viên gà qua bột mì, trứng đánh tan rồi bột chiên xù.", "Chiên ngập dầu ở lửa vừa đến khi chín vàng."],
  },
  {
    title: "Chả giò tôm thịt",
    description: "Chả giò cuốn tôm thịt với lớp vỏ giòn rụm, ăn kèm rau sống.",
    image: "/img/snack-spring-rolls.jpg",
    calories: 250,
    ingredients: [["Thịt heo xay", "200", "g"], ["Tôm bóc vỏ", "100", "g"], ["Miến khô", "30", "g"], ["Bánh tráng cuốn", "12", "cái"], ["Cà rốt", "1/2", "củ"]],
    steps: ["Ngâm mềm miến, cắt nhỏ; băm tôm và trộn cùng thịt, cà rốt.", "Cho nhân vào bánh tráng, gấp hai mép và cuốn chặt.", "Chiên chả giò lửa vừa đến khi vàng đều, dùng nóng."],
  },
  {
    title: "Bánh tráng nướng",
    description: "Bánh tráng nướng giòn với trứng, hành lá và tôm khô.",
    image: "/img/snack-banh-trang-nuong.jpg",
    calories: 220,
    ingredients: [["Bánh tráng", "2", "cái"], ["Trứng cút", "4", "quả"], ["Tôm khô", "15", "g"], ["Hành lá", "2", "nhánh"], ["Tương ớt", "1", "muỗng"]],
    steps: ["Rửa tôm khô, ngâm mềm rồi giã nhỏ; thái nhỏ hành lá.", "Đặt bánh tráng lên chảo nóng, đập trứng cút và dàn đều.", "Thêm tôm, hành, nướng đến khi bánh giòn rồi rưới tương ớt."],
  },
  {
    title: "Bánh chuối chiên",
    description: "Chuối chín bọc lớp bột mỏng, chiên vàng thơm ngọt.",
    image: "/img/snack-banana-fritters.jpg",
    calories: 230,
    ingredients: [["Chuối sứ chín", "4", "quả"], ["Bột gạo", "100", "g"], ["Bột mì", "50", "g"], ["Nước cốt dừa", "80", "ml"], ["Đường", "1", "muỗng"]],
    steps: ["Trộn bột gạo, bột mì, nước cốt dừa và đường thành hỗn hợp sánh.", "Ép dẹt chuối, nhúng qua bột.", "Chiên chuối ngập dầu đến khi vàng đều, vớt ra để ráo."],
  },
  {
    title: "Bắp rang bơ",
    description: "Bắp rang giòn thơm mùi bơ, món ăn vặt quen thuộc khi xem phim.",
    image: "/img/snack-popcorn.jpg",
    calories: 180,
    ingredients: [["Bắp nổ khô", "100", "g"], ["Bơ lạt", "25", "g"], ["Đường", "1", "muỗng"], ["Muối", "1", "nhúm"]],
    steps: ["Đun chảy bơ trong nồi đáy dày.", "Cho bắp vào, đậy nắp và lắc nồi nhẹ khi bắp bắt đầu nổ.", "Khi tiếng nổ thưa dần, tắt bếp rồi trộn đường và muối."],
  },
  {
    title: "Khoai lang chiên",
    description: "Khoai lang chiên vàng, thơm ngọt tự nhiên và giòn cạnh.",
    image: "/img/snack-sweet-potato-fries.jpg",
    calories: 260,
    ingredients: [["Khoai lang", "500", "g"], ["Bột bắp", "2", "muỗng"], ["Dầu ăn", "400", "ml"], ["Muối", "1/3", "muỗng cà phê"]],
    steps: ["Gọt vỏ khoai, thái que và ngâm nước lạnh 10 phút.", "Để khoai ráo, áo nhẹ với bột bắp.", "Chiên vàng giòn, vớt ra và nêm chút muối."],
  },
  {
    title: "Cánh gà chiên nước mắm",
    description: "Cánh gà chiên giòn áo sốt nước mắm mặn ngọt đậm đà.",
    image: "/img/snack-wings.jpg",
    calories: 320,
    ingredients: [["Cánh gà", "500", "g"], ["Nước mắm", "2", "muỗng"], ["Đường", "1", "muỗng"], ["Tỏi", "3", "tép"], ["Bột bắp", "2", "muỗng"]],
    steps: ["Rửa sạch cánh gà, để ráo và áo một lớp bột bắp mỏng.", "Chiên gà đến khi chín vàng, vớt ra để ráo dầu.", "Phi thơm tỏi, thêm nước mắm và đường, đảo gà cùng sốt cho áo đều."],
  },
  {
    title: "Bắp chiên giòn",
    description: "Hạt bắp ngọt trộn bột, chiên thành món ăn vặt giòn thơm.",
    image: "/img/snack-corn-fritters.jpg",
    calories: 210,
    ingredients: [["Bắp ngọt", "2", "trái"], ["Bột chiên giòn", "80", "g"], ["Trứng gà", "1", "quả"], ["Hành lá", "2", "nhánh"], ["Dầu ăn", "300", "ml"]],
    steps: ["Tách hạt bắp, trộn với bột, trứng và hành lá thái nhỏ.", "Múc từng muỗng hỗn hợp vào chảo dầu nóng.", "Chiên vàng hai mặt rồi vớt ra để ráo dầu."],
  },
  {
    title: "Bánh ngô giòn phủ phô mai",
    description: "Bánh ngô giòn phủ phô mai, cà chua và sốt bơ.",
    image: "/img/snack-nachos.jpg",
    calories: 280,
    ingredients: [["Bánh ngô giòn", "150", "g"], ["Phô mai cheddar", "80", "g"], ["Cà chua", "1", "quả"], ["Bơ", "1/2", "quả"], ["Chanh", "1/2", "quả"]],
    steps: ["Cắt nhỏ cà chua, nghiền bơ với nước cốt chanh.", "Xếp bánh ngô giòn lên khay, rắc phô mai và làm nóng đến khi phô mai chảy.", "Thêm cà chua và sốt bơ rồi dùng ngay."],
  },
  {
    title: "Bánh kếp chuối mini",
    description: "Bánh kếp nhỏ mềm xốp với chuối chín và mật ong.",
    image: "/img/snack-pancakes.jpg",
    calories: 240,
    ingredients: [["Bột mì", "120", "g"], ["Chuối chín", "1", "quả"], ["Trứng gà", "1", "quả"], ["Sữa tươi", "100", "ml"], ["Mật ong", "1", "muỗng"]],
    steps: ["Nghiền chuối, trộn với trứng, sữa và bột mì đến khi mịn.", "Múc bột thành từng bánh nhỏ lên chảo chống dính.", "Lật bánh khi mặt bánh nổi bọt, nấu chín rồi rưới mật ong."],
  },
  {
    title: "Bánh vòng chiên phủ đường",
    description: "Bánh vòng chiên mềm xốp, phủ một lớp đường ngọt nhẹ.",
    image: "/img/snack-donut.jpg",
    calories: 290,
    ingredients: [["Bột mì", "250", "g"], ["Men nở", "5", "g"], ["Sữa tươi", "120", "ml"], ["Trứng gà", "1", "quả"], ["Đường", "40", "g"], ["Bơ lạt", "30", "g"]],
    steps: ["Trộn bột mì, men, sữa, trứng và đường; nhào cùng bơ đến khi mịn.", "Ủ bột khoảng 1 giờ, cán dày rồi cắt tạo hình vòng.", "Chiên bánh ở lửa vừa đến khi vàng, để nguội bớt rồi lăn qua đường."],
  },
  {
    title: "Há cảo tôm hấp",
    description: "Há cảo nhân tôm thịt hấp nóng, mềm thơm và vừa miệng.",
    image: "/img/snack-dumplings.jpg",
    calories: 190,
    ingredients: [["Tôm bóc vỏ", "150", "g"], ["Thịt heo xay", "100", "g"], ["Vỏ há cảo", "12", "cái"], ["Hành lá", "2", "nhánh"], ["Nước tương", "1", "muỗng"]],
    steps: ["Băm tôm, trộn với thịt xay, hành lá và một ít nước tương.", "Cho nhân vào giữa vỏ há cảo, làm ẩm mép và gấp kín.", "Hấp há cảo 8-10 phút đến khi nhân chín."],
  },
  {
    title: "Cá viên chiên",
    description: "Cá viên chiên nóng giòn, dùng kèm tương ớt hoặc sốt mayonnaise.",
    image: "/img/snack-street-food.jpg",
    calories: 230,
    ingredients: [["Cá viên", "300", "g"], ["Dầu ăn", "300", "ml"], ["Tương ớt", "2", "muỗng"], ["Mayonnaise", "1", "muỗng"]],
    steps: ["Rã đông cá viên và thấm khô.", "Chiên cá viên trong dầu nóng đến khi phồng và vàng nhẹ.", "Vớt ra để ráo, dùng nóng với tương ớt và mayonnaise."],
  },
  {
    title: "Bánh gối nhân thịt",
    description: "Bánh gối nhân thịt, miến và mộc nhĩ chiên vàng giòn.",
    image: "/img/snack-samosa.jpg",
    calories: 270,
    ingredients: [["Vỏ bánh gối", "10", "cái"], ["Thịt heo xay", "200", "g"], ["Miến khô", "20", "g"], ["Mộc nhĩ", "10", "g"], ["Trứng cút", "10", "quả"]],
    steps: ["Ngâm mềm miến, mộc nhĩ rồi thái nhỏ và trộn cùng thịt.", "Cho nhân và một quả trứng cút vào vỏ, gấp mép bánh kín.", "Chiên bánh ngập dầu đến khi vàng giòn."],
  },
  {
    title: "Hành tây chiên giòn",
    description: "Khoanh hành tây phủ bột chiên giòn, thơm ngọt và giòn rụm.",
    image: "/img/snack-onion-rings.jpg",
    calories: 220,
    ingredients: [["Hành tây", "2", "củ"], ["Bột mì", "80", "g"], ["Trứng gà", "1", "quả"], ["Bột chiên xù", "100", "g"], ["Dầu ăn", "400", "ml"]],
    steps: ["Thái hành tây thành khoanh dày khoảng 1 cm.", "Lăn từng khoanh qua bột mì, trứng đánh tan rồi bột chiên xù.", "Chiên vàng giòn và để ráo dầu trước khi dùng."],
  },
  {
    title: "Bánh trứng tổ ong mini",
    description: "Bánh trứng tổ ong mini thơm béo, giòn nhẹ bên ngoài.",
    image: "/img/snack-egg-waffles.jpg",
    calories: 230,
    ingredients: [["Bột mì", "150", "g"], ["Trứng gà", "2", "quả"], ["Sữa tươi", "120", "ml"], ["Đường", "30", "g"], ["Bơ lạt", "25", "g"]],
    steps: ["Đánh trứng cùng đường, thêm sữa và bơ chảy.", "Rây bột mì vào, trộn nhẹ đến khi hỗn hợp mịn.", "Nướng từng phần bột trong khuôn bánh đến khi vàng thơm."],
  },
  {
    title: "Bánh quẩy chiên chấm sô-cô-la",
    description: "Bánh quẩy chiên vàng phủ quế đường, dùng cùng sốt sô-cô-la.",
    image: "/img/snack-churros.jpg",
    calories: 250,
    ingredients: [["Bột mì", "120", "g"], ["Nước", "180", "ml"], ["Bơ lạt", "30", "g"], ["Đường", "2", "muỗng"], ["Bột quế", "1/2", "muỗng cà phê"], ["Sô-cô-la đen", "50", "g"]],
    steps: ["Đun sôi nước với bơ, cho bột mì vào khuấy đến khi bột thành khối.", "Cho bột vào túi bắt kem, tạo thanh dài rồi chiên vàng.", "Lăn bánh qua đường và bột quế, dùng với sô-cô-la đun chảy."],
  },
  {
    title: "Bánh mì nướng phô mai mini",
    description: "Đế bánh mì mini nướng giòn phủ sốt cà chua, phô mai và xúc xích.",
    image: "/img/snack-pizza.jpg",
    calories: 260,
    ingredients: [["Đế bánh mì mini", "2", "cái"], ["Sốt cà chua", "2", "muỗng"], ["Phô mai mozzarella", "80", "g"], ["Xúc xích", "1", "cây"], ["Ớt chuông", "1/4", "quả"]],
    steps: ["Phết sốt cà chua lên đế, thêm xúc xích và ớt chuông thái nhỏ.", "Rắc phô mai mozzarella lên trên.", "Nướng ở 200°C khoảng 8-10 phút đến khi phô mai chảy."],
  },
];

const snackImages = {
  "Phô mai que": "/img/snack-mozzarella-sticks.jpg",
  ...Object.fromEntries(snacks.map(({ title, image }) => [title, image])),
};
const translatedTitles = [
  ["Nachos phô mai", "Bánh ngô giòn phủ phô mai"],
  ["Pancake mini chuối", "Bánh kếp chuối mini"],
  ["Bánh donut phủ đường", "Bánh vòng chiên phủ đường"],
  ["Bánh waffle trứng mini", "Bánh trứng tổ ong mini"],
  ["Churros chấm sô-cô-la", "Bánh quẩy chiên chấm sô-cô-la"],
  ["Pizza mini phô mai", "Bánh mì nướng phô mai mini"],
];

async function main() {
  const category = await query("SELECT id FROM categories WHERE name=?", "Món ăn vặt");
  if (!category.length) throw new Error("Không tìm thấy danh mục Món ăn vặt.");
  const categoryId = category[0].id;

  for (const [oldTitle, title] of translatedTitles) {
    await exec("UPDATE recipes SET title=? WHERE title=? AND category_id=?", [
      title,
      oldTitle,
      categoryId,
    ]);
  }

  let count = Number(
    (await query("SELECT COUNT(*) AS count FROM recipes WHERE category_id=?", categoryId))[0].count,
  );
  if (count > 20) {
    throw new Error(`Danh mục Món ăn vặt đã có ${count} món; không xóa món nào.`);
  }

  for (const [title, image] of Object.entries(snackImages)) {
    await exec("UPDATE recipes SET image=? WHERE title=? AND category_id=?", [
      image,
      title,
      categoryId,
    ]);
  }

  const existing = new Set(
    (await query("SELECT title FROM recipes WHERE category_id=?", categoryId)).map(
      (recipe) => recipe.title,
    ),
  );
  const user = await query("SELECT TOP 1 id FROM users WHERE role<>'admin' ORDER BY id");
  if (!user.length) throw new Error("Không tìm thấy tài khoản người dùng để tạo món.");

  for (const snack of snacks) {
    if (count >= 20) break;
    if (existing.has(snack.title)) continue;

    const recipeId = (
      await exec(
        `INSERT INTO recipes (user_id,title,description,image,video_url,category_id,country,prep_minutes,cook_minutes,servings,difficulty,calories,protein,carbs,fat,diet,is_public,views)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          user[0].id,
          snack.title,
          snack.description,
          snack.image,
          "",
          categoryId,
          "Việt Nam",
          15,
          15,
          2,
          "Dễ",
          snack.calories,
          8,
          30,
          12,
          "",
          1,
          0,
        ],
      )
    ).insertId;

    for (const [name, quantity, unit] of snack.ingredients) {
      await exec(
        "INSERT INTO recipe_ingredients (recipe_id,name,quantity,unit) VALUES (?,?,?,?)",
        [recipeId, name, quantity, unit],
      );
    }

    for (let index = 0; index < snack.steps.length; index += 1) {
      await exec(
        "INSERT INTO recipe_steps (recipe_id,step_order,text) VALUES (?,?,?)",
        [recipeId, index + 1, snack.steps[index]],
      );
    }

    existing.add(snack.title);
    count += 1;
    console.log(`+ ${snack.title}`);
  }

  if (count !== 20) {
    throw new Error(`Danh mục Món ăn vặt có ${count}/20 món; không thể thêm trùng tên.`);
  }
  console.log("Danh mục Món ăn vặt hiện có đúng 20 món.");
}

main().catch((error) => {
  console.error("Không thể bổ sung món ăn vặt:", error.message);
  process.exitCode = 1;
});
