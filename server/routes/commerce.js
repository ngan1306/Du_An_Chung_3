const express = require("express");
const { query, exec, get } = require("../db/database");
const { authRequired, log } = require("../middleware");
const { schemaReady: marketplaceSchemaReady } = require("./marketplace");
const mock = require("../providers/commerce/mock");

const router = express.Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((error) =>
    res.status(error.status || 500).json({ error: error.message || "Lỗi máy chủ" }),
  );
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const mockPaymentsEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.MOCK_COMMERCE_ENABLED === "true";

async function seedCatalog() {
  for (const supplier of mock.suppliers) {
    await exec(
      `IF NOT EXISTS (SELECT 1 FROM commerce_suppliers WHERE code=?)
         INSERT INTO commerce_suppliers (code,name,provider_key,is_active) VALUES (?,?,?,1)`,
      supplier.code, supplier.code, supplier.name, supplier.provider,
    );
  }
  for (const [supplierCode, sku, name, unit, price, stock] of mock.sampleProducts) {
    const supplier = await get("SELECT id FROM commerce_suppliers WHERE code=?", supplierCode);
    await exec(
      `IF NOT EXISTS (SELECT 1 FROM commerce_products WHERE sku=?)
         INSERT INTO commerce_products (supplier_id,sku,name,unit,price,stock_on_hand,reserved_quantity,is_active)
         VALUES (?,?,?,?,?,?,0,1)`,
      sku, supplier.id, sku, name, unit, price, stock,
    );
  }
}

