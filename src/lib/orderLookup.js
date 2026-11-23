import mongoose from "mongoose";
import Order from "@/models/Order";

// Admin-facing order links are built from different sources (notifications, search,
// size-confirmation threads, custom-jacket inquiries, vendor PDF export, etc.) and should
// always carry the Mongo _id — but to stay robust if any caller ever passes the
// human-readable orderNumber (e.g. "PAI-1234") instead, fall back to a lookup by
// orderNumber rather than letting Order.findById throw a CastError.
export function orderLookupQuery(id) {
  return mongoose.isValidObjectId(id)
    ? Order.findById(id)
    : Order.findOne({ orderNumber: id });
}
