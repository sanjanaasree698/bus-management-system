exports.config = {
  runner: 'local',
  port: 4723,
  specs: [
    './specs/**/*.spec.js'
  ],
  exclude: [],
  maxInstances: 1,
  capabilities: [{
    platformName: 'Android',
    'appium:deviceName': 'Android Emulator',
    'appium:platformVersion': '13.0',
    'appium:automationName': 'UiAutomator2',
    'appium:app': './android/app/build/outputs/apk/debug/app-debug.apk',
    'appium:appPackage': 'com.busmanagement.system',
    'appium:appActivity': '.MainActivity',
    'appium:newCommandTimeout': 240,
  }],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['appium'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};
