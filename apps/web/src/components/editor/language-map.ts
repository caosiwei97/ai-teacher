import type { Extension } from "@codemirror/state";

export async function getLanguageExtension(lang: string): Promise<Extension | null> {
  const normalized = lang.toLowerCase();

  switch (normalized) {
    case "python":
    case "py": {
      const { python } = await import("@codemirror/lang-python");
      return python();
    }
    case "javascript":
    case "js": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript();
    }
    case "typescript":
    case "ts": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ typescript: true });
    }
    case "jsx": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ jsx: true });
    }
    case "tsx": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ jsx: true, typescript: true });
    }
    case "java": {
      const { java } = await import("@codemirror/lang-java");
      return java();
    }
    case "cpp":
    case "c":
    case "c++": {
      const { cpp } = await import("@codemirror/lang-cpp");
      return cpp();
    }
    case "go": {
      const { go } = await import("@codemirror/lang-go");
      return go();
    }
    default:
      return null;
  }
}
