const { fail } = require('../utils/response');

// Runs when no route matches the request
function notFound(req, res) {
  return fail(res, 404, 'Endpoint tidak ditemukan');
}

// Catches every error thrown/passed via next(err) in the app
function errorHandler(err, req, res, next) {
  // Invalid JSON body
  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'Format JSON tidak valid');
  }
  // Body larger than the limit (1mb)
  if (err.type === 'entity.too.large') {
    return fail(res, 413, 'Ukuran data terlalu besar');
  }

  // Log full details on the server only, never send them to the client
  console.error(err);
  return fail(res, 500, 'Terjadi kesalahan pada server');
}

module.exports = { notFound, errorHandler };