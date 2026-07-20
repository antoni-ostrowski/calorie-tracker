CREATE TABLE `meal_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meal_id` integer NOT NULL,
	`name` text NOT NULL,
	`calories` real NOT NULL,
	`protein` real,
	`carbs` real,
	`fat` real,
	`grams` real DEFAULT 100 NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`calories` real NOT NULL,
	`protein` real,
	`carbs` real,
	`fat` real,
	`grams` real DEFAULT 100 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `entries` ADD `meal_details` text;