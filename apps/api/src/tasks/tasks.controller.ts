import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import {
  inputBoolean,
  inputBusinessDay,
  inputId,
  inputNonNegativeNumber,
  inputObject,
  inputString,
  withDuplicateConflict
} from "../common/input-validation"
import { TaskCategory, TaskCategoryDocument, TaskType, TaskTypeDocument, WorkTask, WorkTaskDocument } from "./task.schema"

const TASK_STATUSES = ["todo", "in_progress", "completed", "cancelled"] as const
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const
const TASK_COMPLEXITIES = ["low", "medium", "high"] as const
const TASK_SORT_FIELDS = ["title", "deadline", "weight", "priority", "status", "createdAt"] as const
const BUSINESS_OFFSET_MS = 7 * 60 * 60 * 1000

type RequestWithUser = { user: { sub: string } }

function inputEnum<T extends readonly string[]>(value: unknown, field: string, values: T): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new BadRequestException(`${field} không hợp lệ`)
  }
  return value as T[number]
}

function inputOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  return inputString(value, field, true)
}

function weekStart(value: Date) {
  const day = value.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + offset)
  result.setUTCHours(0, 0, 0, 0)
  return new Date(result.getTime() - BUSINESS_OFFSET_MS)
}

function nextWeek(value: Date) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + 7)
  return result
}

function dateKey(value: Date) {
  return new Date(value.getTime() + BUSINESS_OFFSET_MS).toISOString().slice(0, 10)
}

function businessWeekStart(value: unknown, field: string) {
  const businessMidnight = inputBusinessDay(value, field)
  return weekStart(new Date(businessMidnight.getTime() + BUSINESS_OFFSET_MS))
}

@ApiTags("tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tasks")
export class TasksController {
  constructor(
    @InjectModel(TaskType.name) private readonly types: Model<TaskTypeDocument>,
    @InjectModel(TaskCategory.name) private readonly categories: Model<TaskCategoryDocument>,
    @InjectModel(WorkTask.name) private readonly tasks: Model<WorkTaskDocument>
  ) {}

  @Get("taxonomy")
  @RequirePermissions("tasks.view")
  async taxonomy(): Promise<{ types: unknown[]; categories: unknown[] }> {
    const [types, rawCategories] = await Promise.all([
      this.types.find().sort({ sortOrder: 1, name: 1 }).lean(),
      this.categories.find().sort({ sortOrder: 1, name: 1 }).lean()
    ])
    const categories = rawCategories.map((category) => ({ ...category, taskTypeId: String(category.taskTypeId) }))
    return { types, categories }
  }

  @Get("options")
  @RequirePermissions("tasks.view")
  async options(): Promise<{ types: unknown[]; categories: unknown[] }> {
    const [types, rawCategories] = await Promise.all([
      this.types.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      this.categories.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean()
    ])
    const categories = rawCategories.map((category) => ({ ...category, taskTypeId: String(category.taskTypeId) }))
    return { types, categories }
  }

