/**
 * The Files index: what a folder listing shows, for drives of any size.
 *
 * A drive of tens of thousands of files cannot be listed by loading every
 * File document, nor sorted, searched or paged in the browser. Two tables
 * answer the listing instead: the drive's own nodes (folders and files,
 * where they live, their names), and one lean row per File document (title,
 * tags, what its source is, its thumbnail). A listing is a join of the two,
 * paged and searched in SQL; a File document is loaded only when opened.
 *
 * The tree (folders with their counts) is read from the node rows too, and
 * the drive's folder syncs from one row per mapping: neither screen loads
 * the drive's node list or the mapping documents.
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
  /**
   * A reactor-drive node's name as asked for, before the drive's collision
   * rule made it unique ("Q3" for a node shown as "Q3 (2)"); a move or a
   * rename resolves from it again. Null on a legacy drive, whose node list
   * says the name outright.
   */
  requested_name: string | null;
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

/** A document's own name (its header), for the reactor-drive nodes that show it. */
export interface DocNameRow {
  document_id: string;
  name: string;
}

/** One folder sync (sektar/folder-sync): what the Files app shows of it without loading it. */
export interface SyncMappingRow {
  document_id: string;
  /** The mapping document's own name */
  name: string;
  drive_id: string | null;
  folder_id: string | null;
  folder_path: string | null;
  local_path: string | null;
  enabled: boolean;
  /** MANUAL | ON_CHANGE */
  trigger: string;
  include_subfolders: boolean;
  /** NEVER | REQUESTED | RUNNING | OK | PARTIAL | ERROR */
  status: string;
  requested_at: string | null;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_status: string | null;
  last_run_placeholders: number;
  last_run_error: string | null;
  issue_count: number;
  pull_count: number;
  host_name: string | null;
  updated_at: string;
}

export interface DB {
  file_nodes: FileNodeRow;
  file_docs: FileDocRow;
  doc_names: DocNameRow;
  sync_mappings: SyncMappingRow;
}
