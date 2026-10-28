import iconForestDark from "../../../../editors/sektar/design/app-icons/sektar-app-icon-forest-dark.svg";
import iconForestLight from "../../../../editors/sektar/design/app-icons/sektar-app-icon-forest-light.svg";
import iconMintDark from "../../../../editors/sektar/design/app-icons/sektar-app-icon-mint-dark.svg";
import iconMintLight from "../../../../editors/sektar/design/app-icons/sektar-app-icon-mint-light.svg";
import iconSageDark from "../../../../editors/sektar/design/app-icons/sektar-app-icon-sage-dark.svg";
import iconSageLight from "../../../../editors/sektar/design/app-icons/sektar-app-icon-sage-light.svg";
import type { IconName } from "../../../../editors/sektar/kit/ui.js";

// The Sektar products this app ships, in the design system's order. One
// account, one shell: the lockup in the sidebar switches between them and the
// product line, the navigation, the drive link and the page follow.
export type ProductId = "productivity" | "finance" | "travel";

export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  /**
   * For a drive the item opens by slug: the drive app it is bound to. A drive
   * created before its app existed has none; the shell binds it (bindDriveApps).
   */
  app?: string;
};

export type Product = {
  id: ProductId;
  /** The product line under the wordmark */
  name: string;
  /** One line of what it does (the switcher's menu) */
  lead: string;
  /** Where picking the product lands */
  home: string;
  /** App icon, light and dark */
  icon: { light: string; dark: string };
  /** The product's own work surfaces */
  nav: NavItem[];
  /**
   * The drive behind the product: its slug, its label in the navigation and
   * the drive app it is bound to (header.meta.preferredEditor).
   */
  drive: { slug: string; label: string; editor: string };
  /** Above the drive's entry, below the divider: what the machinery serves, e.g. Integrations */
  beforeDrive?: NavItem[];
  /** Below the drive's entry: the product's other machinery, e.g. Backfills */
  afterDrive?: NavItem[];
};

export const PRODUCTS: readonly Product[] = [
  {
    id: "productivity",
    name: "Productivity Center",
    lead: "Mail, calendar, tasks and projects for the whole team in one place.",
    home: "/productivity",
    icon: { light: iconSageLight, dark: iconSageDark },
    nav: [
      { to: "/productivity", label: "Welcome", icon: "dashboard" },
      // The Mail drive (hosts/*: reactor-drive, drive app email-workspace)
      {
        to: "/d/HRsIHuMMTdmjgCdy9QGWyx96zOFByPo787oBQcEt9f4",
        label: "Mail",
        icon: "mail",
      },
      // The Calendar drive (hosts/switchboard: slug "calendar", drive app calendar)
      {
        to: "/d/calendar",
        label: "Calendar",
        icon: "calendar",
        app: "calendar",
      },
      // The Files drive (hosts/*: slug "files", drive app files)
      { to: "/d/files", label: "Files", icon: "folder" },
    ],
    drive: {
      slug: "workflows",
      label: "Workflows",
      editor: "workflow-studio",
    },
    beforeDrive: [
      // The Integrations drive (hosts/switchboard: slug "integrations", drive app integrations)
      { to: "/d/integrations", label: "Integrations", icon: "sync" },
    ],
    afterDrive: [
      // The Backfills drive (hosts/*: slug "backfills", drive app backfills)
      { to: "/d/backfills", label: "Backfills", icon: "download" },
    ],
  },
  {
    id: "finance",
    name: "Finance Operations",
    lead: "Track, plan and automate the money side of the business.",
    home: "/finops/dashboard",
    icon: { light: iconForestLight, dark: iconForestDark },
    nav: [
      { to: "/finops/dashboard", label: "Dashboard", icon: "dashboard" },
      {
        to: "/finops/transactions",
        label: "Transactions",
        icon: "transactions",
      },
      { to: "/finops/invoices", label: "Invoices", icon: "invoice" },
      { to: "/finops/expenses", label: "Expenses", icon: "wallet" },
      { to: "/finops/contacts", label: "Contacts", icon: "customers" },
    ],
    drive: { slug: "sektar", label: "Business drive", editor: "sektar" },
  },
  {
    id: "travel",
    name: "Business Travel",
    lead: "Every trip in one place: why, where, how you got there and what it cost.",
    home: "/travel",
    icon: { light: iconMintLight, dark: iconMintDark },
    nav: [{ to: "/travel", label: "Overview", icon: "dashboard" }],
    // The Trips drive (hosts/*: slug "trips", drive app trips)
    drive: { slug: "trips", label: "Trips", editor: "trips" },
  },
];

