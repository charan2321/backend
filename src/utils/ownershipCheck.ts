import { Model, Types } from "mongoose";

export const assertOwnership = async <T>(
  model: Model<T>,
  resourceId: string,
  userId: string,
  ownerField = "userId"
): Promise<T> => {
  const query = {
    _id: new Types.ObjectId(resourceId),
    [ownerField]: new Types.ObjectId(userId)
  } as Record<string, unknown>;

  const doc = await model.findOne(query);
  if (!doc) {
    const error = new Error("Resource not found") as Error & { statusCode: number; code: string };
    error.statusCode = 404;
    error.code = "NOT_FOUND";
    throw error;
  }
  return doc;
};
