CREATE TABLE "org_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"data" text NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_profile" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "business_profile" ADD COLUMN "show_brand" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "appearance" jsonb;--> statement-breakpoint
ALTER TABLE "org_asset" ADD CONSTRAINT "org_asset_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_asset_org_kind_current_uq" ON "org_asset" USING btree ("organization_id","kind") WHERE "org_asset"."superseded_at" is null;