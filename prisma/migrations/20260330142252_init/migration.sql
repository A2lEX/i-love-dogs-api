-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('donor', 'curator', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "DogGender" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "DogStatus" AS ENUM ('active', 'adopted', 'deceased', 'archived');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('medical', 'sterilization', 'food', 'custom');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PatronageType" AS ENUM ('exclusive', 'regular');

-- CreateEnum
CREATE TYPE "PatronageStatus" AS ENUM ('active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "WalkStatus" AS ENUM ('pending', 'confirmed', 'started', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('yookassa', 'stripe');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "AnonDonationStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('general', 'medical', 'walk', 'adoption');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curator_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shelter_name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "verify_status" "VerifyStatus" NOT NULL,
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "rejection_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dogs" (
    "id" UUID NOT NULL,
    "curator_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "breed" VARCHAR(100),
    "age_months" INTEGER,
    "gender" "DogGender" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DogStatus" NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "cover_photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "dog_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "amount_target" INTEGER NOT NULL,
    "amount_collected" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "status" "GoalStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patronages" (
    "id" UUID NOT NULL,
    "dog_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PatronageType" NOT NULL,
    "status" "PatronageStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patronages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "walks" (
    "id" UUID NOT NULL,
    "dog_id" UUID NOT NULL,
    "walker_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 60,
    "status" "WalkStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "report_text" TEXT,
    "report_photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "walks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "patronage_id" UUID,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anon_donations" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100),
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "status" "AnonDonationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anon_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "dog_id" UUID NOT NULL,
    "curator_id" UUID NOT NULL,
    "type" "ReportType" NOT NULL,
    "content" TEXT NOT NULL,
    "photo_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "curator_profiles_user_id_key" ON "curator_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "anon_donations_provider_ref_key" ON "anon_donations"("provider_ref");

-- AddForeignKey
ALTER TABLE "curator_profiles" ADD CONSTRAINT "curator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dogs" ADD CONSTRAINT "dogs_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "curator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patronages" ADD CONSTRAINT "patronages_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patronages" ADD CONSTRAINT "patronages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walks" ADD CONSTRAINT "walks_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walks" ADD CONSTRAINT "walks_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patronage_id_fkey" FOREIGN KEY ("patronage_id") REFERENCES "patronages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anon_donations" ADD CONSTRAINT "anon_donations_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
