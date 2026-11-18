const assert = require("node:assert/strict");
const test = require("node:test");
const commerce = require("./mock");

test("mock catalog contains five suppliers and unique packaged products", () => {
  assert.equal(commerce.suppliers.length, 5);
  assert.equal(commerce.sampleProducts.length, 15);
  assert.deepEqual(
    new Set(commerce.sampleProducts.map(([supplier]) => supplier)),
    new Set(commerce.suppliers.map((supplier) => supplier.code)),
  );
  assert.equal(
    new Set(commerce.sampleProducts.map(([, sku]) => sku)).size,
    commerce.sampleProducts.length,
  );
});

test("all three payment adapters create distinct mock references", () => {
  const references = Object.keys(commerce.paymentProviders).map((provider) =>
    commerce.createPayment(provider, 42).reference,
  );
  assert.equal(new Set(references).size, references.length);
  assert.ok(references.every((reference) => reference.startsWith("MOCK-")));
  assert.throws(() => commerce.createPayment("unknown", 42), /không được hỗ trợ/);
});

test("GHN and GHTK adapters create trackable mock shipments", () => {
  const ghn = commerce.createShipment("ghn", 42);
  const ghtk = commerce.createShipment("ghtk", 42);
  assert.match(ghn.trackingNumber, /^GHN/);
  assert.match(ghtk.trackingNumber, /^GHTK/);
  assert.equal(ghn.status, "ready");
  assert.throws(() => commerce.createShipment("unknown", 42), /không được hỗ trợ/);
});

test("mock shipping lifecycle ends at delivered", () => {
  assert.equal(commerce.shipmentTransitions.ready.next, "picked_up");
  assert.equal(commerce.shipmentTransitions.picked_up.next, "in_transit");
  assert.equal(commerce.shipmentTransitions.in_transit.next, "delivered");
  assert.equal(commerce.shipmentTransitions.delivered, undefined);
});
