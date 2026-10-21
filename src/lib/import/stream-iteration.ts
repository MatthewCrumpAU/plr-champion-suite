/**
 * Safari (iPhone, iPad and Mac) can't loop over a ReadableStream with `for await … of`, which
 * pdf.js 6 uses to read a page's text — PDF imports failed there with "undefined is not a function".
 * This adds the standard async iterator to ReadableStream when the browser lacks it. It changes
 * nothing in browsers that already support it.
 */
export function ensureReadableStreamIteration() {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
  if (typeof proto[Symbol.asyncIterator] === "function") return;
  async function* values(this: ReadableStream<unknown>, options?: { preventCancel?: boolean }) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      // Leaving the loop early (break/throw) cancels the stream unless asked not to, like the standard.
      if (!options?.preventCancel) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  Object.defineProperty(proto, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
}
