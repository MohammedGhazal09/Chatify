const asyncErrHandler = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

export default asyncErrHandler;
