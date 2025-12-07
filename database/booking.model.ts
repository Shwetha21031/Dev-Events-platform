import mongoose, { Document, Schema, Model } from "mongoose";
import { Event, IEvent } from "./event.model";

/**
 * Booking document interface (strongly typed).
 */
export interface IBooking extends Document {
  eventId: mongoose.Types.ObjectId | IEvent;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simple RFC-like email validation (good balance between correctness & simplicity).
 */
function isValidEmail(email: string): boolean {
  // general-purpose regex; avoids extreme edge cases while catching malformed addresses
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

const BookingSchema = new Schema<IBooking>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    email: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

/**
 * Index eventId for faster lookups of bookings by event.
 */
BookingSchema.index({ eventId: 1 });

/**
 * Pre-save hook (async):
 * - Validate email format.
 * - Verify referenced Event exists.
 * Throwing an error aborts the save.
 */
BookingSchema.pre<IBooking>("save", async function () {
  if (typeof this.email !== "string" || !isValidEmail(this.email)) {
    throw new Error("Invalid email format for booking.");
  }

  // Ensure referenced event exists
  const eventExists = await Event.exists({ _id: this.eventId });
  if (!eventExists) {
    throw new Error("Referenced event does not exist.");
  }
});


/**
 * Export Booking model; guard against model overwrite during hot reloads.
 */
export const Booking: Model<IBooking> = mongoose.models.Booking
  ? (mongoose.models.Booking as Model<IBooking>)
  : mongoose.model<IBooking>("Booking", BookingSchema);
