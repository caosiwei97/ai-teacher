
import { useEffect, useRef, useCallback } from "react";
import { Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useSandbox } from "@/contexts/sandbox-context";
import { getSandboxWsUrl } from "@/hooks/use-sandbox-api";

const IDE = {
  border: "#313244",
  textMuted: "#6c7086",
};

let Terminal: typeof import("@xterm/xterm").Terminal;
let FitAddon: typeof import("@xterm/addon-fit").FitAddon;
let WebLinksAddon: typeof import("@xterm/addon-web-links").WebLinksAddon;

async function loadXterm() {
  if (Terminal) return;
  const [xtermMod, fitMod, linksMod] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-web-links"),
  ]);
  await import("@xterm/xterm/css/xterm.css");
  Terminal = xtermMod.Terminal;
  FitAddon = fitMod.FitAddon;
  WebLinksAddon = linksMod.WebLinksAddon;
}

const RECONNECT_DELAY = 2000;

export function SandboxTerminal() {
  const { ptySessionId, initPty, registerPtySender } = useSandbox();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<InstanceType<typeof import("@xterm/xterm").Terminal> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<InstanceType<typeof import("@xterm/addon-fit").FitAddon> | null>(null);

  useEffect(() => {
    if (!ptySessionId) {
      initPty();
    }
  }, [ptySessionId, initPty]);

  useEffect(() => {
    if (!ptySessionId || !containerRef.current) return;

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    async function setup() {
      await loadXterm();
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        lineHeight: 1.5,
        fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
        theme: {
          background: "#1e1e2e",
          foreground: "#cdd6f4",
          cursor: "#f5e0dc",
          selectionBackground: "#585b7066",
          black: "#45475a",
          red: "#f38ba8",
          green: "#a6e3a1",
          yellow: "#f9e2af",
          blue: "#89b4fa",
          magenta: "#cba6f7",
          cyan: "#89dceb",
          white: "#cdd6f4",
        },
        allowProposedApi: true,
      });

      const fit = new FitAddon();
      const links = new WebLinksAddon();
      term.loadAddon(fit);
      term.loadAddon(links);
      term.open(containerRef.current!);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;

      function connect() {
        if (disposed) return;
        const ws = new WebSocket(getSandboxWsUrl(ptySessionId!));
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          const msg = JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows });
          ws.send(new TextEncoder().encode(msg));
        };

        ws.onmessage = (ev) => {
          const data = new Uint8Array(ev.data as ArrayBuffer);
          if (data[0] === 0x01) {
            term.write(data.slice(1));
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          term.write("\r\n\x1b[33m连接已断开，正在重连...\x1b[0m\r\n");
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        };
      }

      const encoder = new TextEncoder();

      function sendData(data: string) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          const encoded = encoder.encode(data);
          const frame = new Uint8Array(1 + encoded.length);
          frame[0] = 0x00;
          frame.set(encoded, 1);
          ws.send(frame);
        }
      }

      registerPtySender(sendData);

      term.onData((data) => {
        sendData(data);
      });

      term.onResize(({ cols, rows }) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      connect();
    }

    setup();

    const resizeObserver = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      registerPtySender(null);
      wsRef.current?.close();
      termRef.current?.dispose();
      resizeObserver.disconnect();
    };
  }, [ptySessionId]);

  const handleClear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-3 py-1.5"
        style={{
          borderBottom: `1px solid ${IDE.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5" style={{ color: IDE.textMuted, opacity: 0.6 }} />
          <span className="text-xs font-medium" style={{ color: IDE.textMuted, opacity: 0.8 }}>终端</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="rounded p-0.5 transition-colors hover:bg-white/5"
          style={{ color: IDE.textMuted, opacity: 0.4 }}
          title="清空终端"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden bg-[#1e1e2e] px-1" />
    </div>
  );
}
