
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSandboxApi } from "@/hooks/use-sandbox-api";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export interface SandboxContextValue {
  fileTree: FileNode[];
  openFilePath: string | null;
  openFileContent: string;
  dirty: boolean;
  loading: boolean;
  refreshFileTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
  writeAndOpen: (path: string, content: string) => Promise<void>;
  setOpenFileContent: (content: string) => void;
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  ptySessionId: string | null;
  initPty: () => Promise<void>;
  registerPtySender: (sender: ((data: string) => void) | null) => void;
  sendPtyCommand: (cmd: string) => void;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

function buildTreeFromPaths(filePaths: string[]): FileNode[] {
  const rootChildren: FileNode[] = [];
  const map = new Map<string, FileNode>();

  const sorted = [...filePaths].sort();

  for (const fp of sorted) {
    const parts = fp.replace(/^\//, "").split("/");
    let parentChildren = rootChildren;

    for (let i = 0; i < parts.length; i++) {
      const currentPath = "/" + parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;

      let existing = map.get(currentPath);
      if (!existing) {
        existing = {
          name: parts[i],
          path: currentPath,
          isDir: !isLast,
          children: !isLast ? [] : undefined,
        };
        map.set(currentPath, existing);
        parentChildren.push(existing);
      }

      if (!isLast) {
        if (!existing.children) {
          existing.children = [];
          existing.isDir = true;
        }
        parentChildren = existing.children;
      }
    }
  }

  return rootChildren;
}

function sortTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .map((n) => ({
      ...n,
      children: n.children ? sortTree(n.children) : undefined,
    }))
    .sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const api = useSandboxApi();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [openFileContent, setOpenFileContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ptySessionId, setPtySessionId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFileTree = useCallback(async () => {
    try {
      const data = await api.searchFiles("/workspace", "**/*");
      const raw: unknown[] = Array.isArray(data) ? data : data.files ?? [];
      const paths: string[] = raw.map((item: unknown) =>
        typeof item === "string" ? item : (item as { path: string }).path,
      );
      setFileTree(sortTree(buildTreeFromPaths(paths)));
    } catch {
    }
  }, [api]);

  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const saveFile = useCallback(
    async (path: string, content: string) => {
      await api.uploadFile(path, content);
      setDirty(false);
    },
    [api],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setOpenFileContent(content);
      setDirty(true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (openFilePath) {
          saveFile(openFilePath, content);
        }
      }, 1500);
    },
    [openFilePath, saveFile],
  );

  const openFile = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const data = await api.getFileContent(path);
        setOpenFilePath(path);
        setOpenFileContent(data.content ?? "");
        setDirty(false);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const writeAndOpen = useCallback(
    async (path: string, content: string) => {
      await api.uploadFile(path, content);
      await refreshFileTree();
      setOpenFilePath(path);
      setOpenFileContent(content);
      setDirty(false);
    },
    [api, refreshFileTree],
  );

  const createFile = useCallback(
    async (path: string) => {
      await api.uploadFile(path, "");
      await refreshFileTree();
    },
    [api, refreshFileTree],
  );

  const deleteFileFn = useCallback(
    async (path: string) => {
      await api.deleteFile(path);
      if (openFilePath === path) {
        setOpenFilePath(null);
        setOpenFileContent("");
        setDirty(false);
      }
      await refreshFileTree();
    },
    [api, openFilePath, refreshFileTree],
  );

  const initPty = useCallback(async () => {
    if (ptySessionId) return;
    const data = await api.createPty();
    setPtySessionId(data.session_id ?? data.sessionId);
  }, [api, ptySessionId]);

  const ptySenderRef = useRef<((data: string) => void) | null>(null);

  const registerPtySender = useCallback((sender: ((data: string) => void) | null) => {
    ptySenderRef.current = sender;
  }, []);

  const sendPtyCommand = useCallback((cmd: string) => {
    ptySenderRef.current?.(cmd + "\n");
  }, []);

  const value = useMemo<SandboxContextValue>(
    () => ({
      fileTree,
      openFilePath,
      openFileContent,
      dirty,
      loading,
      refreshFileTree,
      openFile,
      saveFile,
      writeAndOpen,
      setOpenFileContent: handleContentChange,
      createFile,
      deleteFile: deleteFileFn,
      ptySessionId,
      initPty,
      registerPtySender,
      sendPtyCommand,
    }),
    [
      fileTree,
      openFilePath,
      openFileContent,
      dirty,
      loading,
      refreshFileTree,
      openFile,
      saveFile,
      writeAndOpen,
      handleContentChange,
      createFile,
      deleteFileFn,
      ptySessionId,
      initPty,
      registerPtySender,
      sendPtyCommand,
    ],
  );

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox(): SandboxContextValue {
  const ctx = useContext(SandboxContext);
  if (!ctx) throw new Error("useSandbox must be used within SandboxProvider");
  return ctx;
}
