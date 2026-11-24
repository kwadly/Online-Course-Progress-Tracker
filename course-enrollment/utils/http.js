function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, err) {
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err.message);
  res.status(500).json({ error: 'Something went wrong on the server' });
}

module.exports = { httpError, parseId, handleError };