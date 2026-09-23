import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type UserDocument = HydratedDocument<User>
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email!: string
  @Prop({ required: true }) passwordHash!: string
  @Prop({ required: true }) name!: string
  @Prop({ default: "" }) avatarUrl!: string
  @Prop({ type: [String], default: [] }) permissions!: string[]
  @Prop({ default: true }) active!: boolean
}
export const UserSchema = SchemaFactory.createForClass(User)
