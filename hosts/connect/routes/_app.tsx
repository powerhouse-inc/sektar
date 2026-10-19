import { initTheme, useDrives, useTheme } from "@powerhousedao/reactor-browser";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import bannerDark from "../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import bannerLight from "../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-light.svg";
import {
  Button,
  cx,
  Icon,
  PromoCard,
  Skeleton,
  Sprite,
  type IconName,
} from "../../../editors/sektar/kit/ui.js";
import { ProductSwitch } from "./-shared/product-switch.js";
import {
  driveFor,
  productFor,
  rememberProduct,
  rememberedProduct,
  type Product,
} from "./-shared/products.js";
import { SearchBar } from "./-shared/search-bar.js";
import { SearchContext } from "./-shared/search.js";
import { UserMenu } from "./-shared/user-menu.js";

// Sektar replaces Connect's layout with the design system's app shell: the
// sidebar (the product switch on the brand lockup, the product's work
// surfaces, its drive, promo, the user), a top bar with the search, and the
// content beside it. Under 960px the
// sidebar becomes a drawer behind the top bar's menu button, as in the design
// system's phone dashboard. Core routes (the drive at /d/sektar, settings)
// render inside the same shell.
export const Route = createFileRoute("/_app")({
  // The main page opens the default product (Productivity Center).
  beforeLoad: ({ location }) => {
    if (location.pathname === "/" || location.pathname === "") {
      throw redirect({ to: "/productivity" });
    }
  },
  component: Shell,
});

function pageTitle(pathname: string, product: Product) {
  const nav = product.nav.find((n) => pathname.startsWith(n.to));
  if (nav) return nav.label;
  if (pathname.startsWith("/d/")) return product.drive.label;
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/search")) return "Search";
  return "Sektar";
}

function Shell() {
  // Connect wires the theme-change handler in its own skeleton/load screens,
  // which a custom shell replaces: register it here so the light/dark/auto
  // toggles (ours and Connect's settings page) keep working.
  initTheme();
  const [query, setQuery] = useState("");
  const search = useMemo(() => ({ query, setQuery }), [query]);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  // The product follows the URL; shared pages keep the last one, which is
  // remembered per browser so a reload lands in the same product.
  const [lastProduct, setLastProduct] = useState(rememberedProduct);
  const product = productFor(pathname, lastProduct);
  useEffect(() => {
    if (product.id === lastProduct) return;
    setLastProduct(product.id);
    rememberProduct(product.id);
  }, [product.id, lastProduct]);
  const [drawer, setDrawer] = useState(false);
  // Desktop: the menu button collapses the sidebar to the design system's
  // 72px icon rail (and back); the choice is remembered per browser.
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem("sk:sidebar") === "rail";
    } catch {
      return false;
    }
  });
  const toggleMenu = () => {
    if (window.matchMedia("(max-width: 960px)").matches) {
      setDrawer(true);
      return;
    }
    setRail((v) => {
      try {
        localStorage.setItem("sk:sidebar", v ? "full" : "rail");
      } catch {
        // remembered only when storage is available
      }
      return !v;
    });
  };

  // A navigation closes the drawer; so does Escape, and growing past the
  // phone breakpoint (the grid sidebar is back).
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    const mq = window.matchMedia("(min-width: 961px)");
    const onSize = () => {
      if (mq.matches) setDrawer(false);
    };
    document.addEventListener("keydown", onKey, true);
    mq.addEventListener("change", onSize);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      mq.removeEventListener("change", onSize);
    };
  }, [drawer]);

  return (
    <SearchContext.Provider value={search}>
      <div
        className={cx(
          "sk-app sk-shell",
          rail && "sk-shell--rail",
          drawer && "is-drawer-open",
        )}
      >
        <Sprite />
        <Sidebar product={product} />
        <div className="sk-shell__main">
          <TopBar
            title={pageTitle(pathname, product)}
            product={product}
            onMenu={toggleMenu}
          />
          {/* Flush: the content area carries no padding of its own. Routed
              pages (.sk-page) bring the design system's page padding; drive
              apps, Workflow Studio and Connect's settings fill edge to edge. */}
          <main className="sk-shell__content sk-shell__content--flush">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <div className="sk-drawer" aria-hidden={!drawer}>
          <div className="sk-drawer__scrim" onClick={() => setDrawer(false)} />
          <Sidebar
            product={product}
            inDrawer
            onNavigate={() => setDrawer(false)}
          />
        </div>
      </div>
    </SearchContext.Provider>
  );
}

