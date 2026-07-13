CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`default_calorie_goal` integer DEFAULT 2000 NOT NULL,
	`updated_at` integer NOT NULL
);
