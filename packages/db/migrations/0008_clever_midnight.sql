ALTER TABLE "contact" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "imported_from" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "document_org_external_idx" ON "document" USING btree ("organization_id","imported_from","external_id");