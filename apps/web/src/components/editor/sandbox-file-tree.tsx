
import { useState, useCallback } from "react";
import { FolderOpen, FolderClosed, FileCode, FileText, Trash2 } from "lucide-react";
import { type FileNode, useSandbox } from "@/contexts/sandbox-context";

const IDE = {
  sidebar: "#181825",
  border: "#313244",
  text: "#cdd6f4",
  textMuted: "#6c7086",
  hover: "#313244",
  accent: "#89b4fa",
};

const CODE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "py", "java", "cpp", "go", "rs", "json"]);

function getExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function TreeItem({ node, depth }: { node: FileNode; depth: number }) {
  const { openFilePath, openFile, deleteFile } = useSandbox();
  const [expanded, setExpanded] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);

  const isActive = openFilePath === node.path;
  const isCode = CODE_EXTENSIONS.has(getExtension(node.name));

  const handleClick = useCallback(() => {
    if (node.isDir) {
      setExpanded((e) => !e);
    } else {
      openFile(node.path);
    }
  }, [node, openFile]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteFile(node.path);
    },
    [node.path, deleteFile],
  );

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors"
        style={{
          paddingLeft: `${depth * 12 + 6}px`,
          background: isActive ? IDE.hover : hovered ? IDE.hover : "transparent",
          color: isActive ? IDE.accent : IDE.textMuted,
        }}
      >
        {node.isDir ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : (
            <FolderClosed className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          )
        ) : isCode ? (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: IDE.textMuted, opacity: 0.6 }} />
        )}
        <span className="truncate">{node.name}</span>
        {hovered && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleDelete}
            onKeyDown={() => {}}
            className="ml-auto shrink-0 rounded p-0.5 transition-colors hover:bg-red-500/10 hover:text-red-400"
            style={{ color: IDE.textMuted, opacity: 0.4 }}
          >
            <Trash2 className="h-3 w-3" />
          </span>
        )}
      </button>
      {node.isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SandboxFileTree() {
  const { fileTree } = useSandbox();

  if (fileTree.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-xs" style={{ color: IDE.textMuted, opacity: 0.4 }}>暂无文件</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-1">
      {fileTree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
