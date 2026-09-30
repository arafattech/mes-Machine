#!/bin/bash

set -euo pipefail

echo "===> Restarting Backend Server"
 cd Backend || { echo "Backend folder not found"; exit 1; }
    php artisan octane:reload --server=roadrunner|| true
    cd .. || { echo "Root folder not found"; exit 1; }

echo "==> Backend Server Restarted Successfully"
echo "===> Restarting Node Server"
cd node-server || { echo "Node-Server folder not found"; exit 1; }
pm2 reload all || { echo "Node Server reload failed"; exit 1; }
cd .. || { echo "Root folder not found"; exit 1; }
echo "==> Node Server Restarted Successfully"

echo "Servers Restarted Successfully"
echo "===> Servers Status:"
pm2 status || { echo "Status failed"; exit 1; }
cd Backend || { echo "Backend folder not found"; exit 1; }
php artisan octane:status || { echo "Octane status failed"; exit 1; }
cd .. || { echo "Root folder not found"; exit 1; }