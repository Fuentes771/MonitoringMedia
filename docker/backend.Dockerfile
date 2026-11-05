FROM php:8.3-cli-alpine

RUN apk add --no-cache postgresql-dev linux-headers $PHPIZE_DEPS \
    && docker-php-ext-install pdo pdo_pgsql pgsql pcntl \
    && rm -rf /var/cache/apk/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --optimize-autoloader

COPY . .

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
