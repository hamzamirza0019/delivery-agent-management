export const errorHandler = (err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON body",
    });
  }

  console.error(err);

  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "Email or phone number already exists",
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Delivery agent not found",
    });
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message,
  });
};