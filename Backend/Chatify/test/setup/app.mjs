let appPromise;

export const getTestApp = async () => {
  appPromise ??= import('../../app.mjs').then((module) => module.default);
  return appPromise;
};
