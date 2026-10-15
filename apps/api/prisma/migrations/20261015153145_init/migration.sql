-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `accountStatus` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `verificationStatus` ENUM('UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'UNSUBMITTED',
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `dateOfBirth` DATE NULL,
    `cinNumber` VARCHAR(191) NULL,
    `cinExpiresAt` DATE NULL,
    `identitySubmittedAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_cinNumber_key`(`cinNumber`),
    INDEX `User_verificationStatus_identitySubmittedAt_idx`(`verificationStatus`, `identitySubmittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
    INDEX `AuthSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdentityDocument` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `side` ENUM('FRONT', 'BACK') NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supersededAt` DATETIME(3) NULL,

    UNIQUE INDEX `IdentityDocument_storageKey_key`(`storageKey`),
    INDEX `IdentityDocument_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationReview` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `reviewerId` CHAR(36) NOT NULL,
    `decision` ENUM('UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationReview_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DrawSession` (
    `id` CHAR(36) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'PAUSED', 'FULL', 'SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `entryPriceCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `targetEntries` INTEGER NOT NULL,
    `confirmedEntries` INTEGER NOT NULL DEFAULT 0,
    `allowOverfill` BOOLEAN NOT NULL DEFAULT false,
    `maxEntriesPerUser` INTEGER NULL,
    `winnerCount` INTEGER NOT NULL DEFAULT 1,
    `drawTimeOfDay` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Africa/Casablanca',
    `drawDelayMinutes` INTEGER NULL,
    `opensAt` DATETIME(3) NULL,
    `closesAt` DATETIME(3) NULL,
    `filledAt` DATETIME(3) NULL,
    `drawScheduledAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DrawSession_number_key`(`number`),
    INDEX `DrawSession_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` CHAR(36) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `provider` VARCHAR(191) NOT NULL,
    `providerTransactionId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `failureReason` TEXT NULL,
    `checkoutUrl` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `providerPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Payment_reference_key`(`reference`),
    UNIQUE INDEX `Payment_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Payment_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `Payment_userId_idx`(`userId`),
    INDEX `Payment_status_expiresAt_idx`(`status`, `expiresAt`),
    UNIQUE INDEX `Payment_provider_providerTransactionId_key`(`provider`, `providerTransactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entry` (
    `id` CHAR(36) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `paymentId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'VOID') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Entry_reference_key`(`reference`),
    UNIQUE INDEX `Entry_paymentId_key`(`paymentId`),
    INDEX `Entry_userId_idx`(`userId`),
    UNIQUE INDEX `Entry_sessionId_sequence_key`(`sessionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Draw` (
    `id` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `scheduledAt` DATETIME(3) NOT NULL,
    `seedHash` VARCHAR(191) NOT NULL,
    `seed` VARCHAR(191) NULL,
    `entriesHash` VARCHAR(191) NULL,
    `entryCount` INTEGER NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Draw_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DrawWinner` (
    `id` CHAR(36) NOT NULL,
    `drawId` CHAR(36) NOT NULL,
    `entryId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `DrawWinner_drawId_position_key`(`drawId`, `position`),
    UNIQUE INDEX `DrawWinner_drawId_entryId_key`(`drawId`, `entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdentityDocument` ADD CONSTRAINT `IdentityDocument_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationReview` ADD CONSTRAINT `VerificationReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationReview` ADD CONSTRAINT `VerificationReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DrawSession` ADD CONSTRAINT `DrawSession_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DrawSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DrawSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Draw` ADD CONSTRAINT `Draw_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DrawSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DrawWinner` ADD CONSTRAINT `DrawWinner_drawId_fkey` FOREIGN KEY (`drawId`) REFERENCES `Draw`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DrawWinner` ADD CONSTRAINT `DrawWinner_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `Entry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
