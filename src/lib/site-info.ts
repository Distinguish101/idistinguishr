// Business details used in the footer and the legal pages. Fill these in as
// you decide them: set a field to a string and every place that uses it
// updates. While a field is null, the site shows a highlighted "[to be added]"
// placeholder instead, so unfinished details are easy to spot and can't be
// mistaken for real ones.
//
// Nothing here is invented. Leave a field null until it is true.
export const SITE_INFO = {
  tradingName: "IDistinguishR",

  // The legal entity that runs the site, e.g. "IDistinguishR Ltd".
  legalName: null as string | null,
  // "limited company" or "sole trader"; changes the wording of the company line.
  entityType: null as "limited company" | "sole trader" | null,
  // Companies House number, if a limited company.
  companyNumber: null as string | null,
  // Registered office or business address.
  registeredAddress: null as string | null,
  // Which country's law governs the terms, e.g. "England and Wales".
  governingLaw: null as string | null,

  // Who handles safeguarding concerns, e.g. "the founder" or a named person.
  safeguardingLead: null as string | null,

  // Set to a month like "November 2026" once a solicitor has reviewed the
  // legal pages. While null, the pages carry a visible "draft" notice.
  legalReviewedOn: null as string | null,
};

export type Placeholder = { text: string; isPlaceholder: boolean };

// The value if it has been filled in, otherwise "[label]" flagged as a placeholder.
export function infoOrPlaceholder(value: string | null, label: string): Placeholder {
  return value ? { text: value, isPlaceholder: false } : { text: `[${label}]`, isPlaceholder: true };
}
