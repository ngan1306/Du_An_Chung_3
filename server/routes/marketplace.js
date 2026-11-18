const express = require("express");
const crypto = require("crypto");
const net = require("net");
const { query, exec, get } = require("../db/database");
const { authRequired, log, sign } = require("../middleware");
const mockCommerce = require("../providers/commerce/mock");

const router = express.Router();
const schemaReady = (async () => {
  const schemaExists = await get(`SELECT CASE WHEN
    COL_LENGTH('recipes','is_premium') IS NOT NULL AND
    COL_LENGTH('recipes','price') IS NOT NULL AND
    COL_LENGTH('ingredients','unit_price') IS NOT NULL AND
    OBJECT_ID('creator_profiles','U') IS NOT NULL AND
    OBJECT_ID('marketplace_cart_items','U') IS NOT NULL AND
    OBJECT_ID('marketplace_orders','U') IS NOT NULL AND
    OBJECT_ID('marketplace_order_items','U') IS NOT NULL AND
    COL_LENGTH('marketplace_order_items','commission_rate_bps') IS NOT NULL AND
    COL_LENGTH('marketplace_order_items','commission_amount') IS NOT NULL AND
    COL_LENGTH('marketplace_order_items','creator_amount') IS NOT NULL AND
    OBJECT_ID('marketplace_payments','U') IS NOT NULL AND
    OBJECT_ID('purchased_recipes','U') IS NOT NULL AND
    OBJECT_ID('grocery_orders','U') IS NOT NULL AND
    OBJECT_ID('grocery_order_items','U') IS NOT NULL AND
    OBJECT_ID('grocery_payments','U') IS NOT NULL AND
    OBJECT_ID('marketplace_settings','U') IS NOT NULL AND
    OBJECT_ID('creator_wallets','U') IS NOT NULL AND
    OBJECT_ID('creator_wallet_ledger','U') IS NOT NULL AND
    OBJECT_ID('creator_withdrawals','U') IS NOT NULL
    THEN 1 ELSE 0 END AS schema_exists`);
  if (schemaExists.schema_exists) {
    const commission = await get(
      "SELECT 1 x FROM marketplace_settings WHERE setting_key='creator_commission_bps'",
    );
    if (!commission)
      await exec("INSERT INTO marketplace_settings (setting_key,setting_value) VALUES ('creator_commission_bps',1000)");
    return;
  }

  await exec(`
    IF COL_LENGTH('recipes','is_premium') IS NULL
      ALTER TABLE recipes ADD is_premium BIT NOT NULL CONSTRAINT DF_recipes_is_premium DEFAULT(0);
    IF COL_LENGTH('recipes','price') IS NULL
      ALTER TABLE recipes ADD price INT NOT NULL CONSTRAINT DF_recipes_price DEFAULT(0);
    IF COL_LENGTH('ingredients','unit_price') IS NULL
      ALTER TABLE ingredients ADD unit_price INT NOT NULL CONSTRAINT DF_ingredients_unit_price DEFAULT(0);
    IF OBJECT_ID('creator_profiles','U') IS NULL
      CREATE TABLE creator_profiles (
        user_id INT PRIMARY KEY REFERENCES users(id),
        bio NVARCHAR(1000) NOT NULL DEFAULT '',
        bank_name NVARCHAR(100) NOT NULL DEFAULT '',
        bank_account NVARCHAR(100) NOT NULL DEFAULT '',
        account_name NVARCHAR(150) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('marketplace_cart_items','U') IS NULL
      CREATE TABLE marketplace_cart_items (
        user_id INT NOT NULL REFERENCES users(id),
        recipe_id INT NOT NULL REFERENCES recipes(id),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_marketplace_cart_items PRIMARY KEY(user_id,recipe_id)
      );
    IF OBJECT_ID('marketplace_orders','U') IS NULL
      CREATE TABLE marketplace_orders (
        id INT IDENTITY PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id),
        total_amount INT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL
      );
    IF OBJECT_ID('marketplace_order_items','U') IS NULL
      CREATE TABLE marketplace_order_items (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES marketplace_orders(id),
        recipe_id INT NOT NULL REFERENCES recipes(id),
        creator_id INT NOT NULL REFERENCES users(id),
        price INT NOT NULL
      );
    IF OBJECT_ID('marketplace_payments','U') IS NULL
      CREATE TABLE marketplace_payments (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES marketplace_orders(id),
        provider NVARCHAR(20) NOT NULL,
        txn_ref NVARCHAR(50) NOT NULL UNIQUE,
        amount INT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        provider_txn_no NVARCHAR(100) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL
      );
    IF OBJECT_ID('purchased_recipes','U') IS NULL
      CREATE TABLE purchased_recipes (
        user_id INT NOT NULL REFERENCES users(id),
        recipe_id INT NOT NULL REFERENCES recipes(id),
        order_id INT NOT NULL REFERENCES marketplace_orders(id),
        purchased_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_purchased_recipes PRIMARY KEY(user_id,recipe_id)
      );
    IF OBJECT_ID('grocery_orders','U') IS NULL
      CREATE TABLE grocery_orders (
        id INT IDENTITY PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id),
        recipient_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(30) NOT NULL,
        delivery_address NVARCHAR(500) NOT NULL,
        delivery_note NVARCHAR(500) NOT NULL DEFAULT '',
        total_amount INT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL
      );
    IF OBJECT_ID('grocery_order_items','U') IS NULL
      CREATE TABLE grocery_order_items (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES grocery_orders(id),
        shopping_item_id INT NOT NULL,
        name NVARCHAR(150) NOT NULL,
        quantity NVARCHAR(80) NOT NULL DEFAULT '',
        price INT NOT NULL
      );
    IF OBJECT_ID('grocery_payments','U') IS NULL
      CREATE TABLE grocery_payments (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES grocery_orders(id),
        provider NVARCHAR(20) NOT NULL,
        txn_ref NVARCHAR(50) NOT NULL UNIQUE,
        amount INT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        provider_txn_no NVARCHAR(100) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL
      );
    IF COL_LENGTH('marketplace_order_items','commission_rate_bps') IS NULL
      ALTER TABLE marketplace_order_items ADD commission_rate_bps INT NOT NULL
        CONSTRAINT DF_marketplace_items_commission_rate DEFAULT(1000);
    IF COL_LENGTH('marketplace_order_items','commission_amount') IS NULL
      ALTER TABLE marketplace_order_items ADD commission_amount INT NOT NULL
        CONSTRAINT DF_marketplace_items_commission_amount DEFAULT(0);
    IF COL_LENGTH('marketplace_order_items','creator_amount') IS NULL
      ALTER TABLE marketplace_order_items ADD creator_amount INT NOT NULL
        CONSTRAINT DF_marketplace_items_creator_amount DEFAULT(0);
    IF OBJECT_ID('marketplace_settings','U') IS NULL
      CREATE TABLE marketplace_settings (
        setting_key NVARCHAR(80) PRIMARY KEY,
        setting_value INT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF NOT EXISTS (SELECT 1 FROM marketplace_settings WHERE setting_key='creator_commission_bps')
      INSERT INTO marketplace_settings (setting_key,setting_value) VALUES ('creator_commission_bps',1000);
    IF OBJECT_ID('creator_wallets','U') IS NULL
      CREATE TABLE creator_wallets (
        user_id INT PRIMARY KEY REFERENCES users(id),
        available_balance INT NOT NULL DEFAULT(0),
        held_balance INT NOT NULL DEFAULT(0),
        total_earned INT NOT NULL DEFAULT(0),
        total_withdrawn INT NOT NULL DEFAULT(0),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('creator_wallet_ledger','U') IS NULL
      CREATE TABLE creator_wallet_ledger (
        id INT IDENTITY PRIMARY KEY,
        creator_id INT NOT NULL REFERENCES users(id),
        order_id INT NULL REFERENCES marketplace_orders(id),
        order_item_id INT NULL REFERENCES marketplace_order_items(id),
        event_key NVARCHAR(120) NOT NULL UNIQUE,
        event_type NVARCHAR(20) NOT NULL,
        gross_amount INT NOT NULL,
        commission_amount INT NOT NULL,
        net_amount INT NOT NULL,
        commission_rate_bps INT NOT NULL,
        note NVARCHAR(300) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('creator_withdrawals','U') IS NULL
      CREATE TABLE creator_withdrawals (
        id INT IDENTITY PRIMARY KEY,
        creator_id INT NOT NULL REFERENCES users(id),
        amount INT NOT NULL,
        bank_name NVARCHAR(100) NOT NULL,
        bank_account NVARCHAR(100) NOT NULL,
        account_name NVARCHAR(150) NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        admin_note NVARCHAR(500) NOT NULL DEFAULT '',
        processed_by INT NULL REFERENCES users(id),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
})();

router.use(async (_req, _res, next) => {
  try {
    await schemaReady;
    next();
  } catch (error) {
    next(error);
  }
});

const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((error) =>
    res.status(error.status || 500).json({ error: error.message || "Lỗi máy chủ" }),
  );
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const amountText = (value) => Number(value).toLocaleString("vi-VN") + " ₫";
const requireVnpay = () => {
  const { VNPAY_TMN_CODE, VNPAY_HASH_SECRET } = process.env;
  if (!VNPAY_TMN_CODE || !VNPAY_HASH_SECRET)
    throw fail(503, "Thanh toán VNPay chưa được cấu hình. Hãy thiết lập VNPAY_TMN_CODE và VNPAY_HASH_SECRET.");
  return { tmnCode: VNPAY_TMN_CODE, secret: VNPAY_HASH_SECRET };
};

function signParams(params, secret) {
  const data = Object.keys(params)
    .filter((key) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType")
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
  return crypto.createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

function safeEqualHex(left, right) {
  if (!/^[a-f\d]+$/i.test(left || "") || !/^[a-f\d]+$/i.test(right || "")) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildPaymentUrl(orderId, amount, req, config, txnRef = String(orderId), description = "Thanh toan don cong thuc") {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const remoteIp = (req.socket.remoteAddress || "").replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
  const date = (d) => [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
    String(d.getUTCHours()).padStart(2, "0"),
    String(d.getUTCMinutes()).padStart(2, "0"),
    String(d.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `${description} ${orderId}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL ||
      `${(process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "")}/api/marketplace/vnpay/return`,
    vnp_IpAddr: net.isIPv4(remoteIp) ? remoteIp : "127.0.0.1",
    vnp_CreateDate: date(now),
    vnp_ExpireDate: date(new Date(now.getTime() + 15 * 60 * 1000)),
  };
  params.vnp_SecureHash = signParams(params, config.secret);
  const baseUrl = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  return `${baseUrl}?${Object.keys(params).sort().map((key) =>
    `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`,
  ).join("&")}`;
}

router.post("/creator", authRequired, wrap(async (req, res) => {
  if (!["user", "creator"].includes(req.user.role))
    throw fail(403, "Tài khoản này không thể đăng ký Creator");
  const bio = typeof req.body.bio === "string" ? req.body.bio.trim() : "";
  if (bio.length > 1000) throw fail(400, "Giới thiệu Creator tối đa 1000 ký tự");
  await exec(
    `IF NOT EXISTS (SELECT 1 FROM creator_profiles WHERE user_id=?)
       INSERT INTO creator_profiles (user_id,bio) VALUES (?,?)`,
    req.user.id, req.user.id, bio,
  );
  await exec("UPDATE users SET role='creator' WHERE id=? AND role='user'", req.user.id);
  const user = await get("SELECT * FROM users WHERE id=?", req.user.id);
  log(req.user.id, "creator_register");
  res.json({
    ok: true,
    role: user.role,
    token: sign(user),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      display_name: user.display_name,
    },
  });
}));

