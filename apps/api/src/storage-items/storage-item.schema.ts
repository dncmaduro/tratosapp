import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type StorageItemDocument = HydratedDocument<StorageItem>

@Schema({ timestamps: true })
export class StorageItem {
  @Prop({ required: true, unique: true, trim: true }) code!: string
  @Prop({ required: true, trim: true }) name!: string
  @Prop({ type: Date, default: null }) deletedAt!: Date | null
}

export const StorageItemSchema = SchemaFactory.createForClass(StorageItem)
