#!/bin/bash

set -euo pipefail

DIR_NAME=$(basename "$PWD")

echo "===> INFO:: Running deployment for $DIR_NAME "

echo "===> INFO:: Pulling latest code from development branch..."
git pull origin development || { echo "Git pull failed"; exit 1; }

echo "===> INFO:: Entering Backend..."
cd Backend || { echo "Backend folder not found"; exit 1; }

echo "===> INFO:: Installing Dependencies..."
if [ -f "composer.json" ]; then
  composer install --no-interaction --prefer-dist --optimize-autoloader
else
  echo "composer.json not found in backend directory"
  exit 1
fi

php artisan down || true

echo "===> INFO:: Running Migrations..."
php artisan migrate || { echo "Migration failed"; exit 1; }

echo "===> INFO:: Running Seeder based on directory..."

case "$DIR_NAME" in
    mes|dev-mes)
        php artisan db:seed || { echo "Seeder failed"; exit 1; }
        ;;
    btl-mes|sct-mes|erp-mes)
        php artisan db:seed --class=btlSeeder || { echo "Seeder failed"; exit 1; }
        ;;
    *)
        echo "No seeder configured for $DIR_NAME"
        ;;
esac

echo "===> INFO:: Clearing Cache..."
php artisan optimize:clear
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "===> INFO:: Starting Backend..."
php artisan up

echo "===> INFO:: Exiting Backend..."
cd ..

echo "===> INFO:: Backend Deployed Successfully for $DIR_NAME"
