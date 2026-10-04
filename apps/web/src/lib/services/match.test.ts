import { describe, expect, expectTypeOf, it } from "vitest";
import type { StudentRepo } from "@/lib/repo/interface";
import { matchItems, NotImplementedError } from "./match";
import type { SearchFn } from "./search";

describe("matching engine stub", () => {
  it("has exactly the searchItems signature, so it can replace it later", () => {
    expectTypeOf(matchItems).toEqualTypeOf<SearchFn>();
  });

  it("says plainly that it isn't implemented (the student writes it)", async () => {
    await expect(matchItems({} as StudentRepo, "gray hoodie")).rejects.toBeInstanceOf(NotImplementedError);
  });
});