  @Get("reports/weekly")
  @RequirePermissions("tasks.reports.view")
  async weeklyReport(@Query("weekStart") rawWeekStart?: string) {
    const start = businessWeekStart(rawWeekStart ?? dateKey(new Date()), "weekStart")
    const end = nextWeek(start)
    const rows = await this.tasks.aggregate([
      { $match: { deadline: { $gte: start, $lt: end } } },
      { $lookup: { from: this.categories.collection.name, localField: "categoryId", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $lookup: { from: this.types.collection.name, localField: "category.taskTypeId", foreignField: "_id", as: "type" } },
      { $unwind: "$type" },
      {
        $group: {
          _id: { typeId: "$type._id", categoryId: "$category._id" },
          typeName: { $first: "$type.name" },
          typeSortOrder: { $first: "$type.sortOrder" },
          categoryName: { $first: "$category.name" },
          categorySortOrder: { $first: "$category.sortOrder" },
          target: { $first: "$category.target" },
          unit: { $first: "$category.unit" },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          totalWeight: { $sum: "$weight" },
          completedWeight: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$weight", 0] } }
        }
      },
      { $sort: { typeSortOrder: 1, categorySortOrder: 1, categoryName: 1 } }
    ])
    type ReportGroup = { typeId: string; name: string; rows: Record<string, unknown>[]; totalWeight: number; completedWeight: number }
    const groups = new Map<string, ReportGroup>()
    for (const row of rows) {
      const typeId = String(row._id.typeId)
      const group: ReportGroup = groups.get(typeId) ?? { typeId, name: row.typeName, rows: [], totalWeight: 0, completedWeight: 0 }
      group.rows.push({
        categoryId: String(row._id.categoryId),
        name: row.categoryName,
        target: row.target,
        unit: row.unit,
        total: row.total,
        completed: row.completed,
        progress: row.target > 0 ? Math.min(100, (row.completed / row.target) * 100) : 0,
        totalWeight: row.totalWeight,
        completedWeight: row.completedWeight
      })
      group.totalWeight += row.totalWeight
      group.completedWeight += row.completedWeight
      groups.set(typeId, group)
    }
    const activeCategories = await this.categories.find({ active: true }).populate("taskTypeId").sort({ sortOrder: 1, name: 1 }).lean()
    for (const category of activeCategories) {
      const type = category.taskTypeId as unknown as { _id: Types.ObjectId; name: string }
      const typeId = String(type._id)
      const categoryId = String(category._id)
      const group = groups.get(typeId) ?? { typeId, name: type.name, rows: [], totalWeight: 0, completedWeight: 0 }
      if (!group.rows.some((row) => row.categoryId === categoryId)) {
        group.rows.push({ categoryId, name: category.name, target: category.target, unit: category.unit, total: 0, completed: 0, progress: 0, totalWeight: 0, completedWeight: 0 })
      }
      groups.set(typeId, group)
    }
    return {
      weekStart: dateKey(start),
      weekEnd: dateKey(new Date(end.getTime() - 24 * 60 * 60 * 1000)),
      groups: [...groups.values()]
    }
  }

  @Get()
  @RequirePermissions("tasks.view")
  async list(
    @Query("weekStart") rawWeekStart?: string,
    @Query("search") search = "",
    @Query("typeId") typeId?: string,
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("complexity") complexity?: string,
    @Query("sortBy") rawSortBy = "deadline",
    @Query("sortOrder") rawSortOrder = "asc",
    @Query("page") rawPage = "1",
    @Query("limit") rawLimit = "20"
  ) {
    const start = businessWeekStart(rawWeekStart ?? dateKey(new Date()), "weekStart")
    const end = nextWeek(start)
    const page = Math.max(1, Number(rawPage))
    const limit = Math.min(100, Math.max(1, Number(rawLimit)))
    if (!Number.isInteger(page) || !Number.isInteger(limit)) throw new BadRequestException("page hoặc limit không hợp lệ")
    const filter: Record<string, unknown> = { deadline: { $gte: start, $lt: end } }
    if (search.trim()) filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
    if (categoryId) filter.categoryId = new Types.ObjectId(inputId(categoryId))
    if (typeId) {
      const categoryIds = await this.categories.find({ taskTypeId: new Types.ObjectId(inputId(typeId)) }).distinct("_id")
      filter.categoryId = { $in: categoryIds }
    }
    if (status) filter.status = inputEnum(status, "status", TASK_STATUSES)
    if (priority) filter.priority = inputEnum(priority, "priority", TASK_PRIORITIES)
    if (complexity) filter.complexity = inputEnum(complexity, "complexity", TASK_COMPLEXITIES)
    const sortBy = inputEnum(rawSortBy, "sortBy", TASK_SORT_FIELDS)
    const sortOrder = inputEnum(rawSortOrder, "sortOrder", ["asc", "desc"] as const)
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "asc" ? 1 : -1, updatedAt: -1 }
    const [data, total] = await Promise.all([
      this.tasks.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate({ path: "categoryId", populate: { path: "taskTypeId" } }).lean(),
      this.tasks.countDocuments(filter)
    ])
    return { data, total, page, limit, weekStart: dateKey(start), weekEnd: dateKey(new Date(end.getTime() - 24 * 60 * 60 * 1000)) }
  }

  @Get(":id")
  @RequirePermissions("tasks.view")
  async get(@Param("id") id: string) {
    const task = await this.tasks.findById(inputId(id)).populate({ path: "categoryId", populate: { path: "taskTypeId" } }).lean()
    if (!task) throw new NotFoundException("Không tìm thấy task")
    return { data: task }
  }

  @Post()
  @RequirePermissions("tasks.create")
  async create(@Req() req: RequestWithUser, @Body() body: unknown) {
    const value = inputObject(body, ["title", "description", "categoryId", "deadline", "weight", "complexity", "priority", "estimatedHours", "status"])
    const task = await this.tasks.create(this.parseTask(value, req.user.sub))
    return { data: task }
  }

