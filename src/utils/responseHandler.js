const successResponse = (res, statusCode, message, data = null) => {
  const response = {
    message,
  };
  if (data) {
    Object.assign(response, data);
  }
  return res.status(statusCode).json(response);
};

const errorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    message,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
