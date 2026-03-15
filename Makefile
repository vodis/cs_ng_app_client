.PHONY: build-development
build-development: ## Build the development Angular application.
	pnpm install --frozen-lockfile
	CI=false pnpm run build-dev
	ls -al ./dist/cs_ng_app_client

.PHONY: cp-file
cp-file: ## Replace environment files.
	cp ./.nginx/nginx.conf /etc/nginx/sites-available/app.craftscript.com
	sudo systemctl restart nginx
