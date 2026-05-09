import type { ComponentType } from "react";
import type { UIBlock } from "@ai-teacher/shared";
import { TextBlock } from "./text-block";
import { AssessmentBlockRenderer } from "./assessment-block";
import { QuizPanel } from "./quiz-panel";
import { CodeResultBlock } from "./code-result-block";
import { FormulaDisplay } from "./formula-display";
import { DiagramRenderer } from "./diagram-renderer";

export const UIBlockRegistry: Record<string, ComponentType<{ block: UIBlock }>> = {
  text: TextBlock as ComponentType<{ block: UIBlock }>,
  assessment: AssessmentBlockRenderer as ComponentType<{ block: UIBlock }>,
  quiz: QuizPanel as ComponentType<{ block: UIBlock }>,
  "code-result": CodeResultBlock as ComponentType<{ block: UIBlock }>,
  formula: FormulaDisplay as ComponentType<{ block: UIBlock }>,
  diagram: DiagramRenderer as ComponentType<{ block: UIBlock }>,
};
