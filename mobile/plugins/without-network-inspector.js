const { AndroidConfig, IOSConfig } = require("expo/config-plugins");

// The dev launcher captures request bodies unless this native setting is disabled.
const properties = [{
  propName: "EX_DEV_CLIENT_NETWORK_INSPECTOR",
  propValueGetter: () => "false",
}];
const withAndroid = AndroidConfig.BuildProperties.createBuildGradlePropsConfigPlugin(properties);
const withIos = IOSConfig.BuildProperties.createBuildPodfilePropsConfigPlugin(properties);

module.exports = (config) => withIos(withAndroid(config));