router.get("/catalog", wrap(async (req, res) => {
  const parsedPage = Number.parseInt(req.query.page, 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 12;
  const { total } = await get(
    "SELECT COUNT(*) AS total FROM recipes WHERE is_public=1 AND approved=1",
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const items = await query(`
    SELECT r.id,r.title,r.image,r.price,r.is_premium,r.diet,r.country,
      r.views,r.prep_minutes,r.cook_minutes,r.difficulty,r.category_id,c.name AS category,
      u.id AS author_id,u.username AS author_username,u.display_name AS author_display_name,
      u.avatar AS author_avatar
    FROM recipes r
    LEFT JOIN categories c ON c.id=r.category_id
    LEFT JOIN users u ON u.id=r.user_id
    WHERE r.is_public=1 AND r.approved=1
    ORDER BY r.created_at DESC,r.id DESC
    OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
  `);
  res.json({ items, total, page, pageSize, totalPages });
}));

router.get("/cart", authRequired, wrap(async (req, res) => {
  res.json(await query(`
    SELECT r.id,r.title,r.image,r.price,r.user_id AS creator_id
    FROM marketplace_cart_items ci JOIN recipes r ON r.id=ci.recipe_id
    WHERE ci.user_id=? AND r.is_premium=1 AND r.is_public=1 AND r.approved=1
  `, req.user.id));
}));

router.post("/cart/:recipeId", authRequired, wrap(async (req, res) => {
  if (!validId(req.params.recipeId)) throw fail(400, "Công thức không hợp lệ");
  const recipe = await get(
    `SELECT id,user_id,price FROM recipes
     WHERE id=? AND is_premium=1 AND is_public=1 AND approved=1`,
    Number(req.params.recipeId),
  );
  if (!recipe) throw fail(404, "Công thức Premium không tồn tại hoặc chưa được duyệt");
  if (recipe.user_id === req.user.id) throw fail(400, "Bạn không thể mua công thức của chính mình");
  if (await get("SELECT 1 x FROM purchased_recipes WHERE user_id=? AND recipe_id=?", req.user.id, recipe.id))
    throw fail(409, "Bạn đã sở hữu công thức này");
  await exec(
    `IF NOT EXISTS (SELECT 1 FROM marketplace_cart_items WHERE user_id=? AND recipe_id=?)
       INSERT INTO marketplace_cart_items (user_id,recipe_id) VALUES (?,?)`,
    req.user.id, recipe.id, req.user.id, recipe.id,
  );
  res.json({ ok: true });
}));

router.delete("/cart/:recipeId", authRequired, wrap(async (req, res) => {
  if (!validId(req.params.recipeId)) throw fail(400, "Công thức không hợp lệ");
  await exec("DELETE FROM marketplace_cart_items WHERE user_id=? AND recipe_id=?", req.user.id, Number(req.params.recipeId));
  res.json({ ok: true });
}));

router.post("/checkout", authRequired, wrap(async (req, res) => {
  const paymentChoice = typeof req.body.paymentProvider === "string" ? req.body.paymentProvider : "vnpay";
  const isMockPayment = ["vnpay_mock", "momo_mock", "zalopay_mock"].includes(paymentChoice);
  const providerKey = paymentChoice.replace("_mock", "");
  const config = isMockPayment ? null : requireVnpay();
  if (isMockPayment && process.env.NODE_ENV === "production" && process.env.MOCK_COMMERCE_ENABLED !== "true")
    throw fail(503, "Thanh toán giả lập chỉ khả dụng ngoài môi trường production");
  if (isMockPayment && !mockCommerce.paymentProviders[providerKey])
    throw fail(400, "Cổng thanh toán giả lập không hợp lệ");
  let items;
  if (req.body.recipeId !== undefined) {
    if (!validId(req.body.recipeId)) throw fail(400, "Công thức không hợp lệ");
    const item = await get(`
      SELECT id,user_id AS creator_id,price FROM recipes r
      WHERE id=? AND is_premium=1 AND is_public=1 AND approved=1
        AND user_id<>?
        AND NOT EXISTS (SELECT 1 FROM purchased_recipes p WHERE p.user_id=? AND p.recipe_id=r.id)
    `, Number(req.body.recipeId), req.user.id, req.user.id);
    if (!item) throw fail(404, "Công thức không tồn tại, chưa được duyệt hoặc bạn đã sở hữu");
    items = [item];
  } else {
    items = await query(`
      SELECT r.id,r.user_id AS creator_id,r.price
      FROM marketplace_cart_items ci JOIN recipes r ON r.id=ci.recipe_id
      WHERE ci.user_id=? AND r.is_premium=1 AND r.is_public=1 AND r.approved=1
        AND r.user_id<>?
        AND NOT EXISTS (SELECT 1 FROM purchased_recipes p WHERE p.user_id=ci.user_id AND p.recipe_id=r.id)
    `, req.user.id, req.user.id);
  }
  if (!items.length) throw fail(400, "Giỏ hàng không có công thức hợp lệ để thanh toán");
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  if (!Number.isSafeInteger(total) || total < 5000 || total > 99999999)
    throw fail(400, "Tổng tiền phải từ 5.000 đến 99.999.999 VNĐ để thanh toán qua VNPay");
  const commissionSetting = await get(
    "SELECT setting_value FROM marketplace_settings WHERE setting_key='creator_commission_bps'",
  );
  const commissionRateBps = Number(commissionSetting?.setting_value ?? 1000);

  const orderId = Number((await exec(
    "INSERT INTO marketplace_orders (user_id,total_amount,status) VALUES (?,?,?)",
    req.user.id, total, "pending",
  )).insertId);
  if (!orderId) throw new Error("Không tạo được đơn hàng");
  const mockPayment = isMockPayment ? mockCommerce.createPayment(providerKey, orderId) : null;
  try {
    for (const item of items) {
      const commissionAmount = Math.round(Number(item.price) * commissionRateBps / 10000);
      await exec(
        `INSERT INTO marketplace_order_items
          (order_id,recipe_id,creator_id,price,commission_rate_bps,commission_amount,creator_amount)
         VALUES (?,?,?,?,?,?,?)`,
        orderId, item.id, item.creator_id, item.price, commissionRateBps,
        commissionAmount, Number(item.price) - commissionAmount,
      );
    }
    await exec(
      "INSERT INTO marketplace_payments (order_id,provider,txn_ref,amount,status) VALUES (?,?,?,?,?)",
      orderId, isMockPayment ? `${providerKey}_mock` : "vnpay",
      mockPayment ? mockPayment.reference : String(orderId), total, "pending",
    );
    if (req.body.recipeId === undefined)
      await exec("DELETE FROM marketplace_cart_items WHERE user_id=?", req.user.id);
  } catch (error) {
    await exec("UPDATE marketplace_orders SET status='failed' WHERE id=? AND status='pending'", orderId);
    throw error;
  }
  log(req.user.id, "marketplace_checkout", `order #${orderId}; ${amountText(total)}`);
  res.json({
    orderId,
    amount: total,
    paymentUrl: mockPayment
      ? `/#/mock-payment/recipe/${orderId}?provider=${providerKey}`
      : buildPaymentUrl(orderId, total, req, config),
    paymentProvider: isMockPayment ? mockPayment.providerName : "VNPay",
  });
}));

async function settleMarketplacePayment(orderId, transactionRef, responseCode) {
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE marketplace_orders WITH (UPDLOCK,ROWLOCK)
      SET status='paid',paid_at=ISNULL(paid_at,GETDATE())
      WHERE id=? AND status='pending';
    IF @@ROWCOUNT=0 AND NOT EXISTS (SELECT 1 FROM marketplace_orders WHERE id=? AND status='paid')
      THROW 51010,'Đơn hàng không còn ở trạng thái chờ thanh toán.',1;
    UPDATE marketplace_payments
      SET status='paid',provider_txn_no=?,paid_at=ISNULL(paid_at,GETDATE())
      WHERE order_id=? AND status IN ('pending','paid');
    IF @@ROWCOUNT=0 THROW 51011,'Không tìm thấy giao dịch đang chờ thanh toán.',1;
    INSERT INTO purchased_recipes (user_id,recipe_id,order_id)
      SELECT o.user_id,oi.recipe_id,o.id FROM marketplace_orders o
      JOIN marketplace_order_items oi ON oi.order_id=o.id
      WHERE o.id=? AND o.status='paid'
        AND NOT EXISTS (SELECT 1 FROM purchased_recipes p WHERE p.user_id=o.user_id AND p.recipe_id=oi.recipe_id);
    INSERT INTO creator_wallets (user_id)
      SELECT DISTINCT oi.creator_id FROM marketplace_order_items oi
      WHERE oi.order_id=? AND NOT EXISTS (
        SELECT 1 FROM creator_wallets w WHERE w.user_id=oi.creator_id
      );
    DECLARE @credits TABLE (creator_id INT NOT NULL,net_amount INT NOT NULL);
    INSERT INTO creator_wallet_ledger
      (creator_id,order_id,order_item_id,event_key,event_type,gross_amount,commission_amount,net_amount,commission_rate_bps,note)
    OUTPUT INSERTED.creator_id,INSERTED.net_amount INTO @credits
    SELECT oi.creator_id,oi.order_id,oi.id,
      N'sale-'+CONVERT(NVARCHAR(20),oi.id),'sale',
      oi.price,oi.commission_amount,oi.creator_amount,oi.commission_rate_bps,N'Doanh thu bán công thức'
    FROM marketplace_order_items oi
    WHERE oi.order_id=? AND NOT EXISTS (
      SELECT 1 FROM creator_wallet_ledger l WITH (UPDLOCK,HOLDLOCK)
      WHERE l.event_key=N'sale-'+CONVERT(NVARCHAR(20),oi.id)
    );
    UPDATE w SET available_balance=available_balance+c.amount,
      total_earned=total_earned+c.amount,updated_at=GETDATE()
    FROM creator_wallets w
    JOIN (SELECT creator_id,SUM(net_amount) AS amount FROM @credits GROUP BY creator_id) c
      ON c.creator_id=w.user_id;
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, orderId, orderId, transactionRef || "", orderId, orderId, orderId, orderId);
  return { orderId, responseCode };
}

async function failMarketplacePayment(orderId, transactionRef) {
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE marketplace_payments SET status='failed',provider_txn_no=?
      WHERE order_id=? AND status='pending';
    IF @@ROWCOUNT>0
      UPDATE marketplace_orders SET status='failed'
        WHERE id=? AND status='pending';
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, transactionRef || "", orderId, orderId);
}