  @Patch(":id")
  @RequirePermissions("tasks.update")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const taskId = inputId(id)
    const value = inputObject(body, ["title", "description", "categoryId", "deadline", "weight", "complexity", "priority", "estimatedHours", "status"])
    const update = this.parseTask(value)
    delete (update as Record<string, unknown>).createdBy
    const task = await this.tasks.findByIdAndUpdate(taskId, update, { new: true, runValidators: true }).lean()
    if (!task) throw new NotFoundException("Không tìm thấy task")
    return { data: task }
  }

  @Patch(":id/status")
  @RequirePermissions("tasks.status.update")
  async updateStatus(@Param("id") id: string, @Body() body: unknown) {
    const value = inputObject(body, ["status"])
    const task = await this.tasks.findByIdAndUpdate(inputId(id), { status: inputEnum(value.status, "status", TASK_STATUSES) }, { new: true, runValidators: true }).lean()
    if (!task) throw new NotFoundException("Không tìm thấy task")
    return { data: task }
  }

  @Delete(":id")
  @RequirePermissions("tasks.delete")
  async remove(@Param("id") id: string) {
    const result = await this.tasks.findByIdAndDelete(inputId(id))
    if (!result) throw new NotFoundException("Không tìm thấy task")
    return { deleted: true }
  }

  @Post("types")
  @RequirePermissions("tasks.taxonomy.manage")
  async createType(@Body() body: unknown) {
    const value = inputObject(body, ["name", "description", "active", "sortOrder"])
    return { data: await withDuplicateConflict(() => this.types.create(this.parseType(value)), "Tên loại task đã tồn tại") }
  }

  @Patch("types/:id")
  @RequirePermissions("tasks.taxonomy.manage")
  async updateType(@Param("id") id: string, @Body() body: unknown) {
    const value = inputObject(body, ["name", "description", "active", "sortOrder"])
    const data = await this.types.findByIdAndUpdate(inputId(id), this.parseType(value), { new: true, runValidators: true }).lean()
    if (!data) throw new NotFoundException("Không tìm thấy loại task")
    return { data }
  }

  @Delete("types/:id")
  @RequirePermissions("tasks.taxonomy.manage")
  async deleteType(@Param("id") id: string) {
    const typeId = inputId(id)
    const used = await this.categories.exists({ taskTypeId: new Types.ObjectId(typeId) })
    if (used) throw new ConflictException("Không thể xóa loại task đang có phân loại")
    const data = await this.types.findByIdAndDelete(typeId)
    if (!data) throw new NotFoundException("Không tìm thấy loại task")
    return { deleted: true }
  }

  @Post("categories")
  @RequirePermissions("tasks.taxonomy.manage")
  async createCategory(@Body() body: unknown) {
    const value = inputObject(body, ["taskTypeId", "name", "description", "active", "sortOrder", "target", "unit"])
    return { data: await withDuplicateConflict(() => this.categories.create(this.parseCategory(value)), "Phân loại task đã tồn tại trong loại này") }
  }

  @Patch("categories/:id")
  @RequirePermissions("tasks.taxonomy.manage")
  async updateCategory(@Param("id") id: string, @Body() body: unknown) {
    const value = inputObject(body, ["taskTypeId", "name", "description", "active", "sortOrder", "target", "unit"])
    const data = await this.categories.findByIdAndUpdate(inputId(id), this.parseCategory(value), { new: true, runValidators: true }).lean()
    if (!data) throw new NotFoundException("Không tìm thấy phân loại task")
    return { data }
  }

  @Delete("categories/:id")
  @RequirePermissions("tasks.taxonomy.manage")
  async deleteCategory(@Param("id") id: string) {
    const categoryId = inputId(id)
    const used = await this.tasks.exists({ categoryId: new Types.ObjectId(categoryId) })
    if (used) throw new ConflictException("Không thể xóa phân loại task đang được sử dụng")
    const data = await this.categories.findByIdAndDelete(categoryId)
    if (!data) throw new NotFoundException("Không tìm thấy phân loại task")
    return { deleted: true }
  }

  private parseType(value: Record<string, unknown>) {
    return {
      ...(value.name !== undefined ? { name: inputString(value.name, "name") } : {}),
      ...(value.description !== undefined ? { description: inputString(value.description, "description", true) } : {}),
      ...(value.active !== undefined ? { active: inputBoolean(value.active, "active") } : {}),
      ...(value.sortOrder !== undefined ? { sortOrder: inputNonNegativeNumber(value.sortOrder, "sortOrder") } : {})
    }
  }

  private parseCategory(value: Record<string, unknown>) {
    return {
      ...(value.taskTypeId !== undefined ? { taskTypeId: new Types.ObjectId(inputId(value.taskTypeId)) } : {}),
      ...(value.name !== undefined ? { name: inputString(value.name, "name") } : {}),
      ...(value.description !== undefined ? { description: inputString(value.description, "description", true) } : {}),
      ...(value.active !== undefined ? { active: inputBoolean(value.active, "active") } : {}),
      ...(value.sortOrder !== undefined ? { sortOrder: inputNonNegativeNumber(value.sortOrder, "sortOrder") } : {}),
      ...(value.target !== undefined ? { target: inputNonNegativeNumber(value.target, "target") } : {}),
      ...(value.unit !== undefined ? { unit: inputString(value.unit, "unit", true) } : {})
    }
  }

  private parseTask(value: Record<string, unknown>, createdBy?: string) {
    const categoryId = inputId(value.categoryId)
    return {
      title: inputString(value.title, "title"),
      description: inputOptionalString(value.description, "description") ?? "",
      categoryId: new Types.ObjectId(categoryId),
      deadline: inputBusinessDay(value.deadline, "deadline"),
      weight: inputNonNegativeNumber(value.weight ?? 0, "weight"),
      complexity: inputEnum(value.complexity ?? "medium", "complexity", TASK_COMPLEXITIES),
      priority: inputEnum(value.priority ?? "medium", "priority", TASK_PRIORITIES),
      estimatedHours: inputNonNegativeNumber(value.estimatedHours ?? 0, "estimatedHours"),
      status: inputEnum(value.status ?? "todo", "status", TASK_STATUSES),
      ...(createdBy ? { createdBy: new Types.ObjectId(inputId(createdBy)), assignee: null } : {})
    }
  }
}
