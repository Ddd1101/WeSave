module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status =
    err.status ||
    (err.message && /not found|未找到/i.test(err.message) ? 404 : 500);
  console.error(`[error] ${req.method} ${req.url} -> ${status}`, err.message);
  res.status(status).json({
    error: err.message || "Internal Server Error",
  });
};
