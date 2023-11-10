.PHONY: build-development
build-development: ## Build the development Angular application.
	npm ci
	CI=false npm run build-dev
	ls -al ./dist/cs_nf_app_client
