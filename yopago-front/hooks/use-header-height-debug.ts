import { useCallback, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";

// Lightweight dev helper to log tab header heights and keep a shared registry across screens.
type HeaderMetricsRegistry = Record<string, number>;

type HeaderMetricsGlobal = {
  __TAB_HEADER_METRICS__?: HeaderMetricsRegistry;
};

const getMetricsRegistry = () => {
  const globalScope = globalThis as HeaderMetricsGlobal;
  if (!globalScope.__TAB_HEADER_METRICS__) {
    globalScope.__TAB_HEADER_METRICS__ = {};
  }
  return globalScope.__TAB_HEADER_METRICS__;
};

const recordHeaderHeight = (tabName: string, height: number) => {
  if (!__DEV__) {
    return;
  }

  const metrics = getMetricsRegistry();
  if (metrics[tabName] === height) {
    return;
  }

  metrics[tabName] = height;

  const report = Object.entries(metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}: ${value}px`)
    .join(" | ");

  console.log(`[TabHeaderHeight] ${report}`);
};

export const useHeaderHeightDebug = (tabName: string) => {
  const lastHeightRef = useRef<number | null>(null);

  return useCallback(
    (event: LayoutChangeEvent) => {
      if (!__DEV__) {
        return;
      }

      const height = Math.round(event.nativeEvent.layout.height);
      if (!Number.isFinite(height) || lastHeightRef.current === height) {
        return;
      }

      lastHeightRef.current = height;
      recordHeaderHeight(tabName, height);
    },
    [tabName]
  );
};
