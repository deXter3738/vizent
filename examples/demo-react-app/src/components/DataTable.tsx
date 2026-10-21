import { cn } from "../lib/cn";

export type Row = {
  id: number;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Viewer";
  active: boolean;
};

const rows: Row[] = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com", role: "Owner", active: true },
  { id: 2, name: "Alan Turing", email: "alan@example.com", role: "Admin", active: true },
  { id: 3, name: "Grace Hopper", email: "grace@example.com", role: "Admin", active: false },
  { id: 4, name: "Katherine Johnson", email: "kj@example.com", role: "Viewer", active: true },
];

const columns = ["Name", "Email", "Role", "Status"];

export function DataTable() {
  return (
    <div className="overflow-hidden rounded-card border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="bg-white hover:bg-brand-50 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                {row.name}
              </td>
              <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                {row.email}
              </td>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                {row.role}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    row.active
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {row.active ? "Active" : "Invited"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