router.post("/mock-payment/:orderId", authRequired, wrap(async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.MOCK_COMMERCE_ENABLED !== "true")
    throw fail(503, "Thanh toán giả lập đang tắt trong production");
  const orderId = Number(req.params.orderId);
  const outcome = req.body.outcome;
  if (!validId(orderId) || !["success", "failure"].includes(outcome))
    throw fail(400, "Kết quả thanh toán giả lập không hợp lệ");
  const payment = await get(`
    SELECT p.*,o.user_id,o.status AS order_status
    FROM marketplace_payments p JOIN marketplace_orders o ON o.id=p.order_id
    WHERE o.id=? AND o.user_id=? AND p.provider IN ('vnpay_mock','momo_mock','zalopay_mock')
  `, orderId, req.user.id);
  if (!payment) throw fail(404, "Không tìm thấy giao dịch giả lập");
  if (payment.status === "paid" && payment.order_status === "paid")
    return res.json({ ok: true, alreadyPaid: true, orderId });
  if (payment.status !== "pending" || payment.order_status !== "pending")
    throw fail(409, "Đơn hàng không còn chờ thanh toán");
  if (outcome === "failure") {
    await failMarketplacePayment(orderId, `MOCK-${payment.provider}-DECLINED`);
    return res.json({ ok: true, status: "failed", orderId });
  }
  await settleMarketplacePayment(orderId, `MOCK-${payment.provider}-${orderId}`, "MOCK_APPROVED");
  log(req.user.id, "marketplace_mock_paid", `order #${orderId}; ${payment.provider}`);
  res.json({ ok: true, status: "paid", orderId });
}));

