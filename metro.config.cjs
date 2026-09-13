const { getDefaultConfig } = require('expo/metro-config');

// The dictionary and rank tables ship as .txt assets; Metro's default asset
// list does not include txt, so without this they resolve as source modules.
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('txt');

module.exports = config;
