import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"
export type PackingRuleDocument = HydratedDocument<PackingRule>
@Schema({ _id: false }) class RuleProduct { @Prop({ required: true }) productCode!: string; @Prop({ type: Number, default: null }) minQuantity!: number | null; @Prop({ type: Number, default: null }) maxQuantity!: number | null }
const RuleProductSchema = SchemaFactory.createForClass(RuleProduct)
@Schema({ timestamps: true }) export class PackingRule { @Prop({ required: true }) packingType!: string; @Prop({ type: [RuleProductSchema], default: [] }) products!: RuleProduct[] }
export const PackingRuleSchema = SchemaFactory.createForClass(PackingRule)