router.post("/grocery-checkout", authRequired, wrap(async (req, res) => {
  const config = requireVnpay();
  const recipientName = typeof req.body.recipientName === "string" ? req.body.recipientName.trim() : "";
  const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
  const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
  if (!recipientName || recipientName.length > 150 || !/^[0-9+().\-\s]{8,30}$/.test(phone) ||
      !address || address.length > 500 || note.length > 500)
    throw fail(400, "Vui lòng nhập tên, số điện thoại hợp lệ và địa chỉ giao hàng (tối đa 500 ký tự)");

  const activeOrder = await get(`
    SELECT TOP 1 id,total_amount FROM grocery_orders
    WHERE user_id=? AND status='pending' AND created_at>DATEADD(MINUTE,-15,GETDATE())
    ORDER BY created_at DESC
  `, req.user.id);
  if (activeOrder) {
    const ref = `G-${activeOrder.id}`;
    res.json({
      orderId: activeOrder.id,
      amount: activeOrder.total_amount,
      paymentUrl: buildPaymentUrl(activeOrder.id, activeOrder.total_amount, req, config, ref, "Thanh toan danh sach nguyen lieu"),
      resumed: true,
    });
    return;
  }
  await exec(`
    UPDATE grocery_orders SET status='expired' WHERE user_id=? AND status='pending'
      AND created_at<=DATEADD(MINUTE,-15,GETDATE());
    UPDATE grocery_payments SET status='expired' WHERE order_id IN (
      SELECT id FROM grocery_orders WHERE user_id=? AND status='expired'
    ) AND status='pending';
  `, req.user.id, req.user.id);

  const items = await query(`
    SELECT s.id,s.name,s.quantity,ISNULL(i.unit_price,0) AS price
    FROM shopping_items s LEFT JOIN ingredients i ON i.name=s.name
    WHERE s.user_id=? AND s.bought=0 ORDER BY s.id
  `, req.user.id);
  if (!items.length) throw fail(400, "Danh sách không có nguyên liệu chưa mua");
  const unpriced = [...new Set(items.filter((item) => Number(item.price) <= 0).map((item) => item.name))];
  if (unpriced.length)
    throw fail(400, `Chưa có giá trong catalog cho: ${unpriced.slice(0, 5).join(", ")}. Hãy liên hệ Admin cập nhật giá.`);
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  if (!Number.isSafeInteger(total) || total < 5000 || total > 99999999)
    throw fail(400, "Tổng tiền phải từ 5.000 đến 99.999.999 VNĐ để thanh toán qua VNPay");

  const orderId = Number((await exec(`
    INSERT INTO grocery_orders
      (user_id,recipient_name,phone,delivery_address,delivery_note,total_amount,status)
    VALUES (?,?,?,?,?,?,?)
  `, req.user.id, recipientName, phone, address, note, total, "pending")).insertId);
  if (!orderId) throw new Error("Không tạo được đơn nguyên liệu");
  try {
    for (const item of items) {
      await exec(
        "INSERT INTO grocery_order_items (order_id,shopping_item_id,name,quantity,price) VALUES (?,?,?,?,?)",
        orderId, item.id, item.name, item.quantity || "", item.price,
      );
    }
    await exec(
      "INSERT INTO grocery_payments (order_id,provider,txn_ref,amount,status) VALUES (?,?,?,?,?)",
      orderId, "vnpay", `G-${orderId}`, total, "pending",
    );
  } catch (error) {
    await exec("UPDATE grocery_orders SET status='failed' WHERE id=? AND status='pending'", orderId);
    throw error;
  }
  log(req.user.id, "grocery_checkout", `order #${orderId}; ${amountText(total)}`);
  res.json({
    orderId,
    amount: total,
    paymentUrl: buildPaymentUrl(orderId, total, req, config, `G-${orderId}`, "Thanh toan danh sach nguyen lieu"),
  });
}));

