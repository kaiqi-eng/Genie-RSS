export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/test/**/*.test.js'],

  // Test result reporters
  reporters: [
    'default',
    // HTML Report
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'test-report.html',
      pageTitle: 'Genie-RSS Test Results',
      expand: true,
      openReport: false,
      includeFailureMsg: true
    }]
  ],

  // JSON output
  testResultsProcessor: undefined,

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  verbose: true,
  setupFiles: ['<rootDir>/test/setup.js']
};
