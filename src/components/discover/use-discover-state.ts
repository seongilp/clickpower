"use client";

import { parseAsString, parseAsArrayOf, parseAsStringEnum, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { addFilter } from "@/lib/dsl/edit";
import { resolveRange } from "@/lib/time";

const DEFAULT_COLUMNS = ["service", "message"];

export const discoverParsers = {
  q: parseAsString.withDefault(""),
  from: parseAsString.withDefault("now-1h"),
  to: parseAsString.withDefault("now"),
  cols: parseAsArrayOf(parseAsString).withDefault(DEFAULT_COLUMNS),
  mode: parseAsStringEnum(["dsl", "sql"]).withDefault("dsl"),
  sql: parseAsString.withDefault(""),
};

export function useDiscoverState() {
  const [state, setState] = useQueryStates(discoverParsers, { history: "push" });

  const range = useMemo(() => resolveRange(state.from, state.to), [state.from, state.to]);

  const setQuery = useCallback((q: string) => setState({ q }), [setState]);
  const setMode = useCallback((mode: "dsl" | "sql") => setState({ mode }), [setState]);
  const setSql = useCallback((sql: string) => setState({ sql }), [setState]);
  const setRange = useCallback((from: string, to: string) => setState({ from, to }), [setState]);
  const applyFilter = useCallback(
    (field: string, value: string, negate = false) => setState({ q: addFilter(state.q, field, value, negate) }),
    [setState, state.q],
  );
  const toggleColumn = useCallback(
    (col: string) => {
      const cols = state.cols.includes(col) ? state.cols.filter((c) => c !== col) : [...state.cols, col];
      return setState({ cols: cols.length ? cols : DEFAULT_COLUMNS });
    },
    [setState, state.cols],
  );

  return { ...state, range, setQuery, setRange, setMode, setSql, applyFilter, toggleColumn };
}

export type DiscoverState = ReturnType<typeof useDiscoverState>;
