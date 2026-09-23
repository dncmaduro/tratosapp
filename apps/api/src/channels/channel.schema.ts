import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"
export type ChannelDocument = HydratedDocument<Channel>
@Schema({ timestamps: true })
export class Channel { @Prop({ required: true, trim: true }) name!: string; @Prop({ required: true, unique: true, trim: true }) username!: string; @Prop({ type: [String], default: [] }) usernames!: string[]; @Prop({ default: "tiktokshop" }) platform!: "tiktokshop"; @Prop({ default: "" }) link!: string; @Prop({ default: 0 }) sortOrder!: number }
export const ChannelSchema = SchemaFactory.createForClass(Channel)
