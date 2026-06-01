FROM php:8.2-apache

# PDO MySQL
RUN docker-php-ext-install pdo pdo_mysql

# mod_rewrite para URLs limpias
RUN a2enmod rewrite

# Permitir .htaccess en el document root
RUN printf '<Directory /var/www/html>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n' \
> /etc/apache2/conf-available/kinerva.conf \
&& a2enconf kinerva

EXPOSE 80
