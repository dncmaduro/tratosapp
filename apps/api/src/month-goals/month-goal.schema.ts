import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Types } from "mongoose"
export type MonthGoalDocument = HydratedDocument<MonthGoal>
@Schema({ timestamps: true }) export class MonthGoal { @Prop({ required: true }) month!: number; @Prop({ required: true }) year!: number; @Prop({ type: Types.ObjectId, ref: "Channel", required: true }) channel!: Types.ObjectId; @Prop({ default: 0 }) liveStreamGoal!: number; @Prop({ default: 0 }) shopGoal!: number; @Prop({ default: 0 }) liveAdsPercentageGoal!: number; @Prop({ default: 0 }) shopAdsPercentageGoal!: number }
export const MonthGoalSchema = SchemaFactory.createForClass(MonthGoal); MonthGoalSchema.index({ channel: 1, year: 1, month: 1 }, { unique: true })
