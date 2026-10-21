import { useState, type FormEvent } from "react";
import { Button } from "./Button";

const plans = ["Free", "Pro", "Team"];

const fieldClass =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitted(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label
          htmlFor="email"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          placeholder="you@company.com"
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
        {error ? (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="plan"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Plan
        </label>
        <select id="plan" name="plan" className={fieldClass} defaultValue="Pro">
          {plans.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          name="updates"
          defaultChecked
          className="size-4 rounded border-slate-300 text-brand-600 dark:border-slate-600"
        />
        Send me product updates
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit">Create account</Button>
        <Button type="reset" variant="secondary" onClick={() => setEmail("")}>
          Clear
        </Button>
      </div>

      {submitted ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Thanks — check your inbox.
        </p>
      ) : null}
    </form>
  );
}
