const crypto = require("crypto");

const paymentProviders = Object.freeze({
  vnpay: { name: "VNPay", mode: "mock" },
  momo: { name: "MoMo", mode: "mock" },
  zalopay: { name: "ZaloPay", mode: "mock" },
});

const shippingProviders = Object.freeze({
  ghn: { name: "GHN", fee: 30000 },
  ghtk: { name: "GHTK", fee: 25000 },
});

const suppliers = [
  { code: "KIOTVIET", name: "KiotViet (mô phỏng)", provider: "kiotviet" },
  { code: "NHANH", name: "Nhanh.vn (mô phỏng)", provider: "nhanh" },
  { code: "SAPO", name: "Sapo (mô phỏng)", provider: "sapo" },
  { code: "HARAVAN", name: "Haravan (mô phỏng)", provider: "haravan" },
  { code: "MISA", name: "MISA CUKCUK (mô phỏng)", provider: "misa" },
];

const sampleProducts = [
  ["KIOTVIET", "KV-RICE-01", "Gạo ST25", "túi 5 kg", 125000, 30],
  ["KIOTVIET", "KV-EGG-01", "Trứng gà sạch", "vỉ 10 quả", 35000, 50],
  ["KIOTVIET", "KV-TOMATO-01", "Cà chua Đà Lạt", "khay 500 g", 22000, 40],
  ["NHANH", "NH-CHICKEN-01", "Ức gà tươi", "khay 500 g", 59000, 25],
  ["NHANH", "NH-ONION-01", "Hành tây", "túi 500 g", 18000, 35],
  ["NHANH", "NH-MILK-01", "Sữa tươi không đường", "hộp 1 lít", 33000, 45],
  ["SAPO", "SP-SALMON-01", "Cá hồi phi lê", "khay 300 g", 145000, 18],
  ["SAPO", "SP-CREAM-01", "Kem tươi", "hộp 200 ml", 42000, 24],
  ["SAPO", "SP-BUTTER-01", "Bơ lạt", "hộp 200 g", 55000, 20],
  ["HARAVAN", "HV-NOODLE-01", "Mì trứng", "gói 500 g", 28000, 40],
  ["HARAVAN", "HV-MUSHROOM-01", "Nấm đùi gà", "khay 300 g", 32000, 30],
  ["HARAVAN", "HV-TOFU-01", "Đậu hũ non", "hộp 300 g", 16000, 32],
  ["MISA", "MS-SHRIMP-01", "Tôm sú bóc nõn", "khay 300 g", 89000, 16],
  ["MISA", "MS-LETTUCE-01", "Xà lách thủy canh", "túi 250 g", 26000, 28],
  ["MISA", "MS-OLIVEOIL-01", "Dầu ô liu", "chai 250 ml", 99000, 14],
];

function createPayment(provider, orderId) {
  const adapter = paymentProviders[provider];
  if (!adapter) throw new Error("Cổng thanh toán mô phỏng không được hỗ trợ");
  return {
    reference: `MOCK-${provider.toUpperCase()}-${orderId}-${crypto.randomBytes(6).toString("hex")}`,
    redirectPath: `/#/mock-payment/${orderId}?provider=${provider}`,
    providerName: adapter.name,
  };
}

function createShipment(provider, orderId) {
  if (!shippingProviders[provider]) throw new Error("Đơn vị vận chuyển mô phỏng không được hỗ trợ");
  const prefix = provider === "ghn" ? "GHN" : "GHTK";
  return {
    trackingNumber: `${prefix}${String(orderId).padStart(8, "0")}${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    status: "ready",
    description: "Đơn hàng đã được tạo trên hệ thống vận chuyển mô phỏng",
  };
}

const shipmentTransitions = Object.freeze({
  ready: { next: "picked_up", label: "Đơn đã được lấy hàng" },
  picked_up: { next: "in_transit", label: "Đơn đang vận chuyển" },
  in_transit: { next: "delivered", label: "Đã giao hàng" },
});

module.exports = {
  paymentProviders,
  shippingProviders,
  suppliers,
  sampleProducts,
  createPayment,
  createShipment,
  shipmentTransitions,
};
