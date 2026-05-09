import { EditorView } from "@codemirror/view";

export const warmTheme = EditorView.theme({
  "&": {
    backgroundColor: "#161514",
    color: "#e8e4dd",
  },
  ".cm-content": {
    caretColor: "#d97706",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#d97706",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "rgba(217, 119, 6, 0.2)",
  },
  ".cm-gutters": {
    backgroundColor: "#161514",
    color: "#9c9890",
    borderRight: "1px solid #3a3835",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "#2e2d2a",
    color: "#9c9890",
    border: "none",
  },
  ".cm-tooltip": {
    backgroundColor: "#252420",
    border: "1px solid #3a3835",
    color: "#e8e4dd",
  },
});
