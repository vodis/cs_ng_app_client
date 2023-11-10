.PHONY: build-development
build-development: ## Build the development Angular application.
	npm ci
	CI=false npm run build-dev
	ls -al ./dist/cs_ng_app_client

.PHONY: cp-file
cp-file: ## Replace environment files.
	cp ./.nginx/nginx.conf /etc/nginx/sites-available/app.craftscript.com
	sudo systemctl reload nginx
