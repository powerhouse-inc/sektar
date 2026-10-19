import iconForestDark from "../../../../editors/sektar/design/app-icons/sektar-app-icon-forest-dark.svg";
import iconForestLight from "../../../../editors/sektar/design/app-icons/sektar-app-icon-forest-light.svg";
import iconSageDark from "../../../../editors/sektar/design/app-icons/sektar-app-icon-sage-dark.svg";
import iconSageLight from "../../../../editors/sektar/design/app-icons/sektar-app-icon-sage-light.svg";
import type { IconName } from "../../../../editors/sektar/kit/ui.js";

// The Sektar products this app ships, in the design system's order. One
// account, one shell: the lockup in the sidebar switches between them and the
// product line, the navigation, the drive link and the page follow.
export type ProductId = "productivity" | "finance";

export type NavItem = { to: string; label: string; icon: IconName };

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
      // The Mail drive (hosts/*: slug "mail", drive app email-workspace)
      { to: "/d/mail", label: "Mail", icon: "mail" },
    ],
    drive: {
      slug: "workflows",
      label: "Workflows drive",
      editor: "workflow-studio",
    },
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
    candidates.length > 1 ? drive.header.id : drive.header.slug || drive.header.id;
  return { drive, param };
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
      p.nav.some((n) => pathname.startsWith(n.to)) ||
      isProductDrive(pathname, p),
  );
  return (
    own ??
    PRODUCTS.find((p) => p.id === fallback) ??
    PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT)!
  );
}
