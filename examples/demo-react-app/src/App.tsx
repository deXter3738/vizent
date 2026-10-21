import { useEffect, useState } from "react";
import { NavBar } from "./components/NavBar";
import { Card } from "./components/Card";
import { Button } from "./components/Button";
import { DataTable } from "./components/DataTable";
import { SignupForm } from "./components/SignupForm";

const variants = ["primary", "secondary", "ghost", "danger"] as const;

export function App() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <NavBar
        active="#overview"
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
        <section id="overview" className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Visual Agent demo
          </h1>
          <p className="max-w-prose text-sm text-slate-600 dark:text-slate-400">
            Press Alt+V (Option+V on a Mac) to open the element picker, then
            click anything on this page.
          </p>
        </section>

        <section id="components" className="grid gap-gutter md:grid-cols-2">
          <Card
            title="Buttons"
            description="Four variants, three sizes, built with cva."
            footer={<Button size="sm">Footer action</Button>}
          >
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => (
                <Button key={variant} variant={variant} size="sm">
                  {variant}
                </Button>
              ))}
            </div>
          </Card>

          <Card
            title="Sizes"
            description="Hover a button to see the transition."
            data-testid="sizes-card"
          >
            <div className="flex items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </Card>
        </section>

        <section id="table" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Team members</h2>
          <DataTable />
        </section>

        <section id="signup" className="max-w-md">
          <Card title="Create an account" description="A small real form.">
            <SignupForm />
          </Card>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
        Visual Agent — spike demo
      </footer>
    </div>
  );
}
