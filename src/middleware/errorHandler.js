/** Central error handler — operational errors return JSON message + status. */
export function errorHandler(err, req, res, _next) {
  // MongoDB duplicate key (e.g. unique email)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyPattern || err.keyValue || {});
    const field = keys[0] || "value";
    return res.status(409).json({
      message: `This ${field} is already in use`,
      code: "DUPLICATE_KEY",
      field,
    });
  }

  // Mongoose schema validation
  if (err.name === "ValidationError" && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      message: errors[0]?.message || "Validation failed",
      errors,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid ${err.path}: ${err.value}`,
      code: "CAST_ERROR",
    });
  }

  const status = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";
  if (!err.isOperational && process.env.NODE_ENV !== "production") {
    console.error(err);
  } else if (status === 500) {
    console.error(err);
  }

  const payload = { message };
  if (status === 500 && process.env.NODE_ENV !== "production" && err.message) {
    payload.detail = err.message;
  }
  res.status(status).json(payload);
}
