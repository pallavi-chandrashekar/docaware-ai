import { ChubWrapper } from "../docs/chub-wrapper.js";
import { verbose } from "../core/logger.js";

/**
 * Bidirectional sync between local memory and chub annotations.
 */
export class AnnotationSync {
  constructor({ chubWrapper, memoryStore }) {
    this.chub = chubWrapper || new ChubWrapper();
    this.memory = memoryStore;
  }

  /**
   * Sync a memory entry to chub annotation (if it has a library reference).
   */
  async syncToChub(entry) {
    if (!entry.library) return false;

    try {
      const docId = `${entry.library}/api`;
      const note = `[${entry.type}] ${entry.content}`;
      await this.chub.annotate(docId, note);
      verbose(`Synced to chub: ${docId}`);
      return true;
    } catch (err) {
      verbose(`chub sync failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Import all chub annotations into local memory.
   */
  async importFromChub() {
    try {
      const annotations = await this.chub.listAnnotations();
      if (!annotations) return 0;

      // Parse chub annotation output (format varies by chub version)
      const lines = annotations.split("\n").filter((l) => l.trim());
      let imported = 0;

      for (const line of lines) {
        // Try to parse "docId: note" format
        const match = line.match(/^([^:]+):\s*(.+)/);
        if (match) {
          const [, docId, note] = match;
          const library = docId.replace(/\/api$/, "");

          await this.memory.remember({
            type: "annotation",
            library,
            content: note.trim(),
            metadata: { chubDocId: docId.trim(), syncedFromChub: true },
            tags: ["chub", library],
          });
          imported++;
        }
      }

      verbose(`Imported ${imported} annotations from chub`);
      return imported;
    } catch (err) {
      verbose(`chub import failed: ${err.message}`);
      return 0;
    }
  }

  /**
   * Full bidirectional sync.
   */
  async sync() {
    const imported = await this.importFromChub();

    // Sync local library-specific entries to chub
    const entries = await this.memory.list({ type: "annotation" });
    let exported = 0;
    for (const entry of entries) {
      if (!entry.metadata?.syncedFromChub) {
        const synced = await this.syncToChub(entry);
        if (synced) exported++;
      }
    }

    return { imported, exported };
  }
}
