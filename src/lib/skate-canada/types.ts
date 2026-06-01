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

// A row from the SC CRM `contact` entity. We pull just the fields the
// admin UI needs to confirm a match (or surface a mismatch). The CRM
// stores many more fields; we can extend this as more workflows need them.
//
// Field mapping:
//   contactId       ←  contactid (the canonical SC contact GUID)
//   memberNumber    ←  sc_skatecanadaid (the human-facing member number)
//   firstName       ←  firstname
//   lastName        ←  lastname
//   birthdate       ←  birthdate (stored as YYYY-MM-DDT12:00:00Z; we
//                    normalize to YYYY-MM-DD)
//   genderCode      ←  gendercode (raw SC code 1 | 2 | 947960000 | 947960001)
//   postalCode      ←  address1_postalcode
export interface SkateCanadaContact {
  contactId: string;
  memberNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  birthdate: string | null;
  genderCode: number | null;
  postalCode: string | null;
}
