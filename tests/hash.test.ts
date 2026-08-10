import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashRequest, scrub } from "../src/hash.js";

describe("hashRequest", () => {
  it("produces the same hash for identical method + params", () => {
    const a = hashRequest("tools/call", {
      arguments: { city: "London" },
      name: "get_weather",
    });
    const b = hashRequest("tools/call", {
      arguments: { city: "London" },
      name: "get_weather",
    });
    assert.equal(a, b);
  });

  it("produces different hashes for different params", () => {
    const a = hashRequest("tools/call", {
      arguments: { city: "London" },
      name: "get_weather",
    });
    const b = hashRequest("tools/call", {
      arguments: { city: "Paris" },
      name: "get_weather",
    });
    assert.notEqual(a, b);
  });

  it("produces different hashes for different methods", () => {
    const a = hashRequest("tools/call", { name: "foo" });
    const b = hashRequest("tools/list", { name: "foo" });
    assert.notEqual(a, b);
  });

  it("handles undefined params", () => {
    const a = hashRequest("tools/list");
    const b = hashRequest("tools/list", undefined);
    assert.equal(a, b);
  });
});

describe("scrub", () => {
  it("removes specified fields from params before hashing", () => {
    const withSecret = hashRequest(
      "tools/call",
      { Authorization: "Bearer secret123", name: "foo" },
      ["Authorization"]
    );
    const withoutSecret = hashRequest("tools/call", { name: "foo" }, [
      "Authorization",
    ]);
    assert.equal(withSecret, withoutSecret);
  });

  it("recursively removes nested fields", () => {
    const result = scrub({ a: 1, nested: { b: 2, secret: "y" }, secret: "x" }, [
      "secret",
    ]);
    assert.deepEqual(result, { a: 1, nested: { b: 2 } });
  });

  it("handles arrays", () => {
    const result = scrub(
      [
        { a: 1, secret: "x" },
        { b: 2, secret: "y" },
      ],
      ["secret"]
    );
    assert.deepEqual(result, [{ a: 1 }, { b: 2 }]);
  });

  it("handles null and primitive values", () => {
    assert.equal(scrub(null, ["x"]), null);
    assert.equal(scrub(42, ["x"]), 42);
    assert.equal(scrub("hello", ["x"]), "hello");
  });
});
