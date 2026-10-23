CREATE TABLE `studio_events` (
	`id` text PRIMARY KEY NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `studio_handoffs` ADD `background` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_handoffs` ADD `snapshot_key` text;--> statement-breakpoint
ALTER TABLE `studio_handoffs` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_handoffs` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `studio_handoffs` ADD `error` text;--> statement-breakpoint
ALTER TABLE `studio_runs` ADD `provider` text DEFAULT 'openai' NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_runs` ADD `lease_until` integer;