import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { buildMatcher } from "@/lib/doc/replace";

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

interface SearchState {
  query: string;
  options: SearchOptions;
  matches: { from: number; to: number }[];
  active: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>("plrSearch");

function findMatches(doc: PMNode, query: string, options: SearchOptions) {
  const out: { from: number; to: number }[] = [];
  const re = buildMatcher(query, options);
  if (!re) return out;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, "￼");
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!m[0].length) {
        re.lastIndex++;
        continue;
      }
      out.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    }
    return false;
  });
  return out;
}

function decorate(doc: PMNode, matches: { from: number; to: number }[], active: number) {
  return DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === active ? "plr-find-match plr-find-match-active" : "plr-find-match" })),
  );
}

function compute(doc: PMNode, query: string, options: SearchOptions, active: number): SearchState {
  const matches = query ? findMatches(doc, query, options) : [];
  const a = matches.length ? Math.min(Math.max(0, active), matches.length - 1) : -1;
  return { query, options, matches, active: a, decorations: decorate(doc, matches, a) };
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    plrSearch: {
      setSearch: (query: string, options?: Partial<SearchOptions>) => ReturnType;
      clearSearch: () => ReturnType;
      gotoMatch: (direction: 1 | -1) => ReturnType;
      replaceMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

export function getSearchState(state: EditorState): SearchState | undefined {
  return searchKey.getState(state);
}

function scrollToMatch(tr: Transaction, m: { from: number; to: number } | undefined) {
  if (!m) return tr;
  return tr.setMeta("plrSearchScroll", m);
}

export const SearchHighlight = Extension.create({
  name: "plrSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, state) => compute(state.doc, "", { caseSensitive: false, wholeWord: false }, 0),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (meta) return compute(newState.doc, meta.query ?? prev.query, meta.options ?? prev.options, meta.active ?? prev.active);
            if (tr.docChanged && prev.query) return compute(newState.doc, prev.query, prev.options, prev.active);
            return prev;
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.decorations;
          },
        },
        view: () => ({
          update(view, prevState) {
            const s = searchKey.getState(view.state);
            const p = searchKey.getState(prevState);
            if (!s || s.active < 0 || (p && p.active === s.active && p.query === s.query && p.matches.length === s.matches.length)) return;
            const m = s.matches[s.active];
            if (!m) return;
            try {
              const dom = view.domAtPos(m.from).node as HTMLElement;
              const el = dom.nodeType === 3 ? dom.parentElement : dom;
              el?.scrollIntoView({ block: "center", behavior: "smooth" });
            } catch {
              /* ignore */
            }
          },
        }),
      }),
    ];
  },
  addCommands() {
    return {
      setSearch:
        (query, options) =>
        ({ tr, state, dispatch }) => {
          const prev = searchKey.getState(state);
          const opts = { caseSensitive: false, wholeWord: false, ...(prev?.options ?? {}), ...(options ?? {}) };
          if (dispatch) dispatch(tr.setMeta(searchKey, { query, options: opts, active: 0 }));
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { query: "", active: 0 }));
          return true;
        },
      gotoMatch:
        (direction) =>
        ({ tr, state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          const next = (s.active + direction + s.matches.length) % s.matches.length;
          if (dispatch) dispatch(scrollToMatch(tr.setMeta(searchKey, { active: next }), s.matches[next]));
          return true;
        },
      replaceMatch:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || s.active < 0) return false;
          const m = s.matches[s.active];
          if (!m) return false;
          if (dispatch) {
            if (replacement) tr.insertText(replacement, m.from, m.to);
            else tr.delete(m.from, m.to);
            dispatch(tr.setMeta(searchKey, { active: s.active }));
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          if (dispatch) {
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const m = s.matches[i];
              if (replacement) tr.insertText(replacement, m.from, m.to);
              else tr.delete(m.from, m.to);
            }
            dispatch(tr.setMeta(searchKey, { active: 0 }));
          }
          return true;
        },
    };
  },
});
