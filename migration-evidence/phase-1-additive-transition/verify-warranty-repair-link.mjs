import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const [
    totalClaims,
    legacyUnlinkedClaims,
    claimsWithRepairJob,
    invalidVerifiedWithoutRepairJob,
  ] = await Promise.all([
    prisma.warrantyClaim.count(),

    prisma.warrantyClaim.count({
      where: {
        repairLinkState: "UNLINKED_LEGACY",
      },
    }),

    prisma.warrantyClaim.count({
      where: {
        repairJobId: {
          not: null,
        },
      },
    }),

    prisma.warrantyClaim.count({
      where: {
        repairLinkState: "LINKED_VERIFIED",
        repairJobId: null,
      },
    }),
  ]);

  const result = {
    totalClaims,
    legacyUnlinkedClaims,
    claimsWithRepairJob,
    invalidVerifiedWithoutRepairJob,
  };

  console.log(JSON.stringify(result, null, 2));

  if (invalidVerifiedWithoutRepairJob !== 0) {
    throw new Error(
      "Invalid state detected: LINKED_VERIFIED claim without repairJobId."
    );
  }

  if (
    claimsWithRepairJob === 0 &&
    legacyUnlinkedClaims !== totalClaims
  ) {
    throw new Error(
      "Legacy migration invariant failed: existing claims were not initialized as UNLINKED_LEGACY."
    );
  }

  console.log("WARRANTY REPAIR LINK DATA VERIFICATION: PASS");
} finally {
  await prisma.$disconnect();
}
