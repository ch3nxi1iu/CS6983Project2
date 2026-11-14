-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('HOMEWORK', 'PROJECT', 'EXAM', 'READING', 'OTHER');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "kind" "AssignmentKind" NOT NULL DEFAULT 'OTHER';
