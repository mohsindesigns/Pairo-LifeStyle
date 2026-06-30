import dbConnect from "../db.js";
import AffiliateClick from "../../models/AffiliateClick.js";

class ClickQueue {
  constructor() {
    this.queue = [];
    this.timer = null;
    this.MAX_SIZE = 100;
    this.FLUSH_INTERVAL_MS = 5000;
  }

  init() {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
    // Ensure timer doesn't block process termination in test/script environments
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  async enqueue(clickData) {
    this.queue.push(clickData);
    this.init(); // Lazy-initialize background timer

    if (this.queue.length >= this.MAX_SIZE) {
      await this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      await dbConnect();
      await AffiliateClick.insertMany(batch);
      console.log(`[ClickQueue] Flushed batch of ${batch.length} click records successfully.`);
    } catch (error) {
      console.error("[ClickQueue Flush Error] Failed to write click telemetry batch:", error);
      // Prepend failed batch back to queue to retry on next flush
      this.queue = [...batch, ...this.queue];
    }
  }
}

// Global singleton instance
const clickQueue = new ClickQueue();
export default clickQueue;
export { ClickQueue };
