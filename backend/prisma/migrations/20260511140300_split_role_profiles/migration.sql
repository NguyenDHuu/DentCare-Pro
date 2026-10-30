-- AlterTable
ALTER TABLE `user` ADD COLUMN `lockReason` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AdminProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `avatar` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NULL,
    `issuePlace` VARCHAR(191) NULL,
    `hometown` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `specialization` VARCHAR(191) NULL,
    `degree` VARCHAR(191) NULL,
    `educationLevel` VARCHAR(191) NULL,
    `graduatedSchool` VARCHAR(191) NULL,
    `graduationYear` INTEGER NULL,
    `certificateNumber` VARCHAR(191) NULL,
    `certificateIssueDate` DATETIME(3) NULL,
    `certificateExpiryDate` DATETIME(3) NULL,
    `yearsOfExperience` INTEGER NULL,
    `professionalSkills` JSON NULL,
    `systemPermissions` JSON NULL,
    `languages` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceptionistProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `avatar` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NULL,
    `issuePlace` VARCHAR(191) NULL,
    `hometown` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `educationLevel` VARCHAR(191) NULL,
    `graduatedSchool` VARCHAR(191) NULL,
    `graduationYear` INTEGER NULL,
    `yearsOfExperience` INTEGER NULL,
    `professionalSkills` JSON NULL,
    `languages` JSON NULL,
    `computerSkills` JSON NULL,
    `customerServiceLevel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReceptionistProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountantProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `avatar` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NULL,
    `issuePlace` VARCHAR(191) NULL,
    `hometown` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `specialization` VARCHAR(191) NULL,
    `degree` VARCHAR(191) NULL,
    `educationLevel` VARCHAR(191) NULL,
    `graduatedSchool` VARCHAR(191) NULL,
    `graduationYear` INTEGER NULL,
    `certificateNumber` VARCHAR(191) NULL,
    `certificateIssueDate` DATETIME(3) NULL,
    `certificateExpiryDate` DATETIME(3) NULL,
    `yearsOfExperience` INTEGER NULL,
    `professionalSkills` JSON NULL,
    `softwareSkills` JSON NULL,
    `languages` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccountantProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DoctorProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `phone` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `avatar` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `issueDate` DATETIME(3) NULL,
    `issuePlace` VARCHAR(191) NULL,
    `hometown` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `specialization` VARCHAR(191) NULL,
    `degree` VARCHAR(191) NULL,
    `educationLevel` VARCHAR(191) NULL,
    `graduatedSchool` VARCHAR(191) NULL,
    `graduationYear` INTEGER NULL,
    `licenseNumber` VARCHAR(191) NULL,
    `licenseIssueDate` DATETIME(3) NULL,
    `licenseExpiryDate` DATETIME(3) NULL,
    `yearsOfExperience` INTEGER NULL,
    `professionalSkills` JSON NULL,
    `servicesCanPerform` JSON NULL,
    `languages` JSON NULL,
    `employmentStatus` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `workType` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `contractNumber` VARCHAR(191) NULL,
    `scheduleType` VARCHAR(191) NULL,
    `workingDays` JSON NULL,
    `shiftStart` VARCHAR(191) NULL,
    `shiftEnd` VARCHAR(191) NULL,
    `maxAppointmentsPerDay` INTEGER NULL,
    `appointmentDuration` INTEGER NULL,
    `isAvailableOnline` BOOLEAN NOT NULL DEFAULT false,
    `baseSalary` DECIMAL(12, 2) NULL,
    `salaryType` VARCHAR(191) NULL,
    `commissionRate` DECIMAL(5, 2) NULL,
    `bankAccountName` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountNumber` VARCHAR(191) NULL,
    `taxCode` VARCHAR(191) NULL,
    `insuranceNumber` VARCHAR(191) NULL,
    `qualificationFiles` JSON NULL,
    `licenseFiles` JSON NULL,
    `identityFiles` JSON NULL,
    `contractFiles` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DoctorProfile_userId_key`(`userId`),
    UNIQUE INDEX `DoctorProfile_licenseNumber_key`(`licenseNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminProfile` ADD CONSTRAINT `AdminProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceptionistProfile` ADD CONSTRAINT `ReceptionistProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountantProfile` ADD CONSTRAINT `AccountantProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DoctorProfile` ADD CONSTRAINT `DoctorProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
