import { Button } from "./Button";
import { cn } from "../lib/cn";

type NavItem = {
  href: string;
  label: string;
};

const items: NavItem[] = [
  { href: "#overview", label: "Overview" },
  { href: "#components", label: "Components" },
  { href: "#table", label: "Table" },
  { href: "#signup", label: "Sign up" },
];

export type NavBarProps = {
  active: string;
  dark: boolean;
  onToggleTheme: () => void;
};

export function NavBar({ active, dark, onToggleTheme }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <a
          href="#overview"
          className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
        >
          Visual Agent
        </a>
        <ul className="flex items-center gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={cn(
                  "rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                  active === item.href && "bg-slate-100 text-slate-900",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onToggleTheme}>
            {dark ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </div>
    </nav>
  );
}
