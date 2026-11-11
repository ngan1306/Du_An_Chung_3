// Recipes (SQL Server): CRUD, tim kiem, loc, yeu thich, bo suu tap, danh gia, meal plan, shopping list, social, thong bao
const express = require('express');
const { query, exec, get } = require('../db/database');
const { authRequired, authOptional, log, notify } = require('../middleware');

const router = express.Router();
const adminContact = Object.freeze({
  name: 'Vũ Thanh Ngân',
  phone: '0702994316',
  email: 'baon130625@gmail.com',
});

// wrapper dam bao bat moi loi async -> 500 thay vi treo request
const aw = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const recipeCardsSql = `SELECT r.id, r.title, r.image, r.views, r.prep_minutes,
  r.cook_minutes, r.difficulty, r.diet, r.category_id, r.country,
  c.name AS category,
  ISNULL((SELECT AVG(CAST(rt.stars AS FLOAT)) FROM ratings rt WHERE rt.recipe_id=r.id),0) AS avg_rating,
  (SELECT COUNT(*) FROM ratings rt WHERE rt.recipe_id=r.id) AS rating_count,
  (SELECT COUNT(*) FROM favorites f WHERE f.recipe_id=r.id) AS fav_count,
  u.id AS author_id, u.username AS author_username,
  u.display_name AS author_display_name, u.avatar AS author_avatar
  FROM recipes r
  LEFT JOIN categories c ON c.id=r.category_id
  LEFT JOIN users u ON u.id=r.user_id`;

function mapRecipeCards(rows) {
  return rows.map(({ author_id, author_username, author_display_name, author_avatar, ...recipe }) => ({
    ...recipe,
    avg_rating: Math.round((recipe.avg_rating || 0) * 10) / 10,
    author: author_id == null ? null : {
      id: author_id,
      username: author_username,
      display_name: author_display_name,
      avatar: author_avatar,
    },
  }));
}

