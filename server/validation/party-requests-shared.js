class RequestValidationError extends Error {
  constructor({
    message,
    code = 'invalid_request',
    status = 400,
    details
  } = {}) {
    super(message || 'Invalid request');
    this.name = 'RequestValidationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function createValidationError({
  message,
  code = 'invalid_request',
  status = 400,
  details
}) {
  return new RequestValidationError({
    message,
    code,
    status,
    details
  });
}

module.exports = {
  RequestValidationError,
  createValidationError,
  isPlainObject
};
