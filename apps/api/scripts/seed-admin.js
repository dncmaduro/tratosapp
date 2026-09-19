const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const required = ["DATABASE_URL", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"]
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`)

const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({ email: String, passwordHash: String, name: String, permissions: [String], active: Boolean }, { timestamps: true }))

async function seed() {
  await mongoose.connect(process.env.DATABASE_URL)
  const email = process.env.SEED_ADMIN_EMAIL.toLowerCase()
  await User.findOneAndUpdate({ email }, { $set: { passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12), name: process.env.SEED_ADMIN_NAME || "Tratosapp Admin", active: true, permissions: ["*"] }, $setOnInsert: { email } }, { upsert: true })
  console.log(`Admin seeded: ${email}`)
  await mongoose.disconnect()
}
seed().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1) })
