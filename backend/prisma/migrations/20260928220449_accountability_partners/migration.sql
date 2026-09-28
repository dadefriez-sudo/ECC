-- CreateTable
CREATE TABLE "AccountabilityPartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountabilityPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountabilityInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "AccountabilityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountabilitySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountabilityPartner_userId_partnerId_key" ON "AccountabilityPartner"("userId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountabilityInvite_token_key" ON "AccountabilityInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AccountabilitySnapshot_userId_key" ON "AccountabilitySnapshot"("userId");

-- AddForeignKey
ALTER TABLE "AccountabilityPartner" ADD CONSTRAINT "AccountabilityPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountabilityPartner" ADD CONSTRAINT "AccountabilityPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountabilitySnapshot" ADD CONSTRAINT "AccountabilitySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
