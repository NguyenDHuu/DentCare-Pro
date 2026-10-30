-- CreateTable: SMS Gateway config (singleton, id always = 1)
CREATE TABLE `SmsConfig` (
    `id`          INTEGER NOT NULL,
    `isEnabled`   BOOLEAN NOT NULL DEFAULT true,
    `provider`    VARCHAR(191) NOT NULL DEFAULT 'VIETTEL',
    `apiKey`      TEXT NULL,
    `brandname`   VARCHAR(191) NOT NULL DEFAULT 'DentCare',
    `dailyLimit`  INTEGER NOT NULL DEFAULT 500,
    `quietStart`  VARCHAR(10) NOT NULL DEFAULT '21:00',
    `quietEnd`    VARCHAR(10) NOT NULL DEFAULT '07:00',
    `updatedAt`   DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: SMS templates per event type
CREATE TABLE `SmsTemplate` (
    `id`        INTEGER NOT NULL AUTO_INCREMENT,
    `type`      VARCHAR(191) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `content`   TEXT NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SmsTemplate_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: SMS send logs
CREATE TABLE `SmsLog` (
    `id`            INTEGER NOT NULL AUTO_INCREMENT,
    `recipientName` VARCHAR(191) NULL,
    `phone`         VARCHAR(191) NOT NULL,
    `type`          VARCHAR(191) NOT NULL,
    `status`        VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `content`       TEXT NOT NULL,
    `retryCount`    INTEGER NOT NULL DEFAULT 0,
    `errorMsg`      VARCHAR(191) NULL,
    `sentAt`        DATETIME(3) NULL,
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SmsLog_status_idx`(`status`),
    INDEX `SmsLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
