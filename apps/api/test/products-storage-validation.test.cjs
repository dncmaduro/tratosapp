const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { ProductsController } = require("../dist/products/products.controller")
const { StorageItemsController } = require("../dist/storage-items/storage-items.controller")

const productId = "507f1f77bcf86cd799439010"
const itemId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const product = () => ({ name: " Tratos Combo ", items: [{ _id: itemId, quantity: 2 }] })

function products(existingItems = [itemId]) {
  const calls = { itemFind: [], create: [], update: [], delete: [] }
  const items = {
    find: filter => {
      calls.itemFind.push(filter)
      return { select: () => ({ lean: async () => existingItems.map(_id => ({ _id })) }) }
    }
  }
  const model = {
    create: async value => { calls.create.push(value); return value },
    findByIdAndUpdate: async (...args) => { calls.update.push(args); return args[0] === productId ? { _id: productId } : null }
  }
  return { controller: new ProductsController(model, items), calls, model }
}

function storage() {
  const calls = { create: [] }
  const model = { create: async value => { calls.create.push(value); return value } }
  return { controller: new StorageItemsController(model), calls, model }
}

test("products normalize valid item mappings and verify referenced storage items", async () => {
  const f = products()
  const created = await f.controller.create(product())
  assert.deepEqual(created, { name: "Tratos Combo", items: [{ _id: itemId, quantity: 2 }] })
  assert.deepEqual(f.calls.itemFind[0], { _id: { $in: [itemId] } })

  await f.controller.update({ _id: productId, ...product(), deletedAt: null })
  assert.deepEqual(f.calls.update[0], [
    productId,
    { $set: { name: "Tratos Combo", items: [{ _id: itemId, quantity: 2 }] } },
    { new: true, runValidators: true }
  ])
})

test("products reject unsafe, malformed and missing item payloads before writes", async () => {
  const f = products()
  const cases = [
    {}, { ...product(), unsafe: true }, { ...product(), name: "" }, { ...product(), items: "no" },
    { ...product(), items: [{ _id: "invalid", quantity: 1 }] }, { ...product(), items: [{ _id: itemId, quantity: 1.5 }] },
    { ...product(), items: [{ _id: itemId, quantity: 1 }, { _id: itemId, quantity: 1 }] }
  ]
  for (const value of cases) await assert.rejects(f.controller.create(value), status(400))
  assert.deepEqual(f.calls.itemFind, [])
  assert.deepEqual(f.calls.create, [])

  const missingItems = products([])
  await assert.rejects(missingItems.controller.create(product()), status(404))
  assert.deepEqual(missingItems.calls.create, [])
})

test("products report duplicate names, invalid IDs and missing records", async () => {
  const duplicate = products()
  duplicate.model.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(duplicate.controller.create(product()), status(409))

  const f = products()
  await assert.rejects(f.controller.update({ _id: "invalid", ...product() }), status(400))
  await assert.rejects(f.controller.remove("invalid"), status(400))
  await assert.rejects(f.controller.restore("invalid"), status(400))
  await assert.rejects(f.controller.remove("507f1f77bcf86cd799439012"), status(404))
})

test("storage quick-create accepts its legacy payload but stores only schema fields", async () => {
  const f = storage()
  const result = await f.controller.create({
    code: " BOX-01 ", name: " Hộp nhỏ ", quantityPerBox: 1,
    receivedQuantity: { quantity: 0, real: 0 }, deliveredQuantity: { quantity: 0, real: 0 },
    restQuantity: { quantity: 0, real: 0 }, note: "legacy form"
  })
  assert.deepEqual(result, { code: "BOX-01", name: "Hộp nhỏ" })
  for (const body of [{}, { code: "BOX", name: "", unsafe: true }]) {
    await assert.rejects(f.controller.create(body), status(400))
  }
  f.model.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(f.controller.create({ code: "BOX-01", name: "Hộp nhỏ" }), status(409))
})

test("product and storage searches use literal text and strict deleted flags", async () => {
  const calls = { products: [], storage: [] }
  const productController = new ProductsController(
    { find: filter => { calls.products.push(filter); return { lean: async () => [] } } },
    {}
  )
  const storageController = new StorageItemsController({
    find: filter => { calls.storage.push(filter); return { sort: () => ({ lean: async () => [] }) } }
  })
  await productController.search(".*", "false")
  await storageController.search(".*", "true")
  assert.equal(calls.products[0].name.$regex, "\\.\\*")
  assert.equal(calls.products[0].deletedAt, null)
  assert.equal(calls.storage[0].$or[0].code.$regex, "\\.\\*")
  assert.deepEqual(calls.storage[0].deletedAt, { $ne: null })
  assert.throws(() => productController.search("", "all"), status(400))
  assert.throws(() => storageController.search("", "all"), status(400))
})
