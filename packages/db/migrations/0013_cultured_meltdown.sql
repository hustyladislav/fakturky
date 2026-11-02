ALTER TABLE "bank_account" ADD COLUMN "fio_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "fio_last_request_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "fio_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "fio_synced_through" text;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "fio_last_error" text;