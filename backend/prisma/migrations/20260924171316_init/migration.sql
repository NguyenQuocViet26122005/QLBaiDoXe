-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('RESIDENT', 'GUARD', 'MANAGER', 'ADMIN') NOT NULL DEFAULT 'RESIDENT',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Apartment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `building` VARCHAR(30) NOT NULL,
    `floor` INTEGER NOT NULL,
    `apartmentNumber` VARCHAR(30) NOT NULL,
    `ownerName` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Apartment_building_apartmentNumber_key`(`building`, `apartmentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resident` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `apartmentId` INTEGER NULL,
    `residentCode` VARCHAR(30) NOT NULL,
    `identityNumber` VARCHAR(30) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Resident_userId_key`(`userId`),
    UNIQUE INDEX `Resident_residentCode_key`(`residentCode`),
    UNIQUE INDEX `Resident_identityNumber_key`(`identityNumber`),
    INDEX `Resident_apartmentId_idx`(`apartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `residentId` INTEGER NOT NULL,
    `licensePlate` VARCHAR(30) NOT NULL,
    `normalizedPlate` VARCHAR(30) NOT NULL,
    `type` ENUM('MOTORBIKE', 'CAR', 'BICYCLE', 'ELECTRIC_BIKE') NOT NULL,
    `brand` VARCHAR(60) NULL,
    `model` VARCHAR(60) NULL,
    `color` VARCHAR(40) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_normalizedPlate_key`(`normalizedPlate`),
    INDEX `Vehicle_residentId_idx`(`residentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingArea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParkingArea_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `vehicleType` ENUM('MOTORBIKE', 'CAR', 'BICYCLE', 'ELECTRIC_BIKE') NOT NULL,
    `monthlyPrice` DECIMAL(12, 2) NOT NULL,
    `durationMonths` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParkingPlan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PriceConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `areaId` INTEGER NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PriceConfig_planId_areaId_effectiveFrom_idx`(`planId`, `areaId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingRegistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `residentId` INTEGER NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `areaId` INTEGER NOT NULL,
    `type` ENUM('NEW', 'RENEWAL') NOT NULL DEFAULT 'NEW',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `quotedAmount` DECIMAL(12, 2) NOT NULL,
    `requestedStartDate` DATETIME(3) NOT NULL,
    `note` VARCHAR(500) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `reviewerId` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `previousTicketId` INTEGER NULL,
    `openRequestKey` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParkingRegistration_openRequestKey_key`(`openRequestKey`),
    INDEX `ParkingRegistration_residentId_status_idx`(`residentId`, `status`),
    INDEX `ParkingRegistration_vehicleId_status_idx`(`vehicleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingTicket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registrationId` INTEGER NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `areaId` INTEGER NOT NULL,
    `ticketCode` VARCHAR(40) NOT NULL,
    `qrToken` VARCHAR(128) NOT NULL,
    `qrVersion` INTEGER NOT NULL DEFAULT 1,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'LOCKED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `lockReason` VARCHAR(500) NULL,
    `lostReportedAt` DATETIME(3) NULL,
    `activeVehicleKey` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParkingTicket_registrationId_key`(`registrationId`),
    UNIQUE INDEX `ParkingTicket_ticketCode_key`(`ticketCode`),
    UNIQUE INDEX `ParkingTicket_qrToken_key`(`qrToken`),
    UNIQUE INDEX `ParkingTicket_activeVehicleKey_key`(`activeVehicleKey`),
    INDEX `ParkingTicket_vehicleId_status_endDate_idx`(`vehicleId`, `status`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registrationId` INTEGER NOT NULL,
    `ticketId` INTEGER NULL,
    `paymentCode` VARCHAR(40) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(100) NULL,
    `confirmedById` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_paymentCode_key`(`paymentCode`),
    INDEX `Payment_registrationId_status_idx`(`registrationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `ticketId` INTEGER NOT NULL,
    `areaId` INTEGER NOT NULL,
    `checkInGuardId` INTEGER NOT NULL,
    `checkOutGuardId` INTEGER NULL,
    `checkInGate` VARCHAR(50) NOT NULL,
    `checkOutGate` VARCHAR(50) NULL,
    `checkInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkOutAt` DATETIME(3) NULL,
    `status` ENUM('PARKING', 'COMPLETED', 'ABNORMAL') NOT NULL DEFAULT 'PARKING',
    `abnormalReason` VARCHAR(500) NULL,
    `openVehicleKey` VARCHAR(60) NULL,

    UNIQUE INDEX `ParkingSession_openVehicleKey_key`(`openVehicleKey`),
    INDEX `ParkingSession_vehicleId_status_idx`(`vehicleId`, `status`),
    INDEX `ParkingSession_checkInAt_idx`(`checkInAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Violation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `ticketId` INTEGER NULL,
    `sessionId` INTEGER NULL,
    `guardId` INTEGER NOT NULL,
    `type` ENUM('INVALID_QR', 'EXPIRED_TICKET', 'WRONG_VEHICLE', 'UNAUTHORIZED_VEHICLE', 'OTHER') NOT NULL,
    `description` VARCHAR(1000) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(1000) NULL,
    `resolvedById` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `fineAmount` DECIMAL(12, 2) NULL,

    INDEX `Violation_vehicleId_status_idx`(`vehicleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `residentId` INTEGER NULL,
    `type` ENUM('REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'TICKET_EXPIRING', 'TICKET_EXPIRED', 'QR_LOST', 'TICKET_LOCKED', 'VIOLATION', 'SYSTEM') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `dedupKey` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_dedupKey_key`(`dedupKey`),
    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `replacedByHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Resident` ADD CONSTRAINT `Resident_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resident` ADD CONSTRAINT `Resident_apartmentId_fkey` FOREIGN KEY (`apartmentId`) REFERENCES `Apartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `Resident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PriceConfig` ADD CONSTRAINT `PriceConfig_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ParkingPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PriceConfig` ADD CONSTRAINT `PriceConfig_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `ParkingArea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `Resident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ParkingPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `ParkingArea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingRegistration` ADD CONSTRAINT `ParkingRegistration_previousTicketId_fkey` FOREIGN KEY (`previousTicketId`) REFERENCES `ParkingTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingTicket` ADD CONSTRAINT `ParkingTicket_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `ParkingRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingTicket` ADD CONSTRAINT `ParkingTicket_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingTicket` ADD CONSTRAINT `ParkingTicket_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ParkingPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingTicket` ADD CONSTRAINT `ParkingTicket_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `ParkingArea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `ParkingRegistration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ParkingTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSession` ADD CONSTRAINT `ParkingSession_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSession` ADD CONSTRAINT `ParkingSession_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ParkingTicket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSession` ADD CONSTRAINT `ParkingSession_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `ParkingArea`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSession` ADD CONSTRAINT `ParkingSession_checkInGuardId_fkey` FOREIGN KEY (`checkInGuardId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSession` ADD CONSTRAINT `ParkingSession_checkOutGuardId_fkey` FOREIGN KEY (`checkOutGuardId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Violation` ADD CONSTRAINT `Violation_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Violation` ADD CONSTRAINT `Violation_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ParkingTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Violation` ADD CONSTRAINT `Violation_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ParkingSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Violation` ADD CONSTRAINT `Violation_guardId_fkey` FOREIGN KEY (`guardId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Violation` ADD CONSTRAINT `Violation_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_residentId_fkey` FOREIGN KEY (`residentId`) REFERENCES `Resident`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
