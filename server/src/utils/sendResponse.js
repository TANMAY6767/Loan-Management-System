const sendResponse = function (
  res,
  status,
  data,
  message,
  statusCode = 200,
  apiVersion = null
) {
  const obj = {
    status,
    data,
    message,
    statusCode,
    apiVersion: apiVersion || 'No Version',
  };

  return res.status(statusCode).json(obj);
};

export { sendResponse };
