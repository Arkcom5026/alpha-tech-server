-- DropForeignKey
ALTER TABLE "public"."EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_userId_fkey";

-- AddForeignKey
ALTER TABLE "public"."EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
