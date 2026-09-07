CREATE TABLE `alertActionHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertKey` varchar(191) NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`action` enum('acknowledged','resolved','reopened') NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertActionHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `alert_action_history_user_key_idx` ON `alertActionHistory` (`userId`,`alertKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `alert_action_history_site_idx` ON `alertActionHistory` (`siteId`,`createdAt`);