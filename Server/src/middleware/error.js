module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status =
    err.status ||
    (err.message && err.message.includes("not found") ? 404 : 400);
  res.status(status).json({
    error: err.message || "Internal Server Error",
  });
};
