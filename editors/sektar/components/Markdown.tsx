// Markdown, shown: the tree of kit/markdown.ts as React elements. Nothing is
// set as HTML, so markup in the source cannot run; a link opens in a new tab
// without a referrer; an image is named, never fetched (converted PDFs keep
// their figures in the original). A note can stand in for a page of the PDF
// that the Markdown is missing, where that page begins.
import { Fragment, memo, useMemo, type ReactNode } from "react";
import {
  pageCount,
  parseMarkdown,
  type Align,
  type Block,
  type Inline,
} from "../kit/markdown.js";

function inline(nodes: readonly Inline[]): ReactNode {
  return nodes.map((node, at) => {
    switch (node.kind) {
      case "text":
        return <Fragment key={at}>{node.text}</Fragment>;
      case "strong":
        return <strong key={at}>{inline(node.children)}</strong>;
      case "emphasis":
        return <em key={at}>{inline(node.children)}</em>;
      case "strike":
        return <del key={at}>{inline(node.children)}</del>;
      case "code":
        return <code key={at}>{node.text}</code>;
      case "link":
        return (
          <a
            key={at}
            href={node.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {inline(node.children)}
          </a>
        );
      case "image":
        return (
          <span key={at} className="sk-markdown__image" title={node.src}>
            {node.alt ? `Image: ${node.alt}` : "Image"}
          </span>
        );
      case "break":
        return <br key={at} />;
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  });
}

const cellStyle = (align: Align) => (align ? { textAlign: align } : undefined);

/** A list item whose text needs no paragraph of its own: one paragraph, then at most nested lists. */
function isTight(item: readonly Block[]): boolean {
  const [first, ...rest] = item;
  return (
    item.length > 0 &&
    first.kind === "paragraph" &&
    rest.every((block) => block.kind === "list")
  );
}

/** What a document is shown with: whether pages are labelled, and notes for pages it is missing. */
interface Pages {
  labelled: boolean;
  notes: ReadonlyMap<number, ReactNode> | undefined;
}

function blocks(list: readonly Block[], paged: Pages): ReactNode {
  return list.map((block, at) => {
    switch (block.kind) {
      case "heading": {
        const Tag = `h${block.level}` as const;
        return <Tag key={at}>{inline(block.children)}</Tag>;
      }
      case "paragraph":
        return <p key={at}>{inline(block.children)}</p>;
      case "code":
        return (
          <pre key={at}>
            <code>{block.text}</code>
          </pre>
        );
      case "list": {
        const items = block.items.map((item, index) => {
          const [first, ...rest] = item;
          return (
            <li key={index}>
              {isTight(item) && first.kind === "paragraph" ? (
                <>
                  {inline(first.children)}
                  {blocks(rest, paged)}
                </>
              ) : (
                blocks(item, paged)
              )}
            </li>
          );
        });
        return block.ordered ? (
          <ol key={at} start={block.start}>
            {items}
          </ol>
        ) : (
          <ul key={at}>{items}</ul>
        );
      }
      case "quote":
        return (
          <blockquote key={at}>{blocks(block.children, paged)}</blockquote>
        );
      case "table":
        return (
          <div key={at} className="sk-markdown__table">
            <table>
              <thead>
                <tr>
                  {block.head.map((cell, column) => (
                    <th key={column} style={cellStyle(block.align[column])}>
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, column) => (
                      <td key={column} style={cellStyle(block.align[column])}>
                        {inline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "rule":
        return <hr key={at} />;
      case "page": {
        // One page needs no marker; with several, each start is labelled.
        const note = paged.notes?.get(block.page);
        return (
          <Fragment key={at}>
            {paged.labelled && (
              <div
                className="sk-markdown__page"
                role="separator"
                aria-label={`Page ${block.page}`}
              >
                Page {block.page}
              </div>
            )}
            {note}
          </Fragment>
        );
      }
      default: {
        const _exhaustive: never = block;
        return _exhaustive;
      }
    }
  });
}

/**
 * Markdown as a read-only document. `notes` are shown where their pages
 * begin; in a document without page markers they come first.
 */
export const Markdown = memo(function Markdown({
  source,
  notes,
}: {
  source: string;
  notes?: ReadonlyMap<number, ReactNode>;
}) {
  const tree = useMemo(() => parseMarkdown(source), [source]);
  const pages = pageCount(tree);
  return (
    <div className="sk-markdown">
      {pages === 0 &&
        [...(notes ?? [])].map(([page, note]) => (
          <Fragment key={page}>{note}</Fragment>
        ))}
      {blocks(tree, { labelled: pages > 1, notes })}
    </div>
  );
});
