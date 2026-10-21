import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  footer?: ReactNode;
};

export function Card({
  title,
  description,
  footer,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-slate-200 bg-white p-gutter shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
      {...props}
    >
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </header>
      <div className="text-sm text-slate-700 dark:text-slate-300">
        {children}
      </div>
      {footer ? (
        <>
          <hr className="my-4 border-slate-200 dark:border-slate-700" />
          <footer className="flex items-center justify-end gap-2">
            {footer}
          </footer>
        </>
      ) : null}
    </div>
  );
}
