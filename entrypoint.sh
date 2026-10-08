#!/bin/sh

echo "=== Starting Container Entrypoint ==="

# External database (e.g. TiDB Cloud / Aiven MySQL): DB_URL, DB_USERNAME, DB_PASSWORD
# (+ optional DB_DRIVER, HIBERNATE_DIALECT) are read by Spring from the environment.
# Data persists across restarts and deploys. Without DB_URL we fall back to the
# throw-away MariaDB below (data is wiped on every restart).
if [ -n "$DB_URL" ]; then
    echo "Using external database from DB_URL (in-container MariaDB not started)"
    exec java -Dserver.port="${PORT:-8080}" -jar app.jar
fi
echo "⚠️ DB_URL not set — using in-container MariaDB (data is lost on restart/redeploy)"

# Create directories and set permissions
mkdir -p /run/mysqld /var/lib/mysql
chown -R mysql:mysql /run/mysqld /var/lib/mysql

# Delete any default Alpine config files to avoid overrides
rm -f /etc/my.cnf.d/*

# Create a clean, custom /etc/my.cnf that enables TCP networking
cat > /etc/my.cnf <<EOF
[mysqld]
user=mysql
datadir=/var/lib/mysql
socket=/run/mysqld/mysqld.sock
bind-address=0.0.0.0
port=3306
skip-name-resolve
skip-networking=0
EOF

# Always re-initialize (Render containers are ephemeral anyway)
echo "Initializing MariaDB database..."
rm -rf /var/lib/mysql/*
mysql_install_db --user=mysql --datadir=/var/lib/mysql 2>&1 || mariadb-install-db --user=mysql --datadir=/var/lib/mysql 2>&1
echo "Database initialization complete."

# Start MariaDB with skip-grant-tables using the custom config file
echo "Starting MariaDB (skip-grant-tables)..."
/usr/bin/mysqld --defaults-file=/etc/my.cnf --skip-grant-tables &
MYSQL_PID=$!

# Wait for socket file to appear, then test connection
echo "Waiting for MariaDB to start..."
CONNECTED=0
for i in $(seq 1 60); do
    if [ -S /run/mysqld/mysqld.sock ]; then
        if mysql --socket=/run/mysqld/mysqld.sock -u root -e "SELECT 1" 2>/dev/null; then
            echo "✅ MariaDB ready! (attempt $i)"
            CONNECTED=1
            break
        fi
    fi
    sleep 1
done

if [ "$CONNECTED" -ne 1 ]; then
    echo "❌ MariaDB failed to start."
    cat /var/lib/mysql/*.err 2>/dev/null || true
    ps aux
    exit 1
fi

# Create database
mysql --socket=/run/mysqld/mysqld.sock -u root -e "CREATE DATABASE IF NOT EXISTS todo;"
echo "✅ Database 'todo' created."

# Stop MariaDB safely
echo "Stopping MariaDB for auth setup..."
mysqladmin --socket=/run/mysqld/mysqld.sock -u root shutdown 2>/dev/null || kill -9 $MYSQL_PID 2>/dev/null || true
sleep 1

# Clean up socket file to avoid stale connection issues
rm -f /run/mysqld/mysqld.sock

# Wait for process to fully exit
for i in $(seq 1 10); do
    if ! ps -p $MYSQL_PID > /dev/null 2>&1; then
        echo "MariaDB stopped."
        break
    fi
    sleep 1
done

# Restart MariaDB normally with auth enabled
echo "Restarting MariaDB with auth..."
/usr/bin/mysqld --defaults-file=/etc/my.cnf &
MYSQL_PID=$!

# Wait for restart
for i in $(seq 1 30); do
    if [ -S /run/mysqld/mysqld.sock ]; then
        if mysql --socket=/run/mysqld/mysqld.sock -u root -e "SELECT 1" 2>/dev/null; then
            break
        fi
    fi
    sleep 1
done

# Set root password using MariaDB-compatible syntax
mysql --socket=/run/mysqld/mysqld.sock -u root -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('2205');" 2>/dev/null || true
mysql --socket=/run/mysqld/mysqld.sock -u root -p2205 -e "GRANT ALL ON *.* TO 'root'@'127.0.0.1' IDENTIFIED BY '2205'; FLUSH PRIVILEGES;" 2>/dev/null || true
echo "✅ Auth configured."

# Verify TCP connection works
if mysql -u root -p2205 -h 127.0.0.1 -P 3306 -e "SELECT 1" 2>/dev/null; then
    echo "✅ TCP connection with password verified!"
else
    echo "⚠️ TCP verify failed - trying without password..."
fi

# Start Spring Boot
echo "=== Starting Spring Boot Application ==="
DB_URL="jdbc:mariadb://127.0.0.1:3306/todo?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
DB_USERNAME="root"
DB_PASSWORD="2205"
DB_DRIVER="org.mariadb.jdbc.Driver"
APP_PORT="${PORT:-8080}"

echo "Database URL: $DB_URL"
echo "Server Port: $APP_PORT"
echo "Starting application..."

exec java \
  -Dspring.datasource.url="$DB_URL" \
  -Dspring.datasource.username="$DB_USERNAME" \
  -Dspring.datasource.password="$DB_PASSWORD" \
  -Dspring.datasource.driver-class-name="$DB_DRIVER" \
  -Dspring.jpa.database-platform=org.hibernate.dialect.MariaDBDialect \
  -Dserver.port="$APP_PORT" \
  -jar app.jar
