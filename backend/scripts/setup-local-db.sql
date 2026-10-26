-- Tạo database + tài khoản cục bộ cho backend (chạy bằng tài khoản root một lần).
-- mysql -u root -p -e "source setup-local-db.sql"
CREATE DATABASE IF NOT EXISTS monthly_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS test_monthly_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS 'parking_user'@'localhost';
DROP USER IF EXISTS 'parking_user'@'127.0.0.1';
DROP USER IF EXISTS 'parking_user'@'%';
CREATE USER 'parking_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'parking_password';
CREATE USER 'parking_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'parking_password';
CREATE USER 'parking_user'@'%' IDENTIFIED WITH mysql_native_password BY 'parking_password';
GRANT ALL PRIVILEGES ON monthly_parking.* TO 'parking_user'@'localhost', 'parking_user'@'127.0.0.1', 'parking_user'@'%';
GRANT ALL PRIVILEGES ON test_monthly_parking.* TO 'parking_user'@'localhost', 'parking_user'@'127.0.0.1', 'parking_user'@'%';
-- Prisma migrate dev cần quyền tạo shadow database.
GRANT CREATE, DROP ON *.* TO 'parking_user'@'localhost', 'parking_user'@'127.0.0.1', 'parking_user'@'%';
FLUSH PRIVILEGES;
SELECT user, host, plugin FROM mysql.user WHERE user IN ('parking_user', '');
SELECT 'XONG - parking_user da san sang' AS ket_qua;