async function verifyVnpayResult(params) {
  const { secret, tmnCode } = requireVnpay();
  if (!safeEqualHex(params.vnp_SecureHash, signParams(params, secret)))
    throw fail(400, "Chữ ký giao dịch không hợp lệ");
  if (params.vnp_TmnCode !== tmnCode) throw fail(400, "Mã Merchant VNPay không hợp lệ");
  const txnRef = String(params.vnp_TxnRef || "");
  const isGrocery = txnRef.startsWith("G-");
  const orderId = Number(isGrocery ? txnRef.slice(2) : txnRef);
  if (!Number.isInteger(orderId) || orderId < 1) throw fail(400, "Mã đơn hàng không hợp lệ");
  const payment = isGrocery
    ? await get(`
      SELECT p.*,o.user_id,o.status AS order_status
      FROM grocery_payments p JOIN grocery_orders o ON o.id=p.order_id
      WHERE p.order_id=? AND p.provider='vnpay'
    `, orderId)
    : await get(`
      SELECT p.*,o.user_id,o.status AS order_status
      FROM marketplace_payments p JOIN marketplace_orders o ON o.id=p.order_id
      WHERE p.order_id=? AND p.provider='vnpay'
    `, orderId);
  if (!payment || Number(params.vnp_Amount) !== Number(payment.amount) * 100)
    throw fail(400, "Số tiền giao dịch không khớp với đơn hàng");
  return {
    payment,
    orderId,
    isGrocery,
    success: params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00",
  };
}

