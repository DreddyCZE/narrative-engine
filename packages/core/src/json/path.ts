import type { JsonPath } from "./json-safe.js";

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function formatJsonPath(path: JsonPath): string {
  if (path.length === 0) {
    return "";
  }

  return path
    .map((segment) => (typeof segment === "number" ? String(segment) : escapeJsonPointerSegment(segment)))
    .map((segment) => `/${segment}`)
    .join("");
}
