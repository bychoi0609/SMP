-- CreateTable
CREATE TABLE "receipt_draft_state" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_draft_state_pkey" PRIMARY KEY ("key")
);
