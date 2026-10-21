// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { ensureReadableStreamIteration } from "@/lib/import/stream-iteration";

const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
const original = { iter: proto[Symbol.asyncIterator], values: proto.values };

function streamOf(values: number[]) {
  let cancelled = false;
  const stream = new ReadableStream<number>({
    start(c) {
      for (const v of values) c.enqueue(v);
      c.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, wasCancelled: () => cancelled };
}

afterEach(() => {
  Object.defineProperty(proto, Symbol.asyncIterator, { value: original.iter, writable: true, configurable: true });
  Object.defineProperty(proto, "values", { value: original.values, writable: true, configurable: true });
});

describe("ReadableStream iteration fallback (Safari)", () => {
  it("leaves browsers that already support it alone", () => {
    ensureReadableStreamIteration();
    expect(proto[Symbol.asyncIterator]).toBe(original.iter);
  });

  it("lets `for await` read a stream when the browser can't", async () => {
    delete proto[Symbol.asyncIterator];
    delete proto.values;
    const { stream } = streamOf([1, 2, 3]);
    expect(() => (stream as unknown as AsyncIterable<number>)[Symbol.asyncIterator]()).toThrow();

    ensureReadableStreamIteration();
    const seen: number[] = [];
    for await (const v of stream as unknown as AsyncIterable<number>) seen.push(v);
    expect(seen).toEqual([1, 2, 3]);
    expect(stream.locked).toBe(false);
  });

  it("cancels the stream when the loop stops early", async () => {
    delete proto[Symbol.asyncIterator];
    delete proto.values;
    ensureReadableStreamIteration();
    const { stream, wasCancelled } = streamOf([1, 2, 3]);
    for await (const v of stream as unknown as AsyncIterable<number>) if (v === 1) break;
    expect(wasCancelled()).toBe(true);
    expect(stream.locked).toBe(false);
  });
});