async function applyVnpayResult(params) {
  const result = await verifyVnpayResult(params);
  const { payment, orderId } = result;
  if (payment.status === "paid" && payment.order_status === "paid")
    return { success: true, orderId, isGrocery: result.isGrocery };
  if (payment.status !== "pending" || payment.order_status !== "pending")
    return { success: false, orderId, isGrocery: result.isGrocery };
  if (result.success) {
    if (result.isGrocery) {
      await exec(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRANSACTION;
          UPDATE grocery_payments SET status='paid',provider_txn_no=?,paid_at=GETDATE()
            WHERE order_id=? AND status='pending';
          UPDATE grocery_orders SET status='paid',paid_at=GETDATE()
            WHERE id=? AND status='pending';
          UPDATE shopping_items SET bought=1
            WHERE id IN (SELECT shopping_item_id FROM grocery_order_items WHERE order_id=?)
              AND user_id=(SELECT user_id FROM grocery_orders WHERE id=?)
              AND EXISTS (SELECT 1 FROM grocery_orders WHERE id=? AND status='paid');
          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH
      `, params.vnp_TransactionNo || "", orderId, orderId, orderId, orderId, orderId);
      return { success: true, orderId, isGrocery: true };
    }
    await settleMarketplacePayment(orderId, params.vnp_TransactionNo || "", params.vnp_ResponseCode);
    return { success: true, orderId };
  }
  if (result.isGrocery) {
    await exec(`
      UPDATE grocery_payments SET status='failed',provider_txn_no=?
        WHERE order_id=? AND status='pending';
      UPDATE grocery_orders SET status='failed'
        WHERE id=? AND status='pending';
    `, params.vnp_TransactionNo || "", orderId, orderId);
  } else {
    await failMarketplacePayment(orderId, params.vnp_TransactionNo || "");
  }
  return { success: false, orderId, isGrocery: result.isGrocery };
}

router.get("/vnpay/return", wrap(async (req, res) => {
  try {
    const result = await verifyVnpayResult(req.query);
    const state = result.payment.status === "paid"
      ? "success"
      : result.success ? "pending" : "failed";
    res.redirect(result.isGrocery
      ? `/#/shopping?payment=${state}&order=${result.orderId}`
      : `/#/purchases?payment=${state}&order=${result.orderId}`);
  } catch (error) {
    const message = error.status && error.status < 500
      ? error.message
      : "Không thể xác minh giao dịch lúc này. Vui lòng tải lại sau.";
    const isGrocery = String(req.query.vnp_TxnRef || "").startsWith("G-");
    res.redirect(`${isGrocery ? "/#/shopping" : "/#/purchases"}?payment=invalid&message=${encodeURIComponent(message)}`);
  }
}));

