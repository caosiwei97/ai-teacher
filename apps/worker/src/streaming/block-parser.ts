import type { UIBlock } from "@ai-teacher/shared";

export interface StreamingBlockParserOptions {
  onBlock: (block: UIBlock, index: number) => void;
}

export class StreamingBlockParser {
  private blockIndex = 0;
  private onBlock: (block: UIBlock, index: number) => void;

  private inBlocksArray = false;
  private objectDepth = 0;
  private nestedArrayDepth = 0;
  private currentBlockChars: string[] = [];
  private inString = false;
  private escapeNext = false;

  constructor(opts: StreamingBlockParserOptions) {
    this.onBlock = opts.onBlock;
  }

  feed(delta: string): void {
    for (let i = 0; i < delta.length; i++) {
      this.processChar(delta[i]);
    }
  }

  flush(): void {
    if (this.currentBlockChars.length > 0 && this.objectDepth === 0) {
      this.tryEmit(this.currentBlockChars.join(""));
      this.currentBlockChars = [];
    }
  }

  private processChar(ch: string): void {
    if (this.escapeNext) {
      this.escapeNext = false;
      if (this.objectDepth > 0) this.currentBlockChars.push(ch);
      return;
    }

    if (ch === "\\" && this.inString) {
      this.escapeNext = true;
      if (this.objectDepth > 0) this.currentBlockChars.push(ch);
      return;
    }

    if (ch === '"') {
      this.inString = !this.inString;
      if (this.objectDepth > 0) this.currentBlockChars.push(ch);
      return;
    }

    if (this.inString) {
      if (this.objectDepth > 0) this.currentBlockChars.push(ch);
      return;
    }

    if (!this.inBlocksArray) {
      if (ch === "[") {
        this.inBlocksArray = true;
        this.objectDepth = 0;
        this.nestedArrayDepth = 0;
      }
      return;
    }

    if (ch === "{") {
      this.objectDepth++;
      this.currentBlockChars.push(ch);
    } else if (ch === "}") {
      this.currentBlockChars.push(ch);
      this.objectDepth--;
      if (this.objectDepth === 0) {
        this.tryEmit(this.currentBlockChars.join(""));
        this.currentBlockChars = [];
      }
    } else if (ch === "[") {
      if (this.objectDepth > 0) {
        this.currentBlockChars.push(ch);
        this.nestedArrayDepth++;
      }
    } else if (ch === "]") {
      if (this.objectDepth > 0) {
        this.currentBlockChars.push(ch);
        this.nestedArrayDepth--;
      } else {
        this.inBlocksArray = false;
      }
    } else {
      if (this.objectDepth > 0) {
        this.currentBlockChars.push(ch);
      }
    }
  }

  private tryEmit(json: string): void {
    try {
      const parsed = JSON.parse(json) as UIBlock;
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        this.onBlock(parsed, this.blockIndex++);
      }
    } catch {
      // malformed — fallback will handle
    }
  }
}
