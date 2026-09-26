import { BadRequestException } from "@nestjs/common"
import { inputHttpUrl, inputObject, inputString } from "../common/input-validation"
import { Channel } from "./channel.schema"

export function channelInput(value: unknown, creating: boolean): Partial<Channel> {
  const body = inputObject(value, ["name", "username", "usernames", "platform", "link", "sortOrder"])
  if (!creating && !Object.keys(body).length) throw new BadRequestException("Cần ít nhất một trường để cập nhật")
  const result: Partial<Channel> = {}
  if (creating || "name" in body) result.name = inputString(body.name, "name")
  if (creating || "username" in body) result.username = inputString(body.username, "username")
  if ("platform" in body && body.platform !== "tiktokshop") {
    throw new BadRequestException("Kênh chỉ hỗ trợ nền tảng tiktokshop")
  }
  if (creating || "platform" in body) result.platform = "tiktokshop"
  if ("usernames" in body) {
    if (!Array.isArray(body.usernames)) throw new BadRequestException("usernames phải là một mảng")
    result.usernames = [...new Set(body.usernames.map(item => inputString(item, "usernames")))]
  }
  if (creating && !result.usernames?.length) result.usernames = [result.username!]
  if ("link" in body) result.link = inputHttpUrl(body.link, "link")
  if ("sortOrder" in body) {
    if (typeof body.sortOrder !== "number" || !Number.isSafeInteger(body.sortOrder)) {
      throw new BadRequestException("sortOrder phải là số nguyên an toàn")
    }
    result.sortOrder = body.sortOrder
  }
  return result
}
