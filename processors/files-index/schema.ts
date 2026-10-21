/**
 * The Files index: what a folder listing shows, for drives of any size.
 *
 * A drive of tens of thousands of files cannot be listed by loading every
 * File document, nor sorted, searched or paged in the browser. Two tables
 * answer the listing instead: the drive's own nodes (folders and files,
 * where they live, their names), and one lean row per File document (title,
 * tags, what its source is, its thumbnail). A listing is a join of the two,
 * paged and searched in SQL; a File document is loaded only when opened.
 */
export interface FileNodeRow {
  id: string;
  /** folder | file */
  kind: string;
  name: string;
  /** Lower-cased name: the listing's sort key. */
  name_sort: string;
  /** Null at the drive's root. */
  parent_id: string | null;
  /** The document type of a file node; null for a folder. */
  document_type: string | null;
}

export interface FileDocRow {
  document_id: string;
  title: string | null;
  description: string | null;
  /** JSON: [{ id, label, color }] */
  tags: string;
  /** ATTACHMENT | DOCUMENT | FILE_PLACEHOLDER | DOCUMENT_PLACEHOLDER | null */
  source_kind: string | null;
  source_mime: string | null;
  source_name: string | null;
  source_size: number | null;
  source_document_type: string | null;
  source_document_name: string | null;
  rendition_count: number;
  /** The stored image a card shows: a preview rendition, else an image source. */
  thumb_ref: string | null;
  /** A change a folder sync found on disk, waiting: CREATE | UPDATE | DELETE | null */
  disk_change: string | null;
  /** Lower-cased: title, description, tag labels, source names, rendition labels. */
  search_text: string;
  updated_at: string;
}

export interface DB {
  file_nodes: FileNodeRow;
  file_docs: FileDocRow;
}
