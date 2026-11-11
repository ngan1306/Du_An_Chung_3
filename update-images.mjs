// Cap nhat DB: tro image sang .jpg that
import { exec, query } from "./server/db/mssql.js";

// ten file theo tu khoa tim kiem
const fileByTitle = {
  "Phở bò Hà Nội": "pho.jpg",
  "Sushi cá hồi": "sushi.jpg",
  "Salad bơ mè rang": "salad.jpg",
  "Gà nướng mật ong": "chicken.jpg",
  "Tiramisu Ý": "tiramisu.jpg",
  "Canh chua cá": "soup.jpg",
  "Bánh mì Việt Nam": "banhmi.jpg",
  "Cơm tấm sườn nướng": "comtam.jpg",
  "Bún bò Huế": "bunbo.jpg",
  "Gỏi cuốn tôm thịt": "goicuon.jpg",
  "Ramen hải sản": "ramen.jpg",
  "Pizza margherita": "pizza.jpg",
  "Pad Thái tôm": "padthai.jpg",
  "Pancake mật ong": "pancake.jpg",
  "Phô mai que": "cheese.jpg",
  "Bò bít tết": "beefsteak.jpg",
  "Hoành thánh chiên": "springroll.jpg",
  "Kem vanilla dâu": "icecream.jpg",
  "Sinh tố xoài": "smoothie.jpg",
  "Cà phê sữa đá": "drink-vietnamese-coffee.jpg",
  "Trà đào cam sả": "drink-peach-tea.jpg",
  "Trà sữa trân châu": "drink-bubble-tea.jpg",
  "Trà chanh mật ong": "drink-lemon-tea.jpg",
  "Nước ép cam tươi": "drink-orange-juice.jpg",
  "Nước ép dưa hấu": "drink-watermelon-juice.jpg",
  "Sinh tố bơ": "drink-avocado-smoothie.jpg",
  "Sinh tố dâu tây": "drink-strawberry-smoothie.jpg",
  "Nước chanh dây": "drink-passion-fruit.jpg",
  "Sữa đậu nành": "drink-soy-milk.jpg",
  "Ca cao sữa đá": "drink-cocoa.jpg",
  "Bạc xỉu": "drink-vietnamese-coffee.jpg",
  "Cà phê muối": "coffee.jpg",
  "Trà gừng mật ong": "drink-ginger-tea.jpg",
  "Matcha latte": "drink-matcha-latte.jpg",
  "Nước dừa tươi": "drink-coconut-water.jpg",
  "Soda chanh bạc hà": "drink-mojito.jpg",
  "Sữa bắp": "drink-soy-milk.jpg",
  "Trà vải": "drink-lychee-tea.jpg",
};

(async () => {
  let ok = 0,
    miss = [];
  for (const [title, img] of Object.entries(fileByTitle)) {
    const r = await exec("UPDATE recipes SET image=? WHERE title=?", [
      "/img/" + img,
      title,
    ]);
    if (r.changes > 0) ok++;
    else miss.push(title);
  }
  console.log(`Updated: ${ok}/20`);
  if (miss.length) console.log("Khong thay:", miss.join(", "));
  // kiem tra ket qua
  const rows = await query("SELECT title, image FROM recipes ORDER BY id");
  rows.forEach((r) => console.log(`  ${r.title} -> ${r.image}`));
  process.exit(0);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
