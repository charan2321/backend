import { Schema, model, Types } from "mongoose";

export interface IBook {
  title: string;
  language: string;
  coverImageUrl: string;
  contentKey: string;
  priceIndividual: number;
  isPublished: boolean;
  uploadedBy: Types.ObjectId;
}

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true },
    coverImageUrl: { type: String, required: true },
    contentKey: { type: String, required: true },
    priceIndividual: { type: Number, required: true, default: 5900 },
    isPublished: { type: Boolean, default: true },
    uploadedBy: { type: Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

bookSchema.index({ title: "text", language: "text" });

export const Book = model<IBook>("Book", bookSchema);