// Danh sach + tim kiem + loc + sap xep
router.get('/', authOptional, async (req, res) => {
  try {
    const { q, ingredient, category, country, difficulty, diet, maxTime, maxCal, sort, page = 1 } = req.query;
    let where = 'WHERE r.is_public=1 AND r.approved=1';
    const p = [];
    if (q) { where += ' AND (r.title LIKE ? OR r.description LIKE ?)'; p.push(`%${q}%`, `%${q}%`); }
    if (category) { where += ' AND r.category_id=?'; p.push(category); }
    if (country) { where += ' AND r.country=?'; p.push(country); }
    if (difficulty) { where += ' AND r.difficulty=?'; p.push(difficulty); }
    if (diet) { where += ' AND r.diet=?'; p.push(diet); }
    if (maxTime) { where += ' AND (r.prep_minutes + r.cook_minutes) <= ?'; p.push(maxTime); }
    if (maxCal) { where += ' AND r.calories <= ?'; p.push(maxCal); }
    if (ingredient) {
      where += ' AND r.id IN (SELECT recipe_id FROM recipe_ingredients WHERE name LIKE ?)';
      p.push(`%${ingredient}%`);
    }
    // SORT: OFF theo de phong injection
    const orderMap = {
      views: 'r.views DESC',
      rating: '(SELECT AVG(CAST(stars AS FLOAT)) FROM ratings WHERE recipe_id=r.id) DESC',
      time: '(r.prep_minutes + r.cook_minutes) ASC',
      newest: 'r.created_at DESC'
    };
    const order = orderMap[sort] || 'r.created_at DESC';
    const offset = (Math.max(1, +page) - 1) * 12;
    const [count, rows] = await Promise.all([
      get(`SELECT COUNT(*) c FROM recipes r ${where}`, p),
      query(
        `${recipeCardsSql} ${where} ORDER BY ${order} OFFSET ? ROWS FETCH NEXT 12 ROWS ONLY`,
        [...p, offset],
      ),
    ]);
    res.json({ total: count.c, page: +page, items: mapRecipeCards(rows) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gá»£i Ã½ mÃ³n theo sá»Ÿ thÃ­ch user
router.get('/suggest', authRequired, async (req, res) => {
  try {
    const prefs = (req.user.prefs || '').split(',').map(s => s.trim()).filter(Boolean);
    let rows = [];
    if (prefs.length) {
      const like = prefs.map(() => 'r.diet=? OR r.title LIKE ?').join(' OR ');
      const args = prefs.flatMap(x => [x, `%${x}%`]);
      rows = await query(`${recipeCardsSql} WHERE r.is_public=1 AND r.approved=1 AND (${like}) ORDER BY r.views DESC OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`, args);
    }
    if (!rows.length)
      rows = await query(`${recipeCardsSql} WHERE r.is_public=1 AND r.approved=1 ORDER BY NEWID() OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`);
    res.json(mapRecipeCards(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/meta/categories', async (_req, res) => res.json(await query('SELECT * FROM categories')));
router.get('/meta/countries', async (_req, res) => res.json((await query('SELECT DISTINCT country FROM recipes')).map(r => r.country)));
router.get('/meta/ingredients', async (_req, res) => res.json(await query('SELECT * FROM ingredients ORDER BY name')));

router.get('/collections/:id/recipes', authRequired, async (req, res) => {
  try {
    const collectionId = Number(req.params.id);
    const term = typeof req.query.q === 'string'
      ? req.query.q.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
      : '';
    if (!Number.isInteger(collectionId) || collectionId < 1) {
      return res.status(400).json({ error: 'Bộ sưu tập không hợp lệ' });
    }
    if (term.length < 2 || term.length > 100) {
      return res.status(400).json({ error: 'Từ khóa tìm kiếm phải có từ 2 đến 100 ký tự' });
    }
    const collection = await get(
      'SELECT id FROM collections WHERE id=? AND user_id=?',
      collectionId,
      req.user.id,
    );
    if (!collection) return res.status(404).json({ error: 'Không tìm thấy bộ sưu tập' });
    const recipes = await query(
      `SELECT TOP 50 r.id, r.title FROM recipes r
       WHERE ((r.is_public=1 AND r.approved=1) OR r.user_id=?)
         AND r.title COLLATE Latin1_General_CI_AI LIKE ?
         AND NOT EXISTS (
           SELECT 1 FROM collection_items ci
           WHERE ci.collection_id=? AND ci.recipe_id=r.id
         )
       ORDER BY r.title`,
      req.user.id,
      `%${term}%`,
      collectionId,
    );
    res.json(recipes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin-contact', (_req, res) => res.json(adminContact));

// Chi tiet cong thuc
router.get('/:id', authOptional, async (req, res, next) => {
  if (isNaN(+req.params.id)) return next('route');
  try {
    const r = await get(`SELECT r.*, c.name AS category,
      ISNULL((SELECT AVG(CAST(rt.stars AS FLOAT)) FROM ratings rt WHERE rt.recipe_id=r.id),0) AS avg_rating,
      (SELECT COUNT(*) FROM ratings rt WHERE rt.recipe_id=r.id) AS rating_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.recipe_id=r.id) AS fav_count,
      u.id AS author_id, u.username AS author_username,
      u.display_name AS author_display_name, u.avatar AS author_avatar
      FROM recipes r
      LEFT JOIN categories c ON c.id=r.category_id
      LEFT JOIN users u ON u.id=r.user_id WHERE r.id=?`, req.params.id);
    if (!r || (!r.is_public && (!req.user || req.user.id !== r.user_id)))
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y cÃ´ng thá»©c' });
    const [ingredients, steps, isFavorite, ratings] = await Promise.all([
      query('SELECT * FROM recipe_ingredients WHERE recipe_id=? ORDER BY id', r.id),
      query('SELECT * FROM recipe_steps WHERE recipe_id=? ORDER BY step_order', r.id),
      req.user
        ? get('SELECT 1 x FROM favorites WHERE user_id=? AND recipe_id=?', req.user.id, r.id)
        : Promise.resolve(null),
      query(
        `SELECT rt.*, u.username, u.avatar, u.display_name,
        (SELECT COUNT(*) FROM comment_likes cl WHERE cl.rating_id=rt.rowid) likes
        FROM ratings rt JOIN users u ON u.id=rt.user_id WHERE rt.recipe_id=? ORDER BY rt.created_at DESC`,
        r.id,
      ),
      exec('UPDATE recipes SET views=views+1 WHERE id=?', r.id),
    ]);
    r.views += 1;
    const data = mapRecipeCards([r])[0];
    data.ingredients = ingredients;
    data.steps = steps;
    data.is_fav = !!isFavorite;
    data.ratings = ratings;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Them / sua cong thuc
async function saveRecipe(req, res, existing) {
  try {
    const b = req.body;
    const fields = [b.title, b.description || '', b.image || '/img/food-placeholder.jpg', b.video_url || '',
      b.category_id || null, b.country || 'Viá»‡t Nam', +b.prep_minutes || 10, +b.cook_minutes || 20,
      +b.servings || 2, b.difficulty || 'Dá»…', +b.calories || 0, +b.protein || 0, +b.carbs || 0, +b.fat || 0,
      b.diet || '', b.is_public === false ? 0 : 1];
    let id;
    if (existing) {
      if (existing.user_id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ error: 'KhÃ´ng cÃ³ quyá»n sá»­a' });
      await exec(`UPDATE recipes SET title=?,description=?,image=?,video_url=?,category_id=?,country=?,
      prep_minutes=?,cook_minutes=?,servings=?,difficulty=?,calories=?,protein=?,carbs=?,fat=?,diet=?,is_public=? WHERE id=?`,
        [...fields, existing.id]);
      id = existing.id;
    } else {
      id = (await exec(`INSERT INTO recipes (user_id,title,description,image,video_url,category_id,country,
      prep_minutes,cook_minutes,servings,difficulty,calories,protein,carbs,fat,diet,is_public)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [req.user.id, ...fields])).insertId;
    }
    await Promise.all([
      exec('DELETE FROM recipe_ingredients WHERE recipe_id=?', id),
      exec('DELETE FROM recipe_steps WHERE recipe_id=?', id),
    ]);
    const ingredients = (b.ingredients || []).filter((item) => item && item.name);
    for (let start = 0; start < ingredients.length; start += 500) {
      const batch = ingredients.slice(start, start + 500);
      const values = batch.map(() => '(?,?,?,?)').join(',');
      await exec(
        `INSERT INTO recipe_ingredients (recipe_id,name,quantity,unit) VALUES ${values}`,
        batch.flatMap((item) => [id, item.name, item.quantity || '', item.unit || '']),
      );
      await exec(
        batch.map(() =>
          'IF NOT EXISTS (SELECT 1 FROM ingredients WHERE name=?) INSERT INTO ingredients (name) VALUES (?)',
        ).join(';'),
        batch.flatMap((item) => [item.name, item.name]),
      );
    }
    const steps = (b.steps || []).filter((step) => step && String(step).trim());
    for (let start = 0; start < steps.length; start += 500) {
      const batch = steps.slice(start, start + 500);
      const values = batch.map(() => '(?,?,?)').join(',');
      await exec(
        `INSERT INTO recipe_steps (recipe_id,step_order,text) VALUES ${values}`,
        batch.map((text, index) => [id, start + index + 1, text]).flat(),
      );
    }
    log(req.user.id, existing ? 'edit_recipe' : 'create_recipe', `recipe #${id} ${b.title}`);
    res.json({ id, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

router.post('/', authRequired, (req, res) => saveRecipe(req, res, null));

router.put('/:id', authRequired, async (req, res) => {
  const existing = await get('SELECT * FROM recipes WHERE id=?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
  saveRecipe(req, res, existing);
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const r = await get('SELECT * FROM recipes WHERE id=?', req.params.id);
    if (!r) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
    if (r.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'KhÃ´ng cÃ³ quyá»n xÃ³a' });
    await exec('DELETE FROM recipes WHERE id=?', r.id);
    log(req.user.id, 'delete_recipe', `recipe #${r.id}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cong thuc cua toi
router.get('/mine/list', authRequired, async (req, res) => {
  res.json(mapRecipeCards(
    await query(`${recipeCardsSql} WHERE r.user_id=? ORDER BY r.created_at DESC`, req.user.id),
  ));
});

// log view (lich su xem) - goi tu frontend khi mo chi tiet
router.post('/_logView', authRequired, async (req, res) => {
  const ref = req.headers.referer || '';
  const id = (ref.match(/recipe\/(\d+)/) || [])[1];
  log(req.user.id, 'view_recipe', id ? `recipe #${id}` : ref);
  res.json({ ok: true });
});

// ---- Yeu thich ----
router.post('/:id/favorite', authRequired, async (req, res, next) => {
  if (isNaN(+req.params.id)) return next('route');
  try {
    const ex = await get('SELECT 1 x FROM favorites WHERE user_id=? AND recipe_id=?', req.user.id, req.params.id);
    if (ex) {
      await exec('DELETE FROM favorites WHERE user_id=? AND recipe_id=?', req.user.id, req.params.id);
      return res.json({ fav: false });
    }
    await exec('INSERT INTO favorites (user_id,recipe_id) VALUES (?,?)', req.user.id, req.params.id);
    const r = await get('SELECT * FROM recipes WHERE id=?', req.params.id);
    if (r && r.user_id !== req.user.id)
      notify(r.user_id, 'favorite', `${req.user.display_name || req.user.username} Ä‘Ã£ yÃªu thÃ­ch cÃ´ng thá»©c "${r.title}"`, `/recipe/${r.id}`);
    res.json({ fav: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/favorites/list', authRequired, async (req, res) => {
  res.json(mapRecipeCards(
    await query(`${recipeCardsSql} JOIN favorites f ON f.recipe_id=r.id WHERE f.user_id=?`, req.user.id),
  ));
});

// ---- Bo suu tap ----
router.post('/collections', authRequired, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 150)
      return res.status(400).json({ error: 'Tên bộ sưu tập phải từ 1 đến 150 ký tự' });
    const token = Math.random().toString(36).slice(2, 10);
    const id = (await exec('INSERT INTO collections (user_id,name,share_token) VALUES (?,?,?)', req.user.id, name, token)).insertId;
    res.json({ id, share_token: token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/collections/list', authRequired, async (req, res) => {
  try {
    const cols = await query('SELECT * FROM collections WHERE user_id=?', req.user.id);
    await Promise.all(cols.map(async (c) => {
      c.items = mapRecipeCards(
        await query(
          `${recipeCardsSql} JOIN collection_items ci ON ci.recipe_id=r.id WHERE ci.collection_id=?`,
          c.id,
        ),
      );
    }));
    res.json(cols);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/collections/:id/items', authRequired, async (req, res) => {
  try {
    const collectionId = Number(req.params.id);
    const recipeId = Number(req.body.recipe_id);
    if (!Number.isInteger(collectionId) || collectionId < 1 ||
        !Number.isInteger(recipeId) || recipeId < 1)
      return res.status(400).json({ error: 'Bộ sưu tập hoặc công thức không hợp lệ' });
    const c = await get('SELECT * FROM collections WHERE id=? AND user_id=?', collectionId, req.user.id);
    if (!c) return res.status(404).json({ error: 'Không tìm thấy bộ sưu tập' });
    const recipe = await get(
      'SELECT id FROM recipes WHERE id=? AND (is_public=1 OR user_id=?)',
      recipeId,
      req.user.id,
    );
    if (!recipe) return res.status(404).json({ error: 'Không tìm thấy công thức' });
    const existing = await get(
      'SELECT 1 x FROM collection_items WHERE collection_id=? AND recipe_id=?',
      c.id,
      recipe.id,
    );
    if (existing) return res.json({ ok: true, already_added: true });
    await exec(
      'INSERT INTO collection_items (collection_id,recipe_id) VALUES (?,?)',
      c.id,
      recipe.id,
    );
    res.json({ ok: true, already_added: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/collections/share/:token', async (req, res) => {
  const c = await get('SELECT * FROM collections WHERE share_token=?', req.params.token);
  if (!c) return res.status(404).json({ error: 'Bá»™ sÆ°u táº­p khÃ´ng tá»“n táº¡i' });
  res.json({
    name: c.name,
    items: mapRecipeCards(
      await query(
        `${recipeCardsSql} JOIN collection_items ci ON ci.recipe_id=r.id WHERE ci.collection_id=?`,
        c.id,
      ),
    ),
  });
});

// ---- Danh gia & binh luan ----
router.post('/:id/rate', authRequired, async (req, res, next) => {
  if (isNaN(+req.params.id)) return next('route');
  try {
    const stars = Number(req.body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      return res.status(400).json({ error: 'Số sao phải là số nguyên từ 1 đến 5' });
    const ex = await get('SELECT rowid FROM ratings WHERE user_id=? AND recipe_id=?', req.user.id, req.params.id);
    if (ex) {
      await exec('UPDATE ratings SET stars=?,comment=?,photo=? WHERE user_id=? AND recipe_id=?',
        stars, req.body.comment || '', req.body.photo || '', req.user.id, req.params.id);
    } else {
      await exec('INSERT INTO ratings (user_id,recipe_id,stars,comment,photo,parent_id) VALUES (?,?,?,?,?,?)',
        req.user.id, req.params.id, stars, req.body.comment || '', req.body.photo || '', req.body.parent_id || null);
    }
    const r = await get('SELECT * FROM recipes WHERE id=?', req.params.id);
    if (r && r.user_id !== req.user.id)
      notify(r.user_id, 'rating', `${req.user.display_name || req.user.username} Ä‘Ã£ Ä‘Ã¡nh giÃ¡ "${r.title}" ${stars}â˜…`, `/recipe/${r.id}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/comments/:rid', authRequired, async (req, res) => {
  const c = await get('SELECT * FROM ratings WHERE rowid=?', req.params.rid);
  if (!c) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
  if (c.user_id !== req.user.id && req.user.role === 'user') return res.status(403).json({ error: 'KhÃ´ng cÃ³ quyá»n' });
  await exec('DELETE FROM ratings WHERE rowid=?', req.params.rid);
  res.json({ ok: true });
});

router.post('/comments/:rid/like', authRequired, async (req, res) => {
  const ex = await get('SELECT 1 x FROM comment_likes WHERE user_id=? AND rating_id=?', req.user.id, req.params.rid);
  if (ex) {
    await exec('DELETE FROM comment_likes WHERE user_id=? AND rating_id=?', req.user.id, req.params.rid);
    return res.json({ liked: false });
  }
  await exec('INSERT INTO comment_likes (user_id,rating_id) VALUES (?,?)', req.user.id, req.params.rid);
  res.json({ liked: true });
});

router.post('/reports', authRequired, async (req, res) => {
  await exec('INSERT INTO reports (user_id,rating_id,recipe_id,reason) VALUES (?,?,?,?)',
    req.user.id, req.body.rating_id || null, req.body.recipe_id || null, req.body.reason || 'Vi pháº¡m');
  res.json({ ok: true });
});

// ---- Lich su da xem ----
router.get('/history/list', authRequired, async (req, res) => {
  const logs = await query("SELECT TOP 20 detail FROM activity_logs WHERE user_id=? AND action='view_recipe' ORDER BY id DESC", req.user.id);
  const ids = [...new Set(logs.map(l => (l.detail.match(/#(\d+)/) || [])[1]).filter(Boolean))];
  if (!ids.length) return res.json([]);
  const rows = await query(
    `${recipeCardsSql} WHERE r.id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const byId = new Map(mapRecipeCards(rows).map((recipe) => [String(recipe.id), recipe]));
  res.json(ids.map((id) => byId.get(id)).filter(Boolean));
});

// ---- Social ----
router.post('/users/:id/follow', authRequired, async (req, res) => {
  try {
    const target = +req.params.id;
    if (target === req.user.id) return res.status(400).json({ error: 'KhÃ´ng thá»ƒ tá»± theo dÃµi' });
    const ex = await get('SELECT 1 x FROM follows WHERE follower_id=? AND following_id=?', req.user.id, target);
    if (ex) {
      await exec('DELETE FROM follows WHERE follower_id=? AND following_id=?', req.user.id, target);
      return res.json({ following: false });
    }
    await exec('INSERT INTO follows (follower_id,following_id) VALUES (?,?)', req.user.id, target);
    notify(target, 'follow', `${req.user.display_name || req.user.username} Ä‘Ã£ theo dÃµi báº¡n`, `/user/${req.user.id}`);
    res.json({ following: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/:id', async (req, res) => {
  const u = await get('SELECT id,username,display_name,avatar,bio,created_at,role FROM users WHERE id=?', req.params.id);
  if (!u) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
  if (u.role === 'admin' && u.username === adminContact.name) {
    return res.json({
      id: u.id,
      display_name: adminContact.name,
      contact: { phone: adminContact.phone, email: adminContact.email },
    });
  }
  const [recipes, followers, following, posts] = await Promise.all([
    query(`${recipeCardsSql} WHERE r.user_id=? AND r.is_public=1 AND r.approved=1`, u.id),
    get('SELECT COUNT(*) c FROM follows WHERE following_id=?', u.id),
    get('SELECT COUNT(*) c FROM follows WHERE follower_id=?', u.id),
    query("SELECT p.*, u.username FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.approved=1 ORDER BY p.created_at DESC", u.id),
  ]);
  u.recipes = mapRecipeCards(recipes);
  u.followers = followers.c;
  u.following = following.c;
  u.posts = posts;
  res.json(u);
});

// ---- Bai viet cong dong ----
router.get('/posts/feed', authOptional, async (req, res) => {
  let sql = `SELECT p.*, u.username, u.avatar, u.display_name,
    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id=p.id) like_count
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.approved=1`;
  const args = [];
  if (req.query.following === '1' && req.user) {
    sql += ' AND p.user_id IN (SELECT following_id FROM follows WHERE follower_id=?)';
    args.push(req.user.id);
  }
  sql += ' ORDER BY p.created_at DESC OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY';
  res.json(await query(sql, args));
});
router.post('/posts', authRequired, async (req, res) => {
  const id = (await exec('INSERT INTO posts (user_id,content,image,recipe_id) VALUES (?,?,?,?)',
    req.user.id, req.body.content, req.body.image || '', req.body.recipe_id || null)).insertId;
  log(req.user.id, 'create_post', `post #${id}`);
  res.json({ id });
});
router.post('/posts/:id/like', authRequired, async (req, res) => {
  const ex = await get('SELECT 1 x FROM post_likes WHERE user_id=? AND post_id=?', req.user.id, req.params.id);
  if (ex) {
    await exec('DELETE FROM post_likes WHERE user_id=? AND post_id=?', req.user.id, req.params.id);
    return res.json({ liked: false });
  }
  await exec('INSERT INTO post_likes (user_id,post_id) VALUES (?,?)', req.user.id, req.params.id);
  const p = await get('SELECT * FROM posts WHERE id=?', req.params.id);
  if (p && p.user_id !== req.user.id)
    notify(p.user_id, 'like', `${req.user.display_name || req.user.username} Ä‘Ã£ thÃ­ch bÃ i viáº¿t cá»§a báº¡n`, '/community');
  res.json({ liked: true });
});

// ---- Meal Planner ----
router.get('/mealplan', authRequired, async (req, res) => {
  const { start, end } = req.query;
  res.json(await query(
    `SELECT mp.*, r.title, r.image, r.calories FROM meal_plans mp
    JOIN recipes r ON r.id=mp.recipe_id WHERE mp.user_id=? AND mp.date BETWEEN ? AND ? ORDER BY mp.date, mp.slot`,
    req.user.id, start, end));
});
router.post('/mealplan', authRequired, async (req, res) => {
  const { date, slot, recipe_id } = req.body;
  const ex = await get('SELECT id FROM meal_plans WHERE user_id=? AND date=? AND slot=?', req.user.id, date, slot);
  if (ex) await exec('UPDATE meal_plans SET recipe_id=?, done=0 WHERE id=?', recipe_id, ex.id);
  else await exec('INSERT INTO meal_plans (user_id,date,slot,recipe_id) VALUES (?,?,?,?)', req.user.id, date, slot, recipe_id);
  res.json({ ok: true });
});
router.delete('/mealplan', authRequired, async (req, res) => {
  await exec('DELETE FROM meal_plans WHERE user_id=? AND date=? AND slot=?', req.user.id, req.query.date, req.query.slot);
  res.json({ ok: true });
});
router.post('/mealplan/:id/done', authRequired, async (req, res) => {
  const mp = await get('SELECT * FROM meal_plans WHERE id=? AND user_id=?', req.params.id, req.user.id);
  if (!mp) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
  await exec('UPDATE meal_plans SET done=? WHERE id=?', mp.done ? 0 : 1, mp.id);
  res.json({ ok: true, done: !mp.done });
});

// ---- Shopping list ----
router.get('/shopping', authRequired, async (req, res) =>
  res.json(await query('SELECT * FROM shopping_items WHERE user_id=? ORDER BY bought, id', req.user.id)));
router.post('/shopping', authRequired, async (req, res) => {
  await exec('INSERT INTO shopping_items (user_id,name,quantity) VALUES (?,?,?)', req.user.id, req.body.name, req.body.quantity || '');
  res.json({ ok: true });
});
router.post('/shopping/from-recipe/:rid', authRequired, async (req, res) => {
  const ings = await query('SELECT * FROM recipe_ingredients WHERE recipe_id=?', req.params.rid);
  let added = 0;
  for (const i of ings) {
    const ex = await get('SELECT 1 x FROM shopping_items WHERE user_id=? AND name=?', req.user.id, i.name);
    if (!ex) {
      await exec('INSERT INTO shopping_items (user_id,name,quantity) VALUES (?,?,?)', req.user.id, i.name, `${i.quantity} ${i.unit}`.trim());
      added++;
    }
  }
  res.json({ added });
});
router.put('/shopping/:id', authRequired, async (req, res) => {
  const it = await get('SELECT * FROM shopping_items WHERE id=? AND user_id=?', req.params.id, req.user.id);
  if (!it) return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y' });
  await exec('UPDATE shopping_items SET bought=?, name=?, quantity=? WHERE id=?',
    req.body.bought !== undefined ? (req.body.bought ? 1 : 0) : it.bought,
    req.body.name ?? it.name, req.body.quantity ?? it.quantity, it.id);
  res.json({ ok: true });
});
router.delete('/shopping/:id', authRequired, async (req, res) => {
  await exec('DELETE FROM shopping_items WHERE id=? AND user_id=?', req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---- Thong bao ----
router.get('/notifications', authRequired, async (req, res) => {
  const rows = await query('SELECT TOP 30 * FROM notifications WHERE user_id=? ORDER BY id DESC', req.user.id);
  await exec('UPDATE notifications SET is_read=1 WHERE user_id=?', req.user.id);
  res.json(rows);
});

// error handler cua router: moi loi async -> 500 JSON
router.use((err, _req, res, _next) => {
  console.error('ROUTE ERR:', err && err.message || err);
  res.status(500).json({ error: (err && err.message) || 'Loi may chu' });
});

module.exports = router;
