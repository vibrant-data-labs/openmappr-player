REPORTER = spec
test:
	@NODE_ENV=test ./node_modules/mocha/bin/mocha test \
	--reporter $(REPORTER) \
	--recursive 

test_pattern:
	@NODE_ENV=test ./node_modules/mocha/bin/mocha test \
	--reporter $(REPORTER) \
	--grep ${PAT} \
	--recursive

.PHONY: test
