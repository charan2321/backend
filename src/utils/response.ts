export const sendSuccess = <T>(res: any, data: T, statusCode = 200): any =>
  res.status(statusCode).json({
    success: true,
    data
  });

export const sendError = (
  res: any,
  code: string,
  message: string,
  statusCode: number,
  fields?: Record<string, string[]>
): any =>
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(fields ? { fields } : {})
    }
  });
