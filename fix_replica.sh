#!/bin/bash
set -e

echo "Generating MongoDB keyFile..."
openssl rand -base64 756 > /var/lib/mongodb/mongo.key
chown mongodb:mongodb /var/lib/mongodb/mongo.key
chmod 400 /var/lib/mongodb/mongo.key

echo "Updating mongod.conf..."
# Ensure keyFile is added under security:
if ! grep -q "keyFile" /etc/mongod.conf; then
    sed -i '/^security:/a \  keyFile: /var/lib/mongodb/mongo.key' /etc/mongod.conf
fi

echo "Restarting MongoDB..."
systemctl restart mongod
sleep 5

echo "Initializing replica set..."
mongosh -u admin -p "rP&tEam/mD-19yY" --authenticationDatabase admin --eval 'rs.initiate()' || echo "Replica set might already be initialized."

echo "Updating MONGODB_URI to include replicaSet=rs0..."
if ! grep -q "replicaSet=rs0" /var/www/pairolifestyle.com/.env.local; then
    sed -i 's/authSource=pairo/authSource=pairo\&replicaSet=rs0/' /var/www/pairolifestyle.com/.env.local
fi

echo "Restarting PM2 to establish new connections..."
pm2 restart all --update-env

echo "Done!"
