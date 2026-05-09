function formatProfileValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function buildLearnerProfile(profile: {
  learningStyle: unknown;
  strengths: unknown;
  weaknesses: unknown;
  misconceptionPatterns: unknown;
  sessionsSummary: unknown;
} | null) {
  if (!profile) {
    return "首次学习";
  }

  const sections = [
    profile.learningStyle
      ? `学习偏好：${formatProfileValue(profile.learningStyle)}`
      : null,
    profile.strengths ? `已有优势：${formatProfileValue(profile.strengths)}` : null,
    profile.weaknesses ? `薄弱点：${formatProfileValue(profile.weaknesses)}` : null,
    profile.misconceptionPatterns
      ? `常见误解：${formatProfileValue(profile.misconceptionPatterns)}`
      : null,
    profile.sessionsSummary
      ? `历史学习摘要：${formatProfileValue(profile.sessionsSummary)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n") || "首次学习";
}
