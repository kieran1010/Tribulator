const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  new RegExp(path.join(__dirname, 'android', 'app', 'build').replace(/\\/g, '\\\\') + '.*'),
];

module.exports = config;