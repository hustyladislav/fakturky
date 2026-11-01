ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "apikey" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passkey" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "apikey" CASCADE;--> statement-breakpoint
DROP TABLE "invitation" CASCADE;--> statement-breakpoint
DROP TABLE "member" CASCADE;--> statement-breakpoint
DROP TABLE "passkey" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
ALTER TABLE "organization" DROP CONSTRAINT "organization_slug_unique";--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "logo";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "metadata";