import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Types } from "mongoose"

export type TaskTypeDocument = HydratedDocument<TaskType>
export type TaskCategoryDocument = HydratedDocument<TaskCategory>
export type WorkTaskDocument = HydratedDocument<WorkTask>

@Schema({ timestamps: true })
export class TaskType {
  @Prop({ required: true, trim: true }) name!: string
  @Prop({ default: "", trim: true }) description!: string
  @Prop({ default: true }) active!: boolean
  @Prop({ default: 0 }) sortOrder!: number
}

@Schema({ timestamps: true })
export class TaskCategory {
  @Prop({ required: true, type: Types.ObjectId, ref: TaskType.name }) taskTypeId!: Types.ObjectId
  @Prop({ required: true, trim: true }) name!: string
  @Prop({ default: "", trim: true }) description!: string
  @Prop({ default: true }) active!: boolean
  @Prop({ default: 0 }) sortOrder!: number
  @Prop({ default: 0, min: 0 }) target!: number
  @Prop({ default: "", trim: true }) unit!: string
}

@Schema({ timestamps: true })
export class WorkTask {
  @Prop({ required: true, trim: true }) title!: string
  @Prop({ default: "", trim: true }) description!: string
  @Prop({ required: true, type: Types.ObjectId, ref: TaskCategory.name }) categoryId!: Types.ObjectId
  @Prop({ required: true }) deadline!: Date
  @Prop({ default: 0, min: 0 }) weight!: number
  @Prop({ enum: ["low", "medium", "high"], default: "medium" }) complexity!: "low" | "medium" | "high"
  @Prop({ enum: ["low", "medium", "high", "urgent"], default: "medium" }) priority!: "low" | "medium" | "high" | "urgent"
  @Prop({ default: 0, min: 0 }) estimatedHours!: number
  @Prop({ enum: ["todo", "in_progress", "completed", "cancelled"], default: "todo" }) status!: "todo" | "in_progress" | "completed" | "cancelled"
  @Prop({ required: true, type: Types.ObjectId, ref: "User" }) createdBy!: Types.ObjectId
  @Prop({ default: null, type: Types.ObjectId, ref: "User" }) assignee!: Types.ObjectId | null
}

export const TaskTypeSchema = SchemaFactory.createForClass(TaskType)
export const TaskCategorySchema = SchemaFactory.createForClass(TaskCategory)
export const WorkTaskSchema = SchemaFactory.createForClass(WorkTask)

TaskCategorySchema.index({ taskTypeId: 1, name: 1 }, { unique: true })
TaskTypeSchema.index({ name: 1 }, { unique: true })
WorkTaskSchema.index({ deadline: 1, categoryId: 1, status: 1 })
