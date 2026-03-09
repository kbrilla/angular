import '../../build/zone.umd.js';

Zone[Zone.__symbol__('ignoreConsoleErrorUncaughtError')] = true;
const deferred = function () {
  return Promise.withResolvers();
};

const resolved = (val) => {
  return Promise.resolve(val);
};

const rejected = (reason) => {
  return Promise.reject(reason);
};

export default {deferred, resolved, rejected};
