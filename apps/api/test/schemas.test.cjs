const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")

test("AppModule and all its schemas load without opening a database connection", () => {
  const { AppModule } = require("../dist/app.module")
  assert.equal(typeof AppModule, "function")
})

test("soft-delete fields have explicit Date schemas and default to null", () => {
  const { ProductSchema } = require("../dist/products/product.schema")
  const { StorageItemSchema } = require("../dist/storage-items/storage-item.schema")
  for (const schema of [ProductSchema, StorageItemSchema]) {
    const field = schema.path("deletedAt")
    assert.equal(field.instance, "Date")
    assert.equal(field.defaultValue, null)
    assert.ok(field.cast("2026-01-01T00:00:00.000Z") instanceof Date)
  }
})

test("packing quantity bounds have explicit Number schemas and preserve null defaults", () => {
  const { PackingRuleSchema } = require("../dist/packing-rules/packing-rule.schema")
  const productSchema = PackingRuleSchema.path("products").schema
  for (const key of ["minQuantity", "maxQuantity"]) {
    const field = productSchema.path(key)
    assert.equal(field.instance, "Number")
    assert.equal(field.defaultValue, null)
    assert.equal(field.cast(null), null)
    assert.equal(field.cast("2"), 2)
  }
})
