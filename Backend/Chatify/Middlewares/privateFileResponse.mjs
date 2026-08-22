import { buildPrivateFileHeaders } from '../Utils/uploadSecurity.mjs';

export const privateFileResponse = (_req, res, next) => {
  const headers = buildPrivateFileHeaders();
  delete headers['Content-Type'];
  delete headers['Content-Disposition'];
  res.set(headers);
  next();
};

export default privateFileResponse;