/** The product the main page opens (and shared pages fall back to). */
export const DEFAULT_PRODUCT: ProductId = "productivity";

const STORAGE_KEY = "sk:product";

export function rememberedProduct(): ProductId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return PRODUCTS.some((p) => p.id === v) ? (v as ProductId) : null;
  } catch {
    return null;
  }
}

export function rememberProduct(id: ProductId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // remembered only when storage is available
  }
}

/** The shape of a drive as the shell needs it (a subset of a drive document). */
export type DriveLike = {
  header: { id: string; slug: string; meta?: { preferredEditor?: string } };
};

/**
 * The product's drive among the drives in the reactor, and the route param
 * that opens it. A drive is matched by slug or id; when more than one carries
 * the slug (a store from before the drive was attached from the switchboard
 * still holds a local placeholder), the one bound to the product's drive app
 * wins and is opened by id, which is unambiguous.
 */
export function driveFor<D extends DriveLike>(
  drives: readonly D[] | undefined,
  product: Product,
): { drive: D; param: string } | undefined {
  const { slug, editor } = product.drive;
  const candidates = (drives ?? []).filter(
    (d) => d.header.slug === slug || d.header.id === slug,
  );
  if (candidates.length === 0) return undefined;
  const drive =
    candidates.find((d) => d.header.meta?.preferredEditor === editor) ??
    candidates[0];
  const param =
    candidates.length > 1
      ? drive.header.id
      : drive.header.slug || drive.header.id;
  return { drive, param };
}

/**
 * Whether `pathname` is the page a nav item opens. A drive item names the
 * drive by id (`/d/<id>`), but Connect shows a drive whose slug differs from
 * its id as `/d/<slug>-<id>` (Mail: `/d/mail-HRsI…`), so both forms count.
 */
export function navMatches(pathname: string, to: string): boolean {
  if (!to.startsWith("/d/")) {
    return pathname === to || pathname.startsWith(`${to}/`);
  }
  if (!pathname.startsWith("/d/")) return false;
  const want = to.slice(3).split("/")[0];
  const have = pathname.slice(3).split("/")[0];
  return have === want || have.endsWith(`-${want}`);
}

/**
 * Whether a URL opens the product's drive: by slug, or by an id derived from
 * the slug such as `workflows-03d82c74`.
 */
export function isProductDrive(pathname: string, product: Product): boolean {
  return new RegExp(`^/d/${product.drive.slug}(?:[/-]|$)`).test(pathname);
}

/**
 * Which product a URL belongs to: its own pages and its drive (by slug, or by
 * an id derived from the slug such as `workflows-03d82c74`). Shared routes
 * (settings, search) keep the product that was open last.
 */
export function productFor(
  pathname: string,
  fallback: ProductId | null,
): Product {
  const own = PRODUCTS.find(
    (p) =>
      p.nav.some((n) => navMatches(pathname, n.to)) ||
      (p.beforeDrive ?? []).some((n) => navMatches(pathname, n.to)) ||
      (p.afterDrive ?? []).some((n) => navMatches(pathname, n.to)) ||
      isProductDrive(pathname, p),
  );
  return (
    own ??
    PRODUCTS.find((p) => p.id === fallback) ??
    PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT)!
  );
}
