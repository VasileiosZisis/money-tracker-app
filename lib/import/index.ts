/**
 * Import helpers in this phase build an ephemeral preview/validation pipeline.
 * Preview state should remain temporary and must not be stored long-term in the
 * database.
 */

export type ImportPreviewPersistence = "ephemeral";
