
import { RoadmapNode } from "@/components/roadmap/roadmap-node";
import { CodePanel } from "@/components/sidebar/code-panel";
import { InteractiveBlockRenderer } from "@/components/ui-blocks/interactive-block";
import { MapPin, Code2, Sparkles, RefreshCw } from "lucide-react";

interface Node {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
}

export interface ReviewDueItem {
  id: string;
  index: number;
  title: string;
  memoryStrength: number;
  isOverdue: boolean;
}

interface RightSidebarProps {
  nodes: Node[];
  codePanel?: {
    code: string;
    language: string;
    instruction?: string;
  } | null;
  onCodePanelChange?: (code: string) => void;
  interactivePanel?: { html: string } | null;
  activeTab: "roadmap" | "code" | "interactive" | "review";
  onTabChange: (tab: "roadmap" | "code" | "interactive" | "review") => void;
  reviewDueNodes?: ReviewDueItem[];
  onStartReview?: () => void;
  reviewActive?: boolean;
}

export function RightSidebar({
  nodes,
  codePanel,
  onCodePanelChange,
  interactivePanel,
  activeTab,
  onTabChange,
  reviewDueNodes = [],
  onStartReview,
  reviewActive = false,
}: RightSidebarProps) {
  const hasCode = !!codePanel;
  const hasInteractive = !!interactivePanel;
  const mastered = nodes.filter((n) => n.status === "mastered").length;
  const hasReview = mastered > 0;
  const showTabs = hasCode || hasInteractive || hasReview;

  const total = nodes.length;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const isIdeMode = activeTab === "code" && hasCode;
  const codeActive = activeTab === "code";
  const roadmapActive = activeTab === "roadmap";
  const interactiveActive = activeTab === "interactive";
  const reviewActiveTab = activeTab === "review";

  const tabBtnStyle = (active: boolean) =>
    isIdeMode
      ? {
          color: active ? "#cdd6f4" : "#6c7086",
          borderBottom: active ? "2px solid #89b4fa" : "2px solid transparent",
        }
      : {
          color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)",
          borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
        };

  return (
    <div
      className={`flex h-full w-full flex-col${isIdeMode ? "" : " bg-sidebar"}`}
      style={isIdeMode ? { background: "#1e1e2e" } : undefined}
    >
      {/* Tab bar */}
      {showTabs && (
        <div
          className="flex shrink-0 px-2 py-0"
          style={isIdeMode
            ? { background: "#181825", borderBottom: "1px solid #313244" }
            : { borderBottom: "1px solid var(--color-border)" }
          }
        >
          {hasInteractive && (
            <button
              onClick={() => onTabChange("interactive")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={tabBtnStyle(interactiveActive)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              互动课
            </button>
          )}
          {hasCode && (
            <button
              onClick={() => onTabChange("code")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={tabBtnStyle(codeActive)}
            >
              <Code2 className="h-3.5 w-3.5" />
              代码
            </button>
          )}
          {hasReview && (
            <button
              onClick={() => onTabChange("review")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={tabBtnStyle(reviewActiveTab)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              复习
              {reviewDueNodes.length > 0 && (
                <span className="ml-0.5 rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold text-accent">
                  {reviewDueNodes.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => onTabChange("roadmap")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
            style={tabBtnStyle(roadmapActive)}
          >
            <MapPin className="h-3.5 w-3.5" />
            学习路线
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "roadmap" && (
          <>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    学习路线
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {mastered}/{total}
                </span>
              </div>
              {total > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      总进度
                    </span>
                    <span className="text-[11px] font-medium text-sidebar-accent">
                      {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-roadmap-track">
                    <div
                      className="h-1.5 rounded-full bg-roadmap-fill transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {nodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MapPin className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    诊断完成后将生成学习路线
                  </p>
                </div>
              )}
              {nodes.map((node, i) => (
                <RoadmapNode
                  key={node.id}
                  index={i + 1}
                  title={node.title}
                  status={
                    node.status as
                      | "mastered"
                      | "in_progress"
                      | "not_started"
                  }
                  masteryScore={node.masteryScore}
                  isLast={i === nodes.length - 1}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === "review" && hasReview && (
          <ReviewList
            dueNodes={reviewDueNodes}
            onStartReview={onStartReview}
            reviewActive={reviewActive}
          />
        )}

        {activeTab === "code" && hasCode && (
          <CodePanel
            code={codePanel!.code}
            language={codePanel!.language}
            instruction={codePanel!.instruction}
            onCodeChange={onCodePanelChange ?? (() => {})}
          />
        )}

        {activeTab === "interactive" && hasInteractive && interactivePanel && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
            <InteractiveBlockRenderer
              block={{ type: "interactive", html: interactivePanel.html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 复习清单（spec §3.1 智能推荐 + §5.1 右栏复习态，黄色基调）
function ReviewList({
  dueNodes,
  onStartReview,
  reviewActive,
}: {
  dueNodes: ReviewDueItem[];
  onStartReview?: () => void;
  reviewActive: boolean;
}) {
  return (
    <>
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">今日复习</h2>
          <span className="text-xs text-muted-foreground">
            到期 {dueNodes.length} 项
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          基于间隔重复算法，到期知识点在此呈现
        </p>
        {!reviewActive && dueNodes.length > 0 && onStartReview && (
          <button
            onClick={onStartReview}
            className="mt-3 w-full rounded-lg bg-accent/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/25"
          >
            🔁 开始复习
          </button>
        )}
        {reviewActive && (
          <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-[11px] text-muted-foreground">
            复习进行中，在对话区作答
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {dueNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              今日无到期知识点，复习已完成
            </p>
          </div>
        ) : (
          dueNodes.map((n) => (
            <div
              key={n.id}
              className="mb-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {n.title}
                </span>
                {n.isOverdue && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    逾期
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-roadmap-track">
                  <div
                    className="h-1 rounded-full bg-accent"
                    style={{ width: `${Math.round(n.memoryStrength * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {(n.memoryStrength * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
