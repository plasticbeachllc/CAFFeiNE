import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * Markdown parser setup
 * Uses the same remark plugins as BlockSuite frontend
 */
export class MarkdownParser {
  private readonly processor = unified()
    .use(remarkParse) // Parse markdown to AST
    .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
    .use(remarkMath); // Math blocks ($$...$$)

  /**
   * Parse markdown string to MDAST (Markdown Abstract Syntax Tree)
   */
  parse(markdown: string): Root {
    const ast = this.processor.parse(markdown);
    return this.processor.runSync(ast) as Root;
  }
}
