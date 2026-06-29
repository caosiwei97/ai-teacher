import type { ComponentType } from "react";
import type { UIBlock } from "@ai-teacher/shared";
import { TextBlock } from "./text-block";
import { AssessmentBlockRenderer } from "./assessment-block";
import { QuizPanel } from "./quiz-panel";
import { CodeResultBlock } from "./code-result-block";
import { FormulaDisplay } from "./formula-display";
import { DiagramRenderer } from "./diagram-renderer";
import { TableBlock } from "./table-block";
import { CalloutBlock } from "./callout-block";
import { ComparisonCard } from "./comparison-card";
import { HeadingBlock } from "./heading-block";
import { BadgeBlock } from "./badge-block";
import { MasteryReportBlock } from "./mastery-report-block";
import { InteractiveBlockRenderer } from "./interactive-block";
import { FlashcardBlockRenderer } from "./flashcard-block";
import { InterviewScoreBlockRenderer } from "./interview-score-block";

export const UIBlockRegistry: Record<string, ComponentType<{ block: UIBlock }>> = {
  text: TextBlock as ComponentType<{ block: UIBlock }>,
  assessment: AssessmentBlockRenderer as ComponentType<{ block: UIBlock }>,
  quiz: QuizPanel as ComponentType<{ block: UIBlock }>,
  "code-result": CodeResultBlock as ComponentType<{ block: UIBlock }>,
  formula: FormulaDisplay as ComponentType<{ block: UIBlock }>,
  diagram: DiagramRenderer as ComponentType<{ block: UIBlock }>,
  table: TableBlock as ComponentType<{ block: UIBlock }>,
  callout: CalloutBlock as ComponentType<{ block: UIBlock }>,
  comparison: ComparisonCard as ComponentType<{ block: UIBlock }>,
  heading: HeadingBlock as ComponentType<{ block: UIBlock }>,
  badge: BadgeBlock as ComponentType<{ block: UIBlock }>,
  "mastery-report": MasteryReportBlock as ComponentType<{ block: UIBlock }>,
  interactive: InteractiveBlockRenderer as ComponentType<{ block: UIBlock }>,
  flashcard: FlashcardBlockRenderer as ComponentType<{ block: UIBlock }>,
  interviewScore: InterviewScoreBlockRenderer as ComponentType<{ block: UIBlock }>,
};
