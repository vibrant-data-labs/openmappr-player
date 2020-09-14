'use strict';

exports.config = {
    framework: 'jasmine',
    seleniumAddress: 'http://localhost:4444/wd/hub',
    baseUrl: 'http://localhost:8080',

    // Alternatively, suites may be used. When run without a command line
      // parameter, all suites will run. If run with --suite=smoke or
      // --suite=smoke,full only the patterns matched by the specified suites will
      // run.
    suites: {
        project: [
            'suites/project/login.spec.js',
            'suites/project/proj_dash.spec.js',
            'suites/project/project_creation.spec.js',
            'suites/project/info_panel.spec.js',
            'suites/project/custom_groupspanel.spec.js',
            'suites/project/data_modal.spec.js',
            'suites/project/search.spec.js',
            'suites/project/layouts.spec.js'
        ]
        // recipes: 'suites/recipes/*.js'
    },

    params: {
        login: {
            user: 'abc@mappr.io',
            password: '234'
        },
        test_org: 'test_org' //Must create an Org with this name before running tests
    },

    // Protractor can launch your tests on one or more browsers. If you are
    // testing on a single browser, use the capabilities option. If you are
    // testing on multiple browsers, use the multiCapabilities array.

    // For a list of available capabilities, see
    // https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities
    //
    // In addition, you may specify count, shardTestFiles, and maxInstances.
    capabilities: {
        browserName: 'chrome'
        // shardTestFiles: true,
        // maxInstances: 2
    },

    // Options to be passed to jasmine.
    //
    // See https://github.com/jasmine/jasmine-npm/blob/master/lib/jasmine.js
    // for the exact options available.
    jasmineNodeOpts: {
        // If true, print colors to the terminal.
        showColors: true,
        // Default time to wait in ms before a test fails.
        defaultTimeoutInterval: 30000
    },

    // A callback function called once protractor is ready and available, and
	// before the specs are executed.
	// If multiple capabilities are being run, this will run once per
	// capability.
	// You can specify a file containing code to run by setting onPrepare to
	// the filename string.
	// onPrepare can optionally return a promise, which Protractor will wait for
	// before continuing execution. This can be used if the preparation involves
	// any asynchronous calls, e.g. interacting with the browser. Otherwise
	// Protractor cannot guarantee order of execution and may start the tests
	// before preparation finishes
    onPrepare: function() {
        browser.driver.manage().window().setSize(1260, 800);
        browser.driver.get(browser.baseUrl);
        // browser.manage().timeouts().setScriptTimeout(5000);
    }
};
