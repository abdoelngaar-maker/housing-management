CREATE TABLE `sectors` (
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
--> statement-breakpoint
ALTER TABLE `notifications` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `sectorId` int;--> statement-breakpoint
ALTER TABLE `units` ADD `sectorId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `sectorId` int;