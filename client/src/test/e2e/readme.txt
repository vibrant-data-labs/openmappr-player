Setup E2E test environment

Install protractor
	- npm install -g protractor
	- webdriver-manager update

Install jasmine locally
	- npm install jasmine(is in package.json)

Run test
	- webdriver-manager start
	- protractor config.js //Inside client/src/test/e2e