// database/event.model.ts
import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Event document interface (strongly typed).
 */
export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // ISO date string
  time: string; // normalized to "HH:MM" (24-hour)
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/* ------------------------ Utilities ------------------------ */

/** Create a URL-friendly slug from a title. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Normalize common time formats into "HH:MM" 24-hour.
 * Accepts "9:30 AM", "09:30", "21:00", "9:30pm", etc.
 * Throws if the time cannot be parsed.
 */
function normalizeTimeTo24(input: string): string {
  const trimmed = input.trim().toLowerCase();

  // direct match "HH:MM"
  const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const hh = parseInt(hhmm[1], 10);
    const mm = parseInt(hhmm[2], 10);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  // match "h[:mm] am/pm"
  const ampm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const period = ampm[3];
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;
    }
  }

  throw new Error(
    `Invalid time format: "${input}". Expected "HH:MM" or "h:mm AM/PM".`
  );
}

/**
 * Normalize a date string to ISO (YYYY-MM-DDTHH:mm:ss.sssZ).
 * If input is parseable by Date, convert to ISO. Throws if invalid.
 */
function normalizeDateToISO(input: string): string {
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date format: "${input}".`);
  }
  return dt.toISOString();
}

/* ------------------------ Schema ------------------------ */

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    description: { type: String, required: true },
    overview: { type: String, required: true },
    image: { type: String, required: true },
    venue: { type: String, required: true },
    location: { type: String, required: true },
    date: { type: String, required: true }, // stored as ISO string
    time: { type: String, required: true }, // stored as "HH:MM"
    mode: { type: String, required: true },
    audience: { type: String, required: true },
    agenda: { type: [String], required: true },
    organizer: { type: String, required: true },
    tags: { type: [String], required: true },
  },
  {
    timestamps: true,
    strict: true,
  }
);

/* ------------------------ Hooks ------------------------ */

/**
 * Async pre-save hook:
 * - Generate slug only when title changed or absent.
 * - Normalize date to ISO and time to HH:MM (24-hour).
 * - Validate required fields and arrays.
 *
 * Using an async hook avoids TypeScript ambiguity with callback-style hooks.
 * Throwing an Error aborts the save operation.
 */
EventSchema.pre<IEvent>("save", async function () {
  // Validate required string fields are non-empty
  const requiredStringFields: Array<keyof IEvent> = [
    "title",
    "description",
    "overview",
    "image",
    "venue",
    "location",
    "date",
    "time",
    "mode",
    "audience",
    "organizer",
  ];

  for (const field of requiredStringFields) {
    const val = (this as unknown as Record<string, unknown>)[field as string];
    if (typeof val !== "string" || val.trim().length === 0) {
      throw new Error(
        `Field "${String(field)}" is required and must be a non-empty string.`
      );
    }
  }

  // Ensure arrays are present and non-empty
  if (!Array.isArray(this.agenda) || this.agenda.length === 0) {
    throw new Error(
      `"agenda" is required and must be a non-empty array of strings.`
    );
  }
  if (!Array.isArray(this.tags) || this.tags.length === 0) {
    throw new Error(
      `"tags" is required and must be a non-empty array of strings.`
    );
  }

  // Slug generation: only regenerate if title changed or slug absent
  if (this.isModified("title") || !this.slug) {
    this.slug = slugify(this.title);
  }

  // Normalize date -> ISO string (throws on invalid formats)
  this.date = normalizeDateToISO(this.date);

  // Normalize time -> "HH:MM" 24-hour (throws on invalid formats)
  this.time = normalizeTimeTo24(this.time);
});

/* ------------------------ Indexes & Export ------------------------ */

// Ensure unique index on slug (schema.index included for clarity)
EventSchema.index({ slug: 1 }, { unique: true });

// Export model, guarding against model overwrite in environments with hot reload
export const Event: Model<IEvent> =
  (mongoose.models.Event as Model<IEvent>) ||
  mongoose.model<IEvent>("Event", EventSchema);
