import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "motion/react";
import { formatDate, isOverdue, type Task } from "@auralis/shared";
import { useGetTasksQuery } from "@/store/api";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { cx } from "@/components/ui/labels";
import { ageing, headline, priorityBreakdown, statusBreakdown, throughput } from "./analytics";
import { TimeReport } from "./TimeReport";

/**
 * Four charts and a row of headline figures.
 *
 * Series colours come from the validated chart tokens, assigned in a fixed
 * order — a filter that removes a series never repaints the survivors. Every
 * chart also offers a table view, because a chart alone is not an accessible
 * way to publish numbers.
 */
export function AnalyticsPage({ boardId }: { boardId: string }) {
  const { data: tasks = [], isLoading } = useGetTasksQuery(boardId);

  if (isLoading) return <AnalyticsSkeleton />;

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Nothing to measure yet"
        description="Add a few tasks and this page will show how the work is moving."
      />
    );
  }

  return (
    <div className="scrollbar-slim flex-1 overflow-y-auto px-4 py-5 md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Everything here is computed from the board — no separate reporting store.
        </p>

        <HeadlineRow tasks={tasks} />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Work by status"
            caption="Where everything currently sits"
            table={statusBreakdown(tasks).map((row) => [row.label, String(row.count)])}
            tableHead={["Status", "Tasks"]}
          >
            <StatusChart tasks={tasks} />
          </ChartCard>

          <ChartCard
            title="Priority mix"
            caption="Open against completed, per priority"
            table={priorityBreakdown(tasks).map((row) => [
              row.label,
              String(row.open),
              String(row.completed),
            ])}
            tableHead={["Priority", "Open", "Done"]}
          >
            <PriorityChart tasks={tasks} />
          </ChartCard>

          <ChartCard
            title="Throughput"
            caption="Created and completed over the last 14 days"
            table={throughput(tasks).map((row) => [
              row.label,
              String(row.created),
              String(row.completed),
            ])}
            tableHead={["Day", "Created", "Completed"]}
          >
            <ThroughputChart tasks={tasks} />
          </ChartCard>

          <ChartCard
            title="How long work has been open"
            caption="Age of everything not yet done"
            table={ageing(tasks).map((row) => [row.bucket, String(row.count)])}
            tableHead={["Age", "Tasks"]}
          >
            <AgeingChart tasks={tasks} />
          </ChartCard>
        </div>

        <TimeReport boardId={boardId} tasks={tasks} />

        <OverdueList tasks={tasks} />
      </div>
    </div>
  );
}

function HeadlineRow({ tasks }: { tasks: Task[] }) {
  const stats = useMemo(() => headline(tasks), [tasks]);

  const tiles = [
    { label: "Total tasks", value: String(stats.total), tone: "neutral" as const },
    { label: "Completed", value: `${stats.completionRate}%`, tone: "good" as const },
    {
      label: "Overdue",
      value: String(stats.overdue),
      tone: stats.overdue > 0 ? ("bad" as const) : ("neutral" as const),
    },
    {
      label: "Median time to done",
      value: stats.medianCycleDays === null ? "—" : `${stats.medianCycleDays}d`,
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.04 }}
        >
          <Card className="p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {tile.label}
            </p>
            <p
              className={cx(
                "mt-1.5 text-2xl font-semibold tabular-nums",
                tile.tone === "good" && "text-[var(--success)]",
                tile.tone === "bad" && "text-[var(--danger)]",
                tile.tone === "neutral" && "text-[var(--text-primary)]"
              )}
            >
              {tile.value}
            </p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

const AXIS_PROPS = {
  stroke: "var(--chart-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Matches the app surface so tooltips do not look pasted on. */
const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-overlay)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
  boxShadow: "var(--shadow-overlay)",
} as const;

function StatusChart({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => statusBreakdown(tasks), [tasks]);
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-hover)" }} />
        <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {/* Colour follows the status, not its rank, so it is stable as counts change. */}
          {data.map((row, index) => (
            <Cell key={row.status} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PriorityChart({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => priorityBreakdown(tasks), [tasks]);

  return (
    <>
      <Legend
        items={[
          { label: "Open", color: "var(--chart-1)" },
          { label: "Completed", color: "var(--chart-4)" },
        ]}
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-hover)" }} />
          {/* A 2px surface gap keeps adjacent bars from reading as one block. */}
          <Bar
            dataKey="open"
            name="Open"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            fill="var(--chart-4)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function ThroughputChart({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => throughput(tasks), [tasks]);

  return (
    <>
      <Legend
        items={[
          { label: "Created", color: "var(--chart-2)" },
          { label: "Completed", color: "var(--chart-4)" },
        ]}
      />
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--border-strong)" }} />
          <Line
            type="monotone"
            dataKey="created"
            name="Created"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

function AgeingChart({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => ageing(tasks), [tasks]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="bucket" width={92} {...AXIS_PROPS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-hover)" }} />
        <Bar
          dataKey="count"
          name="Tasks"
          fill="var(--chart-3)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Overdue work, listed rather than charted — you act on these individually. */
function OverdueList({ tasks }: { tasks: Task[] }) {
  const overdue = useMemo(
    () =>
      tasks
        .filter((task) => isOverdue(task))
        .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
        .slice(0, 8),
    [tasks]
  );

  if (overdue.length === 0) {
    return (
      <Card className="mt-4 p-5">
        <p className="text-sm text-[var(--success)]">Nothing is overdue. </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Overdue work
          <span className="ml-2 rounded-[var(--radius-pill)] bg-[var(--danger-subtle)] px-2 py-0.5 text-2xs font-semibold text-[var(--danger)]">
            {overdue.length}
          </span>
        </h2>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {overdue.map((task) => (
          <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--priority-${task.priority})` }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
              {task.title}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[var(--danger)]">
              {formatDate(task.dueDate)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * A chart with its own table view.
 *
 * The toggle is not a nicety: a chart publishes numbers that a screen reader
 * cannot read, and the table is how those numbers stay available.
 */
function ChartCard({
  title,
  caption,
  children,
  table,
  tableHead,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  table: string[][];
  tableHead: string[];
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{caption}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          aria-pressed={showTable}
          className="shrink-0 rounded-[var(--radius-control)] border border-[var(--border-default)] px-2 py-1 text-2xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {showTable ? "Chart" : "Table"}
        </button>
      </div>

      {showTable ? (
        <div className="scrollbar-slim max-h-[220px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--surface-raised)]">
              <tr>
                {tableHead.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="border-b border-[var(--border-default)] pb-1.5 font-semibold text-[var(--text-secondary)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.join("|")} className="border-b border-[var(--border-subtle)]">
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={cx(
                        "py-1.5 text-[var(--text-primary)]",
                        index > 0 && "tabular-nums"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex-1 px-4 py-5 md:px-6" aria-busy="true" aria-label="Loading analytics">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-7 w-32" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className="h-[86px]" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((chart) => (
            <Skeleton key={chart} className="h-[290px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
