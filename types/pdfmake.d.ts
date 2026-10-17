// Minimal typings for pdfmake 0.3 browser build (the @types package targets 0.2's callback API).
declare module "pdfmake/build/pdfmake" {
  interface PdfMakeDocument {
    getBlob(): Promise<Blob>;
    getBuffer(): Promise<Uint8Array>;
  }
  interface PdfMakeStatic {
    createPdf(definition: Record<string, unknown>): PdfMakeDocument;
    addVirtualFileSystem(vfs: Record<string, string>): void;
    addFonts(fonts: Record<string, Record<string, string>>): void;
  }
  const pdfMake: PdfMakeStatic;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}
