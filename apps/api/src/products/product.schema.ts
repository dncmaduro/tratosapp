import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"
export type ProductDocument = HydratedDocument<Product>
@Schema({ _id: false }) class ProductItem { @Prop({ required: true }) _id!: string; @Prop({ required: true, default: 1 }) quantity!: number }
const ProductItemSchema = SchemaFactory.createForClass(ProductItem)
@Schema({ timestamps: true }) export class Product { @Prop({ required: true, unique: true }) name!: string; @Prop({ type: [ProductItemSchema], default: [] }) items!: ProductItem[]; @Prop({ default: null }) deletedAt!: Date | null }
export const ProductSchema = SchemaFactory.createForClass(Product)