router.get("/grocery-orders", authRequired, wrap(async (req, res) => {
  await exec(`
    UPDATE grocery_orders SET status='expired'
      WHERE user_id=? AND status='pending' AND created_at<=DATEADD(MINUTE,-15,GETDATE());
    UPDATE grocery_payments SET status='expired'
      WHERE status='pending' AND order_id IN (
        SELECT id FROM grocery_orders WHERE user_id=? AND status='expired'
      );
  `, req.user.id, req.user.id);
  const orders = await query(`
    SELECT id,total_amount,status,recipient_name,phone,delivery_address,delivery_note,created_at,paid_at
    FROM grocery_orders WHERE user_id=? ORDER BY created_at DESC
  `, req.user.id);
  for (const order of orders) {
    order.items = await query(
      "SELECT name,quantity,price FROM grocery_order_items WHERE order_id=? ORDER BY id",
      order.id,
    );
  }
  res.json(orders);
}));

router.get("/vnpay/ipn", wrap(async (req, res) => {
  try {
    await applyVnpayResult(req.query);
    res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    res.status(200).json({ RspCode: error.status === 400 ? "97" : "99", Message: "Invalid signature or transaction" });
  }
}));

router.get("/purchases", authRequired, wrap(async (req, res) => {
  res.json(await query(`
    SELECT p.recipe_id,r.title,r.image,p.order_id,p.purchased_at,oi.price,
      u.username AS creator_username
    FROM purchased_recipes p
    JOIN recipes r ON r.id=p.recipe_id
    JOIN marketplace_order_items oi ON oi.order_id=p.order_id AND oi.recipe_id=p.recipe_id
    JOIN users u ON u.id=oi.creator_id
    WHERE p.user_id=? ORDER BY p.purchased_at DESC
  `, req.user.id));
}));

router.get("/creator/sales", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới xem được doanh thu");
  res.json(await query(`
    SELECT oi.order_id,oi.recipe_id,r.title,oi.price,oi.commission_rate_bps,
      oi.commission_amount,oi.creator_amount,p.purchased_at
    FROM marketplace_order_items oi
    JOIN purchased_recipes p ON p.order_id=oi.order_id AND p.recipe_id=oi.recipe_id
    JOIN recipes r ON r.id=oi.recipe_id
    WHERE oi.creator_id=? ORDER BY p.purchased_at DESC
  `, req.user.id));
}));

router.get("/creator/recipes", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới xem được công thức của người bán");
  res.json(await query(`
    SELECT id,title,is_premium,price,is_public,approved,created_at
    FROM recipes WHERE user_id=? ORDER BY created_at DESC
  `, req.user.id));
}));

router.post("/creator/recipes/:recipeId/withdraw", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới thu hồi được công thức Premium");
  if (!validId(req.params.recipeId)) throw fail(400, "Công thức không hợp lệ");
  const recipe = await get(
    "SELECT id,user_id,is_premium FROM recipes WHERE id=?",
    Number(req.params.recipeId),
  );
  if (!recipe) throw fail(404, "Không tìm thấy công thức");
  if (recipe.user_id !== req.user.id && req.user.role !== "admin")
    throw fail(403, "Bạn chỉ có thể thu hồi công thức của mình");
  if (!recipe.is_premium) throw fail(409, "Công thức này không còn được đăng bán Premium");
  await exec(
    "UPDATE recipes SET is_premium=0,price=0,approved=1 WHERE id=? AND is_premium=1",
    recipe.id,
  );
  log(req.user.id, "withdraw_premium_recipe", `recipe #${recipe.id}`);
  res.json({ ok: true, recipeId: recipe.id, status: "free" });
}));

