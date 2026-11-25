FROM php:8.3-fpm-alpine

RUN apk add --no-cache postgresql-dev linux-headers nginx $PHPIZE_DEP \
    && docker-php-ext-install pdo pdo_pgsql pgsql pcntl opcache \
    && rm -rf /var/cache/apk/* /tmp/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN printf "expose_php = Off\nmemory_limit = 256M\nmax_execution_time = 120\n" > /usr/local/etc/php/conf.d/security.ini \
    && printf "opcache.enable=1\nopcache.enable_cli=0\nopcache.memory_consumption=128\nopcache.interned_strings_buffer=16\nopcache.max_accelerated_files=20000\nopcache.validate_timestamps=1\nopcache.revalidate_freq=60\nopcache.fast_shutdown=1\n" > /usr/local/etc/php/conf.d/opcache.ini \
    && printf "[www]\nlisten = 127.0.0.1:9000\npm = dynamic\npm.max_children = 16\npm.start_servers = 4\npm.min_spare_servers = 2\npm.max_spare_servers = 8\npm.max_requests = 500\nclear_env = no\n" > /usr/local/etc/php-fpm.d/zz-pulsescope.conf \
    && mkdir -p /run/nginx /etc/nginx/http.d \
    && printf 'server {\n    listen 8000 default_server;\n    server_name _;\n    root /var/www/html/public;\n    index index.php;\n    client_max_body_size 20M;\n    server_tokens off;\n\n    location / {\n        try_files $uri $uri/ /index.php?$query_string;\n    }\n\n    location ~ \\.php$ {\n        include fastcgi_params;\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        fastcgi_pass 127.0.0.1:9000;\n        fastcgi_read_timeout 120s;\n        fastcgi_buffers 16 16k;\n        fastcgi_buffer_size 32k;\n    }\n}\n' > /etc/nginx/http.d/default.conf

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader

COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative \
    && mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

EXPOSE 8000

CMD ["sh", "-c", "php-fpm -D && exec nginx -g 'daemon off;'"]

