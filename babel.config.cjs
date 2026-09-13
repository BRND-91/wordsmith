// Named .cjs because package.json is type:module; Metro loads babel config as
// CommonJS regardless of the package's module type.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
