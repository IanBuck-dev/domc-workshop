import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { OpportunityDiscoverySummary } from "../lib/opportunity-types";
import {
  processListSearchText,
  processListStatus,
  processListStatusOptions,
  type ProcessListStatus,
} from "../lib/process-list-model";
import type { ProcessCaptureRecord } from "../lib/process-types";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface ProcessListRow {
  record: ProcessCaptureRecord;
  status: ProcessListStatus;
  searchText: string;
}

const includesSelected: FilterFn<ProcessListRow> = (
  row,
  columnId,
  value: string[],
) => !value?.length || value.includes(String(row.getValue(columnId)));

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

function germanText(left: string, right: string) {
  return left.localeCompare(right, "de", { sensitivity: "base" });
}

function sortIndicator(direction: false | "asc" | "desc") {
  if (direction === "asc") return <ArrowUp className="size-3.5" />;
  if (direction === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-55" />;
}

function sortLabel(column: string, direction: false | "asc" | "desc") {
  if (direction === "asc") return `${column}: Sortierung aufheben`;
  if (direction === "desc") return `${column}: aufsteigend sortieren`;
  return `${column}: absteigend sortieren`;
}

function FilterPopover({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const selectedCount = selected.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-3">
          <span>
            {label}
            {selectedCount ? ` (${selectedCount})` : ""}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={`${label} suchen`} />
          <CommandList>
            <CommandEmpty>Keine Optionen gefunden.</CommandEmpty>
            <CommandGroup heading={label}>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => onToggle(option.value)}
                    aria-checked={checked}
                    role="menuitemcheckbox"
                  >
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-sm border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent",
                      )}
                      aria-hidden="true"
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selectedCount > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={onClear}
              >
                Alle {label.toLocaleLowerCase("de-DE")} anzeigen
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function selectedValues(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return Array.isArray(value) ? value.map(String) : [];
}

