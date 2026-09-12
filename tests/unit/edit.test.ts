import { describe, it, expect } from "vitest";
import { addFilter, removeFilter, filterTerm } from "@/lib/dsl/edit";

describe("edit", () => {
  it("adds a filter term", () => {
    expect(addFilter("", "level", "error")).toBe("level:error");
    expect(addFilter("level:error", "service", "api")).toBe("level:error service:api");
  });
  it("quotes values with spaces", () => {
    expect(filterTerm("message", "hello world")).toBe('message:"hello world"');
  });
  it("does not duplicate and replaces the opposite polarity", () => {
    expect(addFilter("level:error", "level", "error")).toBe("level:error");
    expect(addFilter("level:error x", "level", "error", true)).toBe("x -level:error");
  });
  it("removes a term", () => {
    expect(removeFilter('a:1 b:"x y" c:3', 'b:"x y"')).toBe("a:1 c:3");
  });
});
