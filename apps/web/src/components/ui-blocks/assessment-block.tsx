
import type { AssessmentBlock } from "@ai-teacher/shared";
import { AssessmentCard } from "@/components/chat/assessment-card";

interface AssessmentBlockRendererProps {
  block: AssessmentBlock;
}

export function AssessmentBlockRenderer({ block }: AssessmentBlockRendererProps) {
  return (
    <AssessmentCard
      summary={block.summary}
      reviewTable={block.reviewTable}
      coreTags={block.coreTags}
      nextNodeTitle={block.nextNodeTitle}
    />
  );
}
