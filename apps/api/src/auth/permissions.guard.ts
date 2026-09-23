import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"
import { PERMISSIONS_KEY } from "./require-permissions.decorator"

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly users: Model<UserDocument>
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>()
    const user = request.user?.sub
      ? await this.users.findById(request.user.sub).select("permissions active").lean()
      : undefined
    if (!user?.active) throw new ForbiddenException("Tài khoản không còn hoạt động")
    if (user.permissions.includes("*") || required.some((permission) => user.permissions.includes(permission))) return true
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này")
  }
}
