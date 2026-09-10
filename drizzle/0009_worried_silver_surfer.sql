CREATE TABLE `userInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(180) NOT NULL,
	`role` enum('user','admin','energy_operator','accountant','maintenance','reviewer','auditor','management') NOT NULL DEFAULT 'user',
	`status` enum('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
	`invitedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userInvitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `user_invitation_email_idx` ON `userInvitations` (`email`,`status`);--> statement-breakpoint
CREATE INDEX `user_invitation_status_idx` ON `userInvitations` (`status`,`createdAt`);