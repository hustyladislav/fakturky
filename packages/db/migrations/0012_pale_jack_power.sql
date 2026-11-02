CREATE TYPE "public"."bank_transaction_match_status" AS ENUM('unmatched', 'matched', 'ignored');--> statement-breakpoint
CREATE TABLE "bank_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"bank_account_id" text NOT NULL,
	"booked_on" text NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"currency" text NOT NULL,
	"variable_symbol" text,
	"constant_symbol" text,
	"specific_symbol" text,
	"counterparty_account" text,
	"counterparty_name" text,
	"message" text,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"match_status" "bank_transaction_match_status" DEFAULT 'unmatched' NOT NULL,
	"matched_document_id" text,
	"payment_id" text,
	"matched_amount" numeric(19, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_matched_document_id_document_id_fk" FOREIGN KEY ("matched_document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transaction_account_external_uq" ON "bank_transaction" USING btree ("bank_account_id","external_id");--> statement-breakpoint
CREATE INDEX "bank_transaction_org_status_idx" ON "bank_transaction" USING btree ("organization_id","match_status","booked_on");--> statement-breakpoint
CREATE INDEX "bank_transaction_org_document_idx" ON "bank_transaction" USING btree ("organization_id","matched_document_id");--> statement-breakpoint
CREATE INDEX "bank_transaction_org_vs_idx" ON "bank_transaction" USING btree ("organization_id","variable_symbol");