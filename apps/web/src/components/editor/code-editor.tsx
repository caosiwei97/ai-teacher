"use client";

import { useRef, useEffect } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { warmTheme } from "./warm-theme";
import { getLanguageExtension } from "./language-map";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function CodeEditor({ language, value, onChange, readOnly = false, compact = false }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const langCompartment = new Compartment();

    const extensions = [
      warmTheme,
      keymap.of(defaultKeymap),
      EditorView.lineWrapping,
      langCompartment.of([]),
    ];

    if (readOnly) {
      extensions.push(EditorView.editable.of(false));
    }

    if (onChange) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      );
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    getLanguageExtension(language).then((langExt) => {
      if (langExt && viewRef.current === view) {
        view.dispatch({
          effects: langCompartment.reconfigure(langExt),
        });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-lg border border-code-border ${compact ? "max-h-[200px] overflow-y-auto" : ""}`}
    />
  );
}
