export type FacilityStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";
export type SpaceStatus = "OPEN" | "CLOSED" | "MAINTENANCE";
export type EquipmentCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNSAFE";
export type EquipmentStatus = "ACTIVE" | "RETIRED" | "MAINTENANCE";

export interface FacilityListItem {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  status: FacilityStatus;
  isDefault: boolean;
  squareFootage: number | null;
  maxCapacity: number | null;
  description: string | null;
  _count: {
    spaces: number;
    equipment: number;
    assignments: number;
    events: number;
  };
}

export interface FacilityOperatingHours {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface FacilityDetail extends FacilityListItem {
  createdAt: string;
  updatedAt: string;
  operatingHours: FacilityOperatingHours[];
}

export interface Space {
  id: string;
  name: string;
  capacity: number | null;
  status: SpaceStatus;
  description: string | null;
  _count: {
    equipment: number;
  };
}

export interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  lastInspectionDate: string | null;
  space: { id: string; name: string } | null;
}

export interface FacilityNote {
  id: string;
  facilityId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

export type FacilityActivityType = "event" | "program" | "program_instance" | "competition";

export interface FacilityActivityItem {
  id: string;
  type: FacilityActivityType;
  name: string;
  date: string;
  endDate: string | null;
  status: string;
  detail: string | null;
  href: string;
}

export type FacilityActivitySort =
  | "date_asc"
  | "date_desc"
  | "name_asc"
  | "name_desc"
  | "type_asc"
  | "type_desc";

export interface FacilityActivityPage {
  items: FacilityActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FacilityAssignment {
  id: string;
  facilityId: string;
  userId: string;
  isPrimary: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
  };
}

export interface CreateFacilityPayload {
  name: string;
  street?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  squareFootage?: number | null;
  maxCapacity?: number | null;
  description?: string | null;
  isDefault?: boolean;
}

export type UpdateFacilityPayload = Partial<CreateFacilityPayload> & {
  status?: FacilityStatus;
  isDefault?: boolean;
};
