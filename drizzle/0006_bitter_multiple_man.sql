DROP INDEX `days_date_unique`;--> statement-breakpoint
ALTER TABLE `days` ADD `user_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `days_user_date_idx` ON `days` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `entries` ADD `user_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `meal_ingredients` ADD `user_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `meals` ADD `user_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `user_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_idx` ON `settings` (`user_id`);