function Sidebar({
  product,
  inDrawer,
  onNavigate,
}: {
  product: Product;
  inDrawer?: boolean;
  /** Drawer: any link (even the current page's) closes it */
  onNavigate?: () => void;
}) {
  // The product's drive by slug; by id when a store still holds two with
  // that slug (see driveFor), by slug until the drives have loaded.
  const drives = useDrives();
  const driveParam = driveFor(drives, product)?.param ?? product.drive.slug;
  return (
    <aside className="sk-sidebar" aria-label="Main">
      {inDrawer && (
        <Button
          variant="ghost"
          iconOnly
          icon="close"
          className="sk-drawer__close"
          aria-label="Close menu"
          onClick={onNavigate}
        />
      )}
      <div className="sk-sidebar__brand">
        <ProductSwitch product={product} onPick={onNavigate} />
      </div>

      <ul className="sk-nav">
        {product.nav.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="sk-nav__item"
              onClick={onNavigate}
              activeProps={{
                className: "sk-nav__item is-active",
                "aria-current": "page",
              }}
            >
              <Icon name={item.icon} />
              <span className="sk-nav__label">{item.label}</span>
            </Link>
          </li>
        ))}
        <li className="sk-nav__group">
          <hr className="sk-divider" style={{ margin: 0 }} />
        </li>
        <li>
          <Link
            to="/d/$driveSlug/{-$nodeSlug}"
            params={{ driveSlug: driveParam }}
            className="sk-nav__item"
            onClick={onNavigate}
            activeProps={{
              className: "sk-nav__item is-active",
              "aria-current": "page",
            }}
          >
            <Icon name="folder" />
            <span className="sk-nav__label">{product.drive.label}</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings"
            className="sk-nav__item"
            onClick={onNavigate}
            activeProps={{
              className: "sk-nav__item is-active",
              "aria-current": "page",
            }}
          >
            <Icon name="settings" />
            <span className="sk-nav__label">Settings</span>
          </Link>
        </li>
      </ul>

      <div className="sk-sidebar__footer">
        {product.id === "finance" && (
          <PromoCard
            art={{ light: bannerLight, dark: bannerDark }}
            title="Connect a bank"
            action={
              <Link
                to="/finops/transactions"
                search={{ import: "1" }}
                className="sk-btn sk-btn--primary sk-btn--sm"
                onClick={onNavigate}
              >
                Import a feed
              </Link>
            }
          >
            Paste a statement and Sektar sorts and matches it.
          </PromoCard>
        )}
        <UserMenu />
      </div>
    </aside>
  );
}

function TopBar({
  title,
  product,
  onMenu,
}: {
  title: string;
  product: Product;
  onMenu: () => void;
}) {
  const [searching, setSearching] = useState(false);
  return (
    <header className={cx("sk-topbar", searching && "is-searching")}>
      <button
        type="button"
        className="sk-btn sk-btn--icon sk-btn--ghost sk-topbar__menu"
        aria-label="Menu"
        title="Show or hide the sidebar"
        onClick={onMenu}
      >
        <Icon name="menu" />
      </button>
      <span className="sk-topbar__title">{title}</span>
      <SearchBar autoFocus={searching} onClose={() => setSearching(false)} />
      <span className="sk-topbar__spacer" />
      <div className="sk-topbar__actions">
        <button
          type="button"
          className="sk-btn sk-btn--icon sk-btn--ghost sk-topbar__search-btn"
          aria-label={searching ? "Close search" : "Search"}
          aria-expanded={searching}
          onClick={() => setSearching((v) => !v)}
        >
          <Icon name={searching ? "close" : "search"} mono={searching} />
        </button>
        {product.id === "finance" && (
          <span className="sk-badge sk-badge--success sk-badge--pill sk-badge--dot sk-hide-mobile">
            Bank synced
          </span>
        )}
        <button
          type="button"
          className="sk-btn sk-btn--ghost sk-btn--icon"
          aria-label="Notifications"
        >
          <Icon name="bell" />
        </button>
        <span className="sk-hide-mobile">
          <ThemeSwitch />
        </span>
        {/* The sidebar (and its footer) is a drawer on small screens, so the
            sign-in / user chip surfaces here too. */}
        <span className="sk-topbar__user">
          <UserMenu />
        </span>
      </div>
    </header>
  );
}

function ThemeSwitch() {
  const { theme, isSystem, setTheme } = useTheme();
  const current = isSystem ? "system" : theme;
  const options: {
    value: "light" | "dark" | "system";
    icon: IconName;
    label: string;
  }[] = [
    { value: "light", icon: "sun", label: "Light" },
    { value: "dark", icon: "moon", label: "Dark" },
    { value: "system", icon: "leaf", label: "Auto" },
  ];
  return (
    <div className="sk-segmented" role="group" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx(
            "sk-segmented__item",
            current === o.value && "is-active",
          )}
          aria-pressed={current === o.value}
          title={o.label}
          onClick={() => setTheme(o.value)}
        >
          <Icon name={o.icon} size={16} />
        </button>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="sk-page sk-stack sk-stack--6">
      <Skeleton width={240} height={32} />
      <div className="sk-grid sk-grid--4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={96} />
        ))}
      </div>
      <Skeleton height={360} />
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1>{children}</h1>;
}