export function ProcessListTableSkeleton({ header }: { header: ReactNode }) {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Prozessliste wird geladen"
      role="status"
    >
      <span className="sr-only">Prozessliste wird geladen</span>
      <div className="flex flex-wrap items-end gap-4">
        {header}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Skeleton className="h-9 w-full sm:w-80" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-14" />
            </TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Öffnen</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-5 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-36" />
              </TableCell>
              <TableCell className="w-10 pr-4">
                <Skeleton className="ml-auto size-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProcessListTable({
  records,
  opportunities,
  header,
}: {
  records: ProcessCaptureRecord[];
  opportunities: OpportunityDiscoverySummary[];
  header: ReactNode;
}) {
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const rows = useMemo(() => {
    const analyses = new Map(
      opportunities.map((item) => [item.processId, item]),
    );
    return records.map((record) => ({
      record,
      status: processListStatus(record, analyses.get(record.id)),
      searchText: processListSearchText(record),
    }));
  }, [opportunities, records]);
  const departments = useMemo(
    () =>
      [...new Set(rows.map((row) => row.record.cover.department))]
        .sort(germanText)
        .map((department) => ({ value: department, label: department })),
    [rows],
  );
  const statusOptions = useMemo(
    () =>
      processListStatusOptions()
        .filter((status) => rows.some((row) => row.status.id === status.id))
        .map((status) => ({ value: status.id, label: status.label })),
    [rows],
  );
  const columns = useMemo<ColumnDef<ProcessListRow>[]>(
    () => [
      {
        id: "processName",
        accessorFn: (row) => row.record.cover.processName,
        header: "Prozess",
        sortingFn: (left, right) =>
          germanText(
            left.original.record.cover.processName,
            right.original.record.cover.processName,
          ),
        cell: ({ row }) => (
          <Link
            className="font-semibold text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            to={`/processes/${row.original.record.id}`}
          >
            {row.original.record.cover.processName}
          </Link>
        ),
      },
      {
        id: "department",
        accessorFn: (row) => row.record.cover.department,
        header: "Fachbereich",
        filterFn: includesSelected,
        sortingFn: (left, right) =>
          germanText(
            left.original.record.cover.department,
            right.original.record.cover.department,
          ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status.id,
        header: "Status",
        filterFn: includesSelected,
        sortingFn: (left, right) =>
          left.original.status.priority - right.original.status.priority ||
          germanText(
            left.original.record.cover.processName,
            right.original.record.cover.processName,
          ),
        cell: ({ row }) => (
          <Badge tone={row.original.status.tone}>
            {row.original.status.label}
          </Badge>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, value) =>
      row.original.searchText.includes(normalized(String(value))),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    enableSortingRemoval: true,
  });
  const departmentFilter = selectedValues(columnFilters, "department");
  const statusFilter = selectedValues(columnFilters, "status");
  const toggleFilter = (id: "department" | "status", value: string) => {
    setColumnFilters((current) => {
      const selected = selectedValues(current, id);
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return [
        ...current.filter((filter) => filter.id !== id),
        ...(next.length ? [{ id, value: next }] : []),
      ];
    });
  };
  const reset = () => {
    setGlobalFilter("");
    setColumnFilters([]);
    setSorting([]);
  };
  const cycleSorting = (id: string, append: boolean) => {
    setSorting((current) => {
      const existing = current.find((item) => item.id === id);
      const next = !existing
        ? { id, desc: true }
        : existing.desc
          ? { id, desc: false }
          : null;
      if (!append) return next ? [next] : [];
      if (!existing) return [...current, { id, desc: true }];
      if (!next) return current.filter((item) => item.id !== id);
      return current.map((item) => (item.id === id ? next : item));
    });
  };
  const hasFilters = Boolean(globalFilter || columnFilters.length);
  const visibleRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {header}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <label className="relative w-full sm:w-80">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Prozesse durchsuchen"
              aria-label="Prozesse durchsuchen"
            />
          </label>
          <FilterPopover
            label="Fachbereich"
            options={departments}
            selected={departmentFilter}
            onToggle={(value) => toggleFilter("department", value)}
            onClear={() =>
              setColumnFilters((current) =>
                current.filter((filter) => filter.id !== "department"),
              )
            }
          />
          <FilterPopover
            label="Status"
            options={statusOptions}
            selected={statusFilter}
            onToggle={(value) => toggleFilter("status", value)}
            onClear={() =>
              setColumnFilters((current) =>
                current.filter((filter) => filter.id !== "status"),
              )
            }
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" /> Filter zurücksetzen
            </Button>
          )}
          <Button asChild>
            <Link to="/processes/new">
              <Plus className="size-4" /> Prozess erfassen
            </Link>
          </Button>
        </div>
      </div>
      <Table className="min-w-[700px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const direction = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className="p-0"
                    aria-sort={
                      direction === "asc"
                        ? "ascending"
                        : direction === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-full justify-start rounded-none px-3 font-semibold text-foreground hover:bg-transparent hover:text-primary"
                      onClick={(event) =>
                        cycleSorting(header.column.id, event.shiftKey)
                      }
                      aria-label={sortLabel(
                        String(header.column.columnDef.header),
                        direction,
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {sortIndicator(direction)}
                    </Button>
                  </TableHead>
                );
              })}
              <TableHead className="w-10">
                <span className="sr-only">Öffnen</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {visibleRows.length ? (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => navigate(`/processes/${row.original.record.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/processes/${row.original.record.id}`);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                <TableCell
                  className="w-10 pr-4 text-right text-muted-foreground"
                  aria-hidden="true"
                >
                  <ChevronRight className="ml-auto size-4" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-12 text-center text-muted-foreground"
              >
                <p className="font-medium text-foreground">
                  Keine Prozesse gefunden
                </p>
                <p className="mt-1 text-ui">Passen Sie Suche oder Filter an.</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={reset}
                >
                  Filter zurücksetzen
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
