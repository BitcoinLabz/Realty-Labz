import { describe, expect, it } from "vitest";
import { paperworkStatus } from "./paperwork";

const reqs = [
  { id: "pa", label: "Purchase agreement", sides: ["BUYER", "SELLER"] as const, order: 0 },
  { id: "sd", label: "Seller's disclosure", sides: ["SELLER"] as const, order: 1 },
  { id: "pre", label: "Pre-approval letter", sides: ["BUYER"] as const, order: 2 },
].map((r) => ({ ...r, sides: [...r.sides] }));

describe("paperworkStatus", () => {
  it("only lists what this transaction type needs, in the office's order", () => {
    const { items, total } = paperworkStatus(reqs, [], "SELLER");
    expect(items.map((i) => i.requirement.id)).toEqual(["pa", "sd"]);
    expect(total).toBe(2);
  });

  it("counts an item as on file once a document is filed against it", () => {
    const docs = [{ id: "d1", fileName: "PA.pdf", requirementId: "pa" }];
    const { items, onFile } = paperworkStatus(reqs, docs, "BUYER");
    expect(onFile).toBe(1);
    expect(items[0].document?.id).toBe("d1");
    expect(items[1].document).toBeNull();
  });

  it("ignores documents that aren't filed against anything", () => {
    const docs = [{ id: "d1", fileName: "scan.pdf", requirementId: null }];
    expect(paperworkStatus(reqs, docs, "BUYER").onFile).toBe(0);
  });

  it("shows the newest document when several are filed against one item", () => {
    const docs = [
      { id: "new", fileName: "PA-v2.pdf", requirementId: "pa" },
      { id: "old", fileName: "PA.pdf", requirementId: "pa" },
    ];
    expect(paperworkStatus(reqs, docs, "SELLER").items[0].document?.id).toBe("new");
  });

  it("is empty for a type the office lists nothing for", () => {
    expect(paperworkStatus(reqs, [], "TENANT")).toEqual({ items: [], onFile: 0, total: 0 });
  });
});
