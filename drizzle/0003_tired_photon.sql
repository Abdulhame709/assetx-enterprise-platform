CREATE TABLE `alertResolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertKey` varchar(191) NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`status` enum('acknowledged','resolved') NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertResolutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_resolution_user_key_unique` UNIQUE(`alertKey`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `siteRoleGrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int NOT NULL,
	`section` enum('energy','fuel') NOT NULL,
	`accessLevel` enum('viewer','operator','supervisor') NOT NULL,
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteRoleGrants_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_role_grant_unique` UNIQUE(`userId`,`siteId`,`section`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`city` varchar(120),
	`address` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `billingCycles` ADD `siteId` int;--> statement-breakpoint
ALTER TABLE `fuelProducts` ADD `siteId` int;--> statement-breakpoint
ALTER TABLE `generators` ADD `siteId` int;--> statement-breakpoint
ALTER TABLE `utilityMeters` ADD `siteId` int;--> statement-breakpoint
CREATE INDEX `alert_resolution_site_idx` ON `alertResolutions` (`siteId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `site_role_grant_user_idx` ON `siteRoleGrants` (`userId`,`section`);--> statement-breakpoint
CREATE INDEX `site_role_grant_site_idx` ON `siteRoleGrants` (`siteId`,`section`);--> statement-breakpoint
CREATE INDEX `site_active_idx` ON `sites` (`isActive`);--> statement-breakpoint
CREATE INDEX `billing_cycle_site_period_idx` ON `billingCycles` (`siteId`,`periodStart`);--> statement-breakpoint
CREATE INDEX `fuel_product_site_idx` ON `fuelProducts` (`siteId`);--> statement-breakpoint
CREATE INDEX `generator_site_idx` ON `generators` (`siteId`);--> statement-breakpoint
CREATE INDEX `utility_meter_site_idx` ON `utilityMeters` (`siteId`);