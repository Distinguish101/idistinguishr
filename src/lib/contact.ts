// Shared by the contact form (client) and /api/contact (server) so the list of
// topics can't drift apart.
export const CONTACT_TOPICS = [
  "Booking or payment",
  "Teaching on IDistinguishR",
  "Account or privacy",
  "Accessibility",
  "Safety or safeguarding concern",
  "Something else",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];
