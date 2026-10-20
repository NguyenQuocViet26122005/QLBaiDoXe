ALTER TABLE `User`
  MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `ParkingTicket`
  MODIFY `status` ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'LOCKED', 'CANCELLED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `priceConfigId` INTEGER NULL;

ALTER TABLE `ParkingRegistration`
  ADD COLUMN `priceConfigId` INTEGER NULL,
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

UPDATE `ParkingRegistration`
SET `expiresAt` = DATE_ADD(`createdAt`, INTERVAL 30 DAY)
WHERE `expiresAt` IS NULL;

ALTER TABLE `ParkingRegistration`
  MODIFY `expiresAt` DATETIME(3) NOT NULL;

ALTER TABLE `Payment`
  ADD COLUMN `idempotencyKey` VARCHAR(100) NULL,
  ADD COLUMN `paidRegistrationKey` VARCHAR(60) NULL;

ALTER TABLE `ParkingSession`
  ADD COLUMN `checkInRequestKey` VARCHAR(100) NULL,
  ADD COLUMN `checkOutRequestKey` VARCHAR(100) NULL;

ALTER TABLE `Violation`
  ADD COLUMN `dedupKey` VARCHAR(100) NULL;

CREATE TABLE `AuditLog` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `actorId` INTEGER NULL,
  `actorRole` ENUM('RESIDENT', 'GUARD', 'MANAGER', 'ADMIN') NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `entity` VARCHAR(80) NOT NULL,
  `entityId` VARCHAR(80) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_entity_entityId_createdAt_idx` (`entity`, `entityId`, `createdAt`),
  INDEX `AuditLog_actorId_createdAt_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Payment_idempotencyKey_key` ON `Payment`(`idempotencyKey`);
CREATE UNIQUE INDEX `Payment_paidRegistrationKey_key` ON `Payment`(`paidRegistrationKey`);
CREATE UNIQUE INDEX `ParkingSession_checkInRequestKey_key` ON `ParkingSession`(`checkInRequestKey`);
CREATE UNIQUE INDEX `ParkingSession_checkOutRequestKey_key` ON `ParkingSession`(`checkOutRequestKey`);
CREATE UNIQUE INDEX `Violation_dedupKey_key` ON `Violation`(`dedupKey`);
CREATE INDEX `ParkingRegistration_expiresAt_status_idx` ON `ParkingRegistration`(`expiresAt`, `status`);

ALTER TABLE `ParkingRegistration`
  ADD CONSTRAINT `ParkingRegistration_priceConfigId_fkey` FOREIGN KEY (`priceConfigId`) REFERENCES `PriceConfig`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ParkingTicket`
  ADD CONSTRAINT `ParkingTicket_priceConfigId_fkey` FOREIGN KEY (`priceConfigId`) REFERENCES `PriceConfig`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog`
  ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ParkingArea` ADD CONSTRAINT `ParkingArea_capacity_check` CHECK (`capacity` >= 0);
ALTER TABLE `ParkingPlan` ADD CONSTRAINT `ParkingPlan_price_check` CHECK (`monthlyPrice` > 0 AND `durationMonths` > 0);
ALTER TABLE `PriceConfig` ADD CONSTRAINT `PriceConfig_dates_check` CHECK (`amount` > 0 AND (`effectiveTo` IS NULL OR `effectiveTo` > `effectiveFrom`));
ALTER TABLE `ParkingTicket` ADD CONSTRAINT `ParkingTicket_dates_check` CHECK (`endDate` > `startDate` AND `price` > 0);
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_amount_check` CHECK (`amount` > 0);
