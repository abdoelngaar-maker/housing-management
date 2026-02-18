-- ============================================
-- Housing Management System - Database Schema
-- Run this script to initialize the database
-- ============================================

CREATE TABLE IF NOT EXISTS `users` (
    `id` int AUTO_INCREMENT NOT NULL,
    `openId` varchar(64) NOT NULL,
    `name` text,
    `email` varchar(320),
    `loginMethod` varchar(64),
    `role` enum('user','admin') NOT NULL DEFAULT 'user',
    `sectorId` int,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT `users_id` PRIMARY KEY(`id`),
    CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

CREATE TABLE IF NOT EXISTS `sectors` (
    `id` int AUTO_INCREMENT NOT NULL,
    `name` varchar(200) NOT NULL,
    `code` varchar(50) NOT NULL,
    `description` text,
    `color` varchar(20) DEFAULT '#3b82f6',
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `sectors_id` PRIMARY KEY(`id`),
    CONSTRAINT `sectors_name_unique` UNIQUE(`name`),
    CONSTRAINT `sectors_code_unique` UNIQUE(`code`)
);

CREATE TABLE IF NOT EXISTS `units` (
    `id` int AUTO_INCREMENT NOT NULL,
    `code` varchar(50) NOT NULL,
    `name` varchar(200) NOT NULL,
    `type` enum('apartment','chalet') NOT NULL,
    `sectorId` int,
    `floor` varchar(20),
    `rooms` int NOT NULL DEFAULT 1,
    `beds` int NOT NULL DEFAULT 1,
    `status` enum('vacant','occupied','maintenance') NOT NULL DEFAULT 'vacant',
    `currentOccupants` int NOT NULL DEFAULT 0,
    `notes` text,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `units_id` PRIMARY KEY(`id`),
    CONSTRAINT `units_code_unique` UNIQUE(`code`)
);

CREATE TABLE IF NOT EXISTS `egyptian_residents` (
    `id` int AUTO_INCREMENT NOT NULL,
    `name` varchar(200) NOT NULL,
    `nationalId` varchar(20) NOT NULL,
    `phone` varchar(20),
    `shift` varchar(50),
    `unitId` int,
    `checkInDate` bigint,
    `checkOutDate` bigint,
    `status` enum('active','checked_out','transferred') NOT NULL DEFAULT 'active',
    `ocrConfidence` int,
    `imageUrl` text,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `egyptian_residents_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `russian_residents` (
    `id` int AUTO_INCREMENT NOT NULL,
    `name` varchar(200) NOT NULL,
    `passportNumber` varchar(50) NOT NULL,
    `nationality` varchar(100) NOT NULL DEFAULT 'Russian',
    `gender` enum('male','female') NOT NULL,
    `phone` varchar(20),
    `shift` varchar(50),
    `unitId` int,
    `checkInDate` bigint,
    `checkOutDate` bigint,
    `status` enum('active','checked_out','transferred') NOT NULL DEFAULT 'active',
    `ocrConfidence` int,
    `imageUrl` text,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `russian_residents_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `occupancy_records` (
    `id` int AUTO_INCREMENT NOT NULL,
    `residentType` enum('egyptian','russian') NOT NULL,
    `residentId` int NOT NULL,
    `residentName` varchar(200) NOT NULL,
    `unitId` int NOT NULL,
    `unitCode` varchar(50) NOT NULL,
    `action` enum('check_in','check_out','transfer_in','transfer_out') NOT NULL,
    `fromUnitId` int,
    `fromUnitCode` varchar(50),
    `notes` text,
    `actionDate` bigint NOT NULL,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT `occupancy_records_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `import_logs` (
    `id` int AUTO_INCREMENT NOT NULL,
    `fileName` varchar(255) NOT NULL,
    `totalRows` int NOT NULL DEFAULT 0,
    `successRows` int NOT NULL DEFAULT 0,
    `failedRows` int NOT NULL DEFAULT 0,
    `errors` json,
    `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    `importedBy` varchar(200),
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT `import_logs_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` int AUTO_INCREMENT NOT NULL,
    `title` varchar(200) NOT NULL,
    `message` text NOT NULL,
    `type` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
    `isRead` int NOT NULL DEFAULT 0,
    `userId` int,
    `sectorId` int,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