router.get("/creator/wallet", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới có ví doanh thu");
  await exec(`
    IF NOT EXISTS (SELECT 1 FROM creator_wallets WHERE user_id=?)
      INSERT INTO creator_wallets (user_id) VALUES (?)
  `, req.user.id, req.user.id);
  const [wallet, ledger, withdrawals, profile] = await Promise.all([
    get("SELECT * FROM creator_wallets WHERE user_id=?", req.user.id),
    query(`
      SELECT TOP 100 event_type,gross_amount,commission_amount,net_amount,commission_rate_bps,note,created_at
      FROM creator_wallet_ledger WHERE creator_id=? ORDER BY id DESC
    `, req.user.id),
    query(`
      SELECT TOP 30 id,amount,bank_name,bank_account,account_name,status,admin_note,created_at,updated_at
      FROM creator_withdrawals WHERE creator_id=? ORDER BY id DESC
    `, req.user.id),
    get("SELECT bank_name,bank_account,account_name FROM creator_profiles WHERE user_id=?", req.user.id),
  ]);
  res.json({ wallet, ledger, withdrawals, bank: profile || {} });
}));

router.put("/creator/bank-account", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới cập nhật được thông tin nhận tiền");
  const bankName = typeof req.body.bank_name === "string" ? req.body.bank_name.trim() : "";
  const bankAccount = typeof req.body.bank_account === "string" ? req.body.bank_account.trim() : "";
  const accountName = typeof req.body.account_name === "string" ? req.body.account_name.trim() : "";
  if (!bankName || bankName.length > 100 || !/^[0-9A-Za-z\- ]{5,100}$/.test(bankAccount) ||
      !accountName || accountName.length > 150)
    throw fail(400, "Thông tin ngân hàng không hợp lệ");
  await exec(`
    IF EXISTS (SELECT 1 FROM creator_profiles WHERE user_id=?)
      UPDATE creator_profiles SET bank_name=?,bank_account=?,account_name=? WHERE user_id=?
    ELSE INSERT INTO creator_profiles (user_id,bank_name,bank_account,account_name) VALUES (?,?,?,?)
  `, req.user.id, bankName, bankAccount, accountName, req.user.id,
  req.user.id, bankName, bankAccount, accountName);
  res.json({ ok: true });
}));

router.post("/creator/withdrawals", authRequired, wrap(async (req, res) => {
  if (!["creator", "admin"].includes(req.user.role)) throw fail(403, "Chỉ Creator mới được yêu cầu rút tiền");
  const amount = Number(req.body.amount);
  if (!Number.isSafeInteger(amount) || amount < 50000 || amount > 99999999)
    throw fail(400, "Số tiền rút tối thiểu là 50.000 VNĐ");
  const profile = await get(
    "SELECT bank_name,bank_account,account_name FROM creator_profiles WHERE user_id=?",
    req.user.id,
  );
  if (!profile || !profile.bank_name || !profile.bank_account || !profile.account_name)
    throw fail(400, "Hãy lưu thông tin tài khoản ngân hàng trước khi yêu cầu rút tiền");
  const created = await query(`
    SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    IF NOT EXISTS (SELECT 1 FROM creator_wallets WITH (UPDLOCK,HOLDLOCK) WHERE user_id=?)
      INSERT INTO creator_wallets (user_id) VALUES (?);
    UPDATE creator_wallets SET available_balance=available_balance-?,
      held_balance=held_balance+?,updated_at=GETDATE()
      WHERE user_id=? AND available_balance>=?;
    IF @@ROWCOUNT=0 THROW 51020,'Số dư khả dụng không đủ.',1;
    DECLARE @request TABLE (id INT);
    INSERT INTO creator_withdrawals
      (creator_id,amount,bank_name,bank_account,account_name,status)
    OUTPUT INSERTED.id INTO @request
    VALUES (?,?,?,?,?,'pending');
    INSERT INTO creator_wallet_ledger
      (creator_id,event_key,event_type,gross_amount,commission_amount,net_amount,commission_rate_bps,note)
    SELECT ?,N'withdraw-request-'+CONVERT(NVARCHAR(20),id),'withdrawal_hold',
      ?,0,-?,0,N'Giữ số dư theo yêu cầu rút tiền'
    FROM @request;
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
    SELECT id FROM @request;
  `,
  req.user.id, req.user.id, amount, amount, req.user.id, amount,
  req.user.id, amount, profile.bank_name, profile.bank_account, profile.account_name,
  req.user.id, amount, amount);
  res.status(201).json({ ok: true, withdrawalId: created[0]?.id });
}));

module.exports = router;
module.exports.schemaReady = schemaReady;
