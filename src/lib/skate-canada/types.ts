// Minimal Skate Canada CRM entity shapes for Phase 6.1.
//
// Each interface mirrors a slice of a Dynamics CRM entity — only the fields
// we actually consume from the SOAP response. As Phase 6.2-6.5 light up,
// new entity shapes (Contact, MemberRegistration, Club) get added here.
//
// Canonical name mapping:
//   Twizzle field    ←  CRM logical name (in <Entity><Attributes>)
//   id               ←  sc_seasonid
//   name             ←  sc_name
//   startDate        ←  sc_startdate    (ISO yyyy-mm-dd)
//   endDate          ←  sc_enddate      (ISO yyyy-mm-dd)
//   stateCode        ←  statecode       (0 = active in CRM convention)

/** A Skate Canada membership season (Sept 1 → Aug 31 typically). */
export interface SkateCanadaSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 0 = active, 1 = inactive per CRM statecode convention. */
  stateCode?: number;
}
