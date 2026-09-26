import { BadRequestException, ConflictException } from "@nestjs/common"

export function inputObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Body phải là một object")
  }
  const body = value as Record<string, unknown>
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    throw new BadRequestException("Body chứa trường không được phép")
  }
  return body
}

export function inputString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new BadRequestException(`${field} phải là chuỗi${allowEmpty ? "" : " không rỗng"}`)
  }
  return value.trim()
}

export function inputEmail(value: unknown): string {
  const email = inputString(value, "email").toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("Email không hợp lệ")
  }
  return email
}

export function inputBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new BadRequestException(`${field} phải là true hoặc false`)
  return value
}

export function inputNonNegativeNumber(value: unknown, field: string): number {
  if ((typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "string" && !value.trim())) {
    throw new BadRequestException(`${field} phải là số không âm`)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`${field} phải là số không âm`)
  }
  return number
}

const businessDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
})

/** Stores an Asia/Ho_Chi_Minh calendar day as its UTC instant at local midnight. */
export function inputBusinessDay(value: unknown, field = "date"): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new BadRequestException(`${field} không hợp lệ`)
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    const calendarDay = new Date(Date.UTC(year, month - 1, day))
    if (calendarDay.getUTCFullYear() !== year || calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) {
      throw new BadRequestException(`${field} không hợp lệ`)
    }
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) throw new BadRequestException(`${field} không hợp lệ`)
  const parts = Object.fromEntries(
    businessDateParts.formatToParts(parsed)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  )
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 7 * 60 * 60 * 1000)
}

export function inputId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new BadRequestException("ID không hợp lệ")
  }
  return value
}

export function inputPassword(value: unknown, field: string, isNew = false): string {
  if (typeof value !== "string" || value.length === 0 ||
      (isNew && (value.length < 8 || Buffer.byteLength(value, "utf8") > 72))) {
    throw new BadRequestException(`${field} không hợp lệ${isNew ? " (ít nhất 8 ký tự, tối đa 72 byte UTF-8)" : ""}`)
  }
  // Passwords are never trimmed or otherwise normalized.
  return value
}

export function inputHttpUrl(value: unknown, field: string): string {
  const result = inputString(value, field, true)
  if (!result) return result
  try {
    const url = new URL(result)
    if (url.protocol === "http:" || url.protocol === "https:") return result
  } catch { /* Report malformed URLs as input errors. */ }
  throw new BadRequestException(`${field} phải là URL HTTP hoặc HTTPS`)
}

export function inputPermissions(value: unknown, known: readonly string[]): string[] {
  if (!Array.isArray(value) || value.some(key => typeof key !== "string" || !known.includes(key))) {
    throw new BadRequestException("Danh sách quyền không hợp lệ")
  }
  return [...new Set(value)]
}

export async function withDuplicateConflict<T>(operation: () => PromiseLike<T>, message: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new ConflictException(message)
    }
    throw error
  }
}
