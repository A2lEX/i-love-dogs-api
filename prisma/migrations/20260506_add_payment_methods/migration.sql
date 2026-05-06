-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "curator_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "curator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