const schemaReady = (async () => {
  await marketplaceSchemaReady;
  await exec(`
    IF OBJECT_ID('commerce_suppliers','U') IS NULL
      CREATE TABLE commerce_suppliers (
        id INT IDENTITY PRIMARY KEY,
        code NVARCHAR(40) NOT NULL UNIQUE,
        name NVARCHAR(150) NOT NULL,
        provider_key NVARCHAR(40) NOT NULL,
        is_active BIT NOT NULL DEFAULT(1),
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('commerce_products','U') IS NULL
      CREATE TABLE commerce_products (
        id INT IDENTITY PRIMARY KEY,
        supplier_id INT NOT NULL REFERENCES commerce_suppliers(id),
        sku NVARCHAR(80) NOT NULL UNIQUE,
        name NVARCHAR(150) NOT NULL,
        unit NVARCHAR(50) NOT NULL,
        price INT NOT NULL,
        stock_on_hand INT NOT NULL DEFAULT(0),
        reserved_quantity INT NOT NULL DEFAULT(0),
        is_active BIT NOT NULL DEFAULT(1),
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('commerce_cart_items','U') IS NULL
      CREATE TABLE commerce_cart_items (
        user_id INT NOT NULL REFERENCES users(id),
        product_id INT NOT NULL REFERENCES commerce_products(id),
        quantity INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_commerce_cart_items PRIMARY KEY(user_id,product_id)
      );
    IF OBJECT_ID('commerce_orders','U') IS NULL
      CREATE TABLE commerce_orders (
        id INT IDENTITY PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id),
        recipient_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(30) NOT NULL,
        delivery_address NVARCHAR(500) NOT NULL,
        delivery_note NVARCHAR(500) NOT NULL DEFAULT '',
        payment_provider NVARCHAR(20) NOT NULL,
        shipping_provider NVARCHAR(20) NOT NULL,
        subtotal INT NOT NULL,
        shipping_fee INT NOT NULL,
        total_amount INT NOT NULL,
        status NVARCHAR(24) NOT NULL DEFAULT 'pending_payment',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL,
        refunded_at DATETIME NULL
      );
    IF OBJECT_ID('commerce_order_items','U') IS NULL
      CREATE TABLE commerce_order_items (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES commerce_orders(id),
        product_id INT NOT NULL REFERENCES commerce_products(id),
        supplier_name NVARCHAR(150) NOT NULL,
        sku NVARCHAR(80) NOT NULL,
        product_name NVARCHAR(150) NOT NULL,
        unit NVARCHAR(50) NOT NULL,
        quantity INT NOT NULL,
        unit_price INT NOT NULL,
        line_total INT NOT NULL
      );
    IF OBJECT_ID('commerce_payments','U') IS NULL
      CREATE TABLE commerce_payments (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL REFERENCES commerce_orders(id),
        provider NVARCHAR(20) NOT NULL,
        reference NVARCHAR(100) NOT NULL UNIQUE,
        amount INT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending',
        transaction_ref NVARCHAR(100) NOT NULL DEFAULT '',
        response_code NVARCHAR(30) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL,
        refunded_at DATETIME NULL
      );
    IF OBJECT_ID('commerce_shipments','U') IS NULL
      CREATE TABLE commerce_shipments (
        id INT IDENTITY PRIMARY KEY,
        order_id INT NOT NULL UNIQUE REFERENCES commerce_orders(id),
        provider NVARCHAR(20) NOT NULL,
        tracking_number NVARCHAR(100) NOT NULL UNIQUE,
        status NVARCHAR(24) NOT NULL,
        shipping_fee INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
    IF OBJECT_ID('commerce_shipment_events','U') IS NULL
      CREATE TABLE commerce_shipment_events (
        id INT IDENTITY PRIMARY KEY,
        shipment_id INT NOT NULL REFERENCES commerce_shipments(id),
        status NVARCHAR(24) NOT NULL,
        description NVARCHAR(300) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
  await seedCatalog();
})();

router.use(async (_req, _res, next) => {
  try {
    await schemaReady;
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/providers", (_req, res) => {
  res.json({
    payments: Object.entries(mock.paymentProviders).map(([id, provider]) => ({ id, name: provider.name, mode: provider.mode })),
    shipping: Object.entries(mock.shippingProviders).map(([id, provider]) => ({ id, name: provider.name, fee: provider.fee })),
  });
});

router.get("/suppliers", wrap(async (_req, res) => {
  res.json(await query(`
    SELECT s.id,s.code,s.name,s.provider_key,
      (SELECT COUNT(*) FROM commerce_products p WHERE p.supplier_id=s.id AND p.is_active=1) AS product_count
    FROM commerce_suppliers s WHERE s.is_active=1 ORDER BY s.name
  `));
}));

router.get("/products", wrap(async (req, res) => {
  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const supplierId = req.query.supplierId && validId(req.query.supplierId) ? Number(req.query.supplierId) : null;
  const clauses = ["p.is_active=1", "s.is_active=1"];
  const params = [];
  if (supplierId) {
    clauses.push("p.supplier_id=?");
    params.push(supplierId);
  }
  if (search) {
    clauses.push("(p.name LIKE ? OR p.sku LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  res.json(await query(`
    SELECT p.id,p.supplier_id,s.name AS supplier_name,p.sku,p.name,p.unit,p.price,
      p.stock_on_hand-p.reserved_quantity AS available_stock
    FROM commerce_products p JOIN commerce_suppliers s ON s.id=p.supplier_id
    WHERE ${clauses.join(" AND ")} ORDER BY s.name,p.name
  `, params));
}));

router.get("/cart", authRequired, wrap(async (req, res) => {
  res.json(await query(`
    SELECT c.product_id,c.quantity,p.sku,p.name,p.unit,p.price,
      p.stock_on_hand-p.reserved_quantity AS available_stock,s.name AS supplier_name
    FROM commerce_cart_items c
    JOIN commerce_products p ON p.id=c.product_id
    JOIN commerce_suppliers s ON s.id=p.supplier_id
    WHERE c.user_id=? ORDER BY c.created_at
  `, req.user.id));
}));

router.post("/cart", authRequired, wrap(async (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity);
  if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw fail(400, "Sản phẩm hoặc số lượng không hợp lệ");
  const product = await get(`
    SELECT p.id,p.stock_on_hand-p.reserved_quantity AS available_stock
    FROM commerce_products p JOIN commerce_suppliers s ON s.id=p.supplier_id
    WHERE p.id=? AND p.is_active=1 AND s.is_active=1
  `, productId);
  if (!product) throw fail(404, "Sản phẩm không tồn tại hoặc đã ngừng bán");
  const current = await get("SELECT quantity FROM commerce_cart_items WHERE user_id=? AND product_id=?", req.user.id, productId);
  if (quantity + Number(current?.quantity || 0) > Number(product.available_stock))
    throw fail(409, "Số lượng vượt quá tồn kho khả dụng");
  await exec(`
    IF EXISTS (SELECT 1 FROM commerce_cart_items WHERE user_id=? AND product_id=?)
      UPDATE commerce_cart_items SET quantity=quantity+? WHERE user_id=? AND product_id=?
    ELSE INSERT INTO commerce_cart_items (user_id,product_id,quantity) VALUES (?,?,?)
  `, req.user.id, productId, quantity, req.user.id, productId, req.user.id, productId, quantity);
  res.status(201).json({ ok: true });
}));

router.put("/cart/:productId", authRequired, wrap(async (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body.quantity);
  if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    throw fail(400, "Số lượng không hợp lệ");
  const product = await get(`
    SELECT p.stock_on_hand-p.reserved_quantity AS available_stock
    FROM commerce_products p WHERE p.id=? AND p.is_active=1
  `, productId);
  if (!product) throw fail(404, "Không tìm thấy sản phẩm");
  if (quantity > Number(product.available_stock)) throw fail(409, "Số lượng vượt quá tồn kho khả dụng");
  if (!await get("SELECT 1 x FROM commerce_cart_items WHERE user_id=? AND product_id=?", req.user.id, productId))
    throw fail(404, "Sản phẩm không có trong giỏ hàng");
  await exec(
    "UPDATE commerce_cart_items SET quantity=? WHERE user_id=? AND product_id=?",
    quantity, req.user.id, productId,
  );
  res.json({ ok: true });
}));

router.delete("/cart/:productId", authRequired, wrap(async (req, res) => {
  await exec("DELETE FROM commerce_cart_items WHERE user_id=? AND product_id=?", req.user.id, Number(req.params.productId));
  res.json({ ok: true });
}));

router.post("/checkout", authRequired, wrap(async (req, res) => {
  if (!mockPaymentsEnabled()) throw fail(503, "Thanh toán mô phỏng chỉ khả dụng ngoài môi trường production");
  const paymentProvider = req.body.paymentProvider;
  const shippingProvider = req.body.shippingProvider;
  const payment = mock.paymentProviders[paymentProvider];
  const shipping = mock.shippingProviders[shippingProvider];
  if (!payment || !shipping) throw fail(400, "Hãy chọn cổng thanh toán và đơn vị vận chuyển hợp lệ");
  const recipientName = typeof req.body.recipientName === "string" ? req.body.recipientName.trim() : "";
  const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
  const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
  if (!recipientName || recipientName.length > 150 || !/^[0-9+().\-\s]{8,30}$/.test(phone) ||
      !address || address.length > 500 || note.length > 500)
    throw fail(400, "Thông tin người nhận, số điện thoại hoặc địa chỉ giao hàng không hợp lệ");
  const items = await query(`
    SELECT c.product_id,c.quantity,p.sku,p.name,p.unit,p.price,
      p.stock_on_hand-p.reserved_quantity AS available_stock,s.name AS supplier_name
    FROM commerce_cart_items c
    JOIN commerce_products p ON p.id=c.product_id
    JOIN commerce_suppliers s ON s.id=p.supplier_id
    WHERE c.user_id=? AND p.is_active=1 AND s.is_active=1
  `, req.user.id);
  if (!items.length) throw fail(400, "Giỏ hàng đang trống");
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const total = subtotal + shipping.fee;
  if (!Number.isSafeInteger(total) || total < 1000 || total > 99999999)
    throw fail(400, "Tổng đơn phải từ 1.000 đến 99.999.999 VNĐ");

  const orderId = Number((await exec(`
    INSERT INTO commerce_orders
      (user_id,recipient_name,phone,delivery_address,delivery_note,payment_provider,shipping_provider,subtotal,shipping_fee,total_amount,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `, req.user.id, recipientName, phone, address, note, paymentProvider, shippingProvider,
  subtotal, shipping.fee, total, "pending_payment")).insertId);
  if (!orderId) throw new Error("Không tạo được đơn hàng");
  const mockPayment = mock.createPayment(paymentProvider, orderId);
  const statements = [
    "SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;",
  ];
  const params = [];
  for (const item of items) {
    statements.push(`
      UPDATE commerce_products WITH (UPDLOCK,ROWLOCK)
        SET reserved_quantity=reserved_quantity+?
        WHERE id=? AND is_active=1 AND price=? AND stock_on_hand-reserved_quantity>=?;
      IF @@ROWCOUNT=0 THROW 51001,'Tồn kho hoặc giá sản phẩm vừa thay đổi.',1;
      INSERT INTO commerce_order_items
        (order_id,product_id,supplier_name,sku,product_name,unit,quantity,unit_price,line_total)
      VALUES (?,?,?,?,?,?,?,?,?);
    `);
    params.push(item.quantity, item.product_id, item.price, item.quantity);
    params.push(orderId, item.product_id, item.supplier_name, item.sku, item.name, item.unit,
      item.quantity, item.price, Number(item.quantity) * Number(item.price));
  }
  statements.push(`
    INSERT INTO commerce_payments (order_id,provider,reference,amount,status)
    VALUES (?,?,?,?,?);
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `);
  params.push(orderId, paymentProvider, mockPayment.reference, total, "pending");
  try {
    await exec(statements.join("\n"), params);
  } catch (error) {
    await exec("UPDATE commerce_orders SET status='cancelled' WHERE id=? AND status='pending_payment'", orderId);
    throw error;
  }
  log(req.user.id, "commerce_checkout", `order #${orderId}; ${total} VND`);
  res.status(201).json({
    orderId,
    amount: total,
    paymentProvider: mockPayment.providerName,
    paymentUrl: mockPayment.redirectPath,
  });
}));

router.post("/orders/:id/mock-payment", authRequired, wrap(async (req, res) => {
  if (!mockPaymentsEnabled()) throw fail(503, "Thanh toán mô phỏng bị tắt trong production");
  const orderId = Number(req.params.id);
  const outcome = req.body.outcome;
  if (!validId(orderId) || !["success", "failure"].includes(outcome))
    throw fail(400, "Kết quả thanh toán mô phỏng không hợp lệ");
  const order = await get(`
    SELECT o.*,p.id AS payment_id,p.status AS payment_status,p.provider
    FROM commerce_orders o JOIN commerce_payments p ON p.order_id=o.id
    WHERE o.id=? AND o.user_id=?
  `, orderId, req.user.id);
  if (!order) throw fail(404, "Không tìm thấy đơn hàng");
  if (order.status === "paid" && order.payment_status === "paid")
    return res.json({ ok: true, alreadyPaid: true, orderId });
  if (order.status !== "pending_payment" || order.payment_status !== "pending")
    throw fail(409, "Đơn hàng không còn chờ thanh toán");

  if (outcome === "failure") {
    await exec(`
      SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
      UPDATE commerce_payments SET status='failed',response_code='MOCK_DECLINED'
        WHERE id=? AND status='pending';
      UPDATE commerce_orders SET status='payment_failed'
        WHERE id=? AND status='pending_payment';
      UPDATE p SET reserved_quantity=reserved_quantity-oi.quantity
        FROM commerce_products p JOIN commerce_order_items oi ON oi.product_id=p.id
        WHERE oi.order_id=? AND p.reserved_quantity>=oi.quantity;
      INSERT INTO commerce_shipment_events (shipment_id,status,description)
        SELECT s.id,'payment_failed','Thanh toán mô phỏng thất bại'
        FROM commerce_shipments s WHERE s.order_id=?;
      COMMIT TRANSACTION;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
    `, order.payment_id, orderId, orderId, orderId);
    return res.json({ ok: true, status: "payment_failed", orderId });
  }

  const shipment = mock.createShipment(order.shipping_provider, orderId);
  await exec(`
    SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
    UPDATE commerce_payments SET status='paid',response_code='MOCK_APPROVED',
      transaction_ref=?,paid_at=GETDATE()
      WHERE id=? AND status='pending';
    IF @@ROWCOUNT=0 THROW 51002,'Thanh toán đã được xử lý.',1;
    UPDATE commerce_orders SET status='paid',paid_at=GETDATE()
      WHERE id=? AND status='pending_payment';
    UPDATE p SET stock_on_hand=stock_on_hand-oi.quantity,
      reserved_quantity=reserved_quantity-oi.quantity
      FROM commerce_products p JOIN commerce_order_items oi ON oi.product_id=p.id
      WHERE oi.order_id=? AND p.stock_on_hand>=oi.quantity
        AND p.reserved_quantity>=oi.quantity;
    IF @@ROWCOUNT<>(SELECT COUNT(*) FROM commerce_order_items WHERE order_id=?)
      THROW 51003,'Không thể xác nhận tồn kho đã giữ.',1;
    INSERT INTO commerce_shipments (order_id,provider,tracking_number,status,shipping_fee)
      VALUES (?,?,?,?,?);
    INSERT INTO commerce_shipment_events (shipment_id,status,description)
      SELECT id,?,? FROM commerce_shipments WHERE order_id=?;
    DELETE c FROM commerce_cart_items c
      JOIN commerce_order_items oi ON oi.product_id=c.product_id
      WHERE oi.order_id=? AND c.user_id=?;
    COMMIT TRANSACTION;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
  `, shipment.trackingNumber, order.payment_id, orderId, orderId, orderId,
  orderId, order.shipping_provider, shipment.trackingNumber, shipment.status, order.shipping_fee,
  shipment.status, shipment.description, orderId, orderId, req.user.id);
  log(req.user.id, "commerce_payment_mock_paid", `order #${orderId}; ${order.provider}`);
  res.json({ ok: true, status: "paid", orderId, trackingNumber: shipment.trackingNumber });
}));

router.get("/orders", authRequired, wrap(async (req, res) => {
  const orders = await query(`
    SELECT o.*,p.provider AS payment_provider,p.status AS payment_status,p.reference AS payment_reference,
      s.id AS shipment_id,s.provider AS shipment_provider,s.tracking_number,s.status AS shipment_status
    FROM commerce_orders o
    LEFT JOIN commerce_payments p ON p.order_id=o.id
    LEFT JOIN commerce_shipments s ON s.order_id=o.id
    WHERE o.user_id=? ORDER BY o.created_at DESC
  `, req.user.id);
  for (const order of orders) {
    order.items = await query(`
      SELECT sku,product_name AS name,unit,quantity,unit_price,line_total,supplier_name
      FROM commerce_order_items WHERE order_id=? ORDER BY id
    `, order.id);
    order.shipment_events = order.shipment_id
      ? await query("SELECT status,description,created_at FROM commerce_shipment_events WHERE shipment_id=? ORDER BY id", order.shipment_id)
      : [];
  }
  res.json(orders);
}));

module.exports = router;
module.exports.schemaReady = schemaReady;
