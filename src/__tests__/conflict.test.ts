import { describe, it, expect } from "vitest";
import * as Y from "yjs";

describe("Yjs CRDT Conflict Resolution", () => {
  it("should merge simultaneous edits deterministically without data loss", () => {
    // Initialize primary document on Client A
    const docA = new Y.Doc();
    const textA = docA.getText("default");
    textA.insert(0, "Hello World");

    // Client B starts with a clone of A's state
    const docB = new Y.Doc();
    const textB = docB.getText("default");
    
    const updateA1 = Y.encodeStateAsUpdate(docA);
    Y.applyUpdate(docB, updateA1);

    expect(textB.toString()).toBe("Hello World");

    // Scenario: Offline / simultaneous editing
    // Client A inserts text at the beginning
    textA.insert(0, "A: "); // "A: Hello World"

    // Client B appends text at the end
    textB.insert(11, " !"); // "Hello World !"

    // Generate updates
    const updateA2 = Y.encodeStateAsUpdate(docA);
    const updateB2 = Y.encodeStateAsUpdate(docB);

    // Reconcile changes (sync protocol)
    Y.applyUpdate(docA, updateB2);
    Y.applyUpdate(docB, updateA2);

    // Both clients must arrive at the exact same deterministic state
    expect(textA.toString()).toBe(textB.toString());
    expect(textA.toString()).toContain("A: ");
    expect(textA.toString()).toContain("!");
    
    console.log("Merged output:", textA.toString());
  });
});
