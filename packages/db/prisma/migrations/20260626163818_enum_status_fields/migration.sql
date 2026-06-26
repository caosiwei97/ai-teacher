-- 迭代 042/046：状态字段 String → 原生 Enum
-- Node.status 含连字符值（not-started/in-progress），Prisma enum 不支持连字符，先转换为下划线
UPDATE "Node" SET "status" = 'not_started' WHERE "status" = 'not-started';
UPDATE "Node" SET "status" = 'in_progress' WHERE "status" = 'in-progress';

-- 创建 Enum 类型
CREATE TYPE "SessionStatus" AS ENUM ('active', 'diagnosing', 'completed', 'archived');
CREATE TYPE "TeachingMode" AS ENUM ('warm', 'strict', 'interviewer');
CREATE TYPE "NodeStatus" AS ENUM ('not_started', 'in_progress', 'mastered');
CREATE TYPE "MessageRole" AS ENUM ('tutor', 'learner', 'system');
CREATE TYPE "MessageType" AS ENUM ('text', 'quiz', 'quiz_response', 'assessment', 'system');
CREATE TYPE "MessageStatus" AS ENUM ('sending', 'processing', 'completed', 'failed');
CREATE TYPE "SourceType" AS ENUM ('pdf', 'markdown');

-- Session.status
ALTER TABLE "Session" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "status" TYPE "SessionStatus" USING ("status"::text)::"SessionStatus";
ALTER TABLE "Session" ALTER COLUMN "status" SET DEFAULT 'active';

-- Session.teachingMode
ALTER TABLE "Session" ALTER COLUMN "teachingMode" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "teachingMode" TYPE "TeachingMode" USING ("teachingMode"::text)::"TeachingMode";
ALTER TABLE "Session" ALTER COLUMN "teachingMode" SET DEFAULT 'warm';

-- Node.status
ALTER TABLE "Node" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Node" ALTER COLUMN "status" TYPE "NodeStatus" USING ("status"::text)::"NodeStatus";
ALTER TABLE "Node" ALTER COLUMN "status" SET DEFAULT 'not_started';

-- Message.role（无 default）
ALTER TABLE "Message" ALTER COLUMN "role" TYPE "MessageRole" USING ("role"::text)::"MessageRole";

-- Message.type（无 default）
ALTER TABLE "Message" ALTER COLUMN "type" TYPE "MessageType" USING ("type"::text)::"MessageType";

-- Message.status
ALTER TABLE "Message" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Message" ALTER COLUMN "status" TYPE "MessageStatus" USING ("status"::text)::"MessageStatus";
ALTER TABLE "Message" ALTER COLUMN "status" SET DEFAULT 'completed';

-- Source.type（无 default，表可能为空）
ALTER TABLE "Source" ALTER COLUMN "type" TYPE "SourceType" USING ("type"::text)::"SourceType";
