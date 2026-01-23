// Permission constants and helpers for RBAC

export const PERMISSIONS = {
  // General
  DASHBOARD_VIEW: "dashboard.view",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",

  // Athletes
  ATHLETES_VIEW: "athletes.view",
  ATHLETES_CREATE: "athletes.create",
  ATHLETES_EDIT: "athletes.edit",
  ATHLETES_DELETE: "athletes.delete",

  // Families
  FAMILIES_VIEW: "families.view",
  FAMILIES_CREATE: "families.create",
  FAMILIES_EDIT: "families.edit",
  FAMILIES_DELETE: "families.delete",

  // Training
  TRAINING_VIEW: "training.view",
  TRAINING_CREATE: "training.create",
  TRAINING_EDIT: "training.edit",
  TRAINING_DELETE: "training.delete",

  // Events
  EVENTS_VIEW: "events.view",
  EVENTS_CREATE: "events.create",
  EVENTS_EDIT: "events.edit",
  EVENTS_DELETE: "events.delete",

  // Financials
  FINANCIALS_VIEW: "financials.view",
  FINANCIALS_CREATE: "financials.create",
  FINANCIALS_EDIT: "financials.edit",
  FINANCIALS_DELETE: "financials.delete",
  FINANCIALS_ADMIN: "financials.admin", // Full financial access

  // Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",

  // Communication
  COMMUNICATION_VIEW: "communication.view",
  COMMUNICATION_SEND: "communication.send",

  // Super admin
  ALL: "*",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [PERMISSIONS.ALL],
  COACH: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ATHLETES_VIEW,
    PERMISSIONS.ATHLETES_EDIT,
    PERMISSIONS.FAMILIES_VIEW,
    PERMISSIONS.TRAINING_VIEW,
    PERMISSIONS.TRAINING_CREATE,
    PERMISSIONS.TRAINING_EDIT,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_CREATE,
    PERMISSIONS.EVENTS_EDIT,
    PERMISSIONS.COMMUNICATION_VIEW,
    PERMISSIONS.COMMUNICATION_SEND,
  ],
  VOLUNTEER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ATHLETES_VIEW,
    PERMISSIONS.EVENTS_VIEW,
  ],
  ACCOUNTANT: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FINANCIALS_VIEW,
    PERMISSIONS.FINANCIALS_CREATE,
    PERMISSIONS.FINANCIALS_EDIT,
    PERMISSIONS.FAMILIES_VIEW,
  ],
  CUSTOM: [], // Custom roles start with no permissions
};

// Permission groups for UI display
export const PERMISSION_GROUPS = [
  {
    category: "General",
    items: [
      { id: PERMISSIONS.DASHBOARD_VIEW, label: "View Dashboard", description: "Access to the main dashboard" },
      { id: PERMISSIONS.SETTINGS_VIEW, label: "View Settings", description: "View organization settings" },
      { id: PERMISSIONS.SETTINGS_EDIT, label: "Edit Settings", description: "Modify organization settings" },
    ],
  },
  {
    category: "Athletes",
    items: [
      { id: PERMISSIONS.ATHLETES_VIEW, label: "View Athletes", description: "View athlete profiles and data" },
      { id: PERMISSIONS.ATHLETES_CREATE, label: "Create Athletes", description: "Add new athletes" },
      { id: PERMISSIONS.ATHLETES_EDIT, label: "Edit Athletes", description: "Modify athlete information" },
      { id: PERMISSIONS.ATHLETES_DELETE, label: "Delete Athletes", description: "Remove athletes from the system" },
    ],
  },
  {
    category: "Families",
    items: [
      { id: PERMISSIONS.FAMILIES_VIEW, label: "View Families", description: "View family profiles" },
      { id: PERMISSIONS.FAMILIES_CREATE, label: "Create Families", description: "Add new families" },
      { id: PERMISSIONS.FAMILIES_EDIT, label: "Edit Families", description: "Modify family information" },
      { id: PERMISSIONS.FAMILIES_DELETE, label: "Delete Families", description: "Remove families from the system" },
    ],
  },
  {
    category: "Training",
    items: [
      { id: PERMISSIONS.TRAINING_VIEW, label: "View Training", description: "View lesson plans and programs" },
      { id: PERMISSIONS.TRAINING_CREATE, label: "Create Training", description: "Create lesson plans and programs" },
      { id: PERMISSIONS.TRAINING_EDIT, label: "Edit Training", description: "Modify training content" },
      { id: PERMISSIONS.TRAINING_DELETE, label: "Delete Training", description: "Remove training content" },
    ],
  },
  {
    category: "Events",
    items: [
      { id: PERMISSIONS.EVENTS_VIEW, label: "View Events", description: "View events and calendar" },
      { id: PERMISSIONS.EVENTS_CREATE, label: "Create Events", description: "Create new events" },
      { id: PERMISSIONS.EVENTS_EDIT, label: "Edit Events", description: "Modify events" },
      { id: PERMISSIONS.EVENTS_DELETE, label: "Delete Events", description: "Cancel or remove events" },
    ],
  },
  {
    category: "Financials",
    items: [
      { id: PERMISSIONS.FINANCIALS_VIEW, label: "View Financials", description: "View invoices and transactions" },
      { id: PERMISSIONS.FINANCIALS_CREATE, label: "Create Financials", description: "Create invoices and payments" },
      { id: PERMISSIONS.FINANCIALS_EDIT, label: "Edit Financials", description: "Modify financial records" },
      { id: PERMISSIONS.FINANCIALS_DELETE, label: "Delete Financials", description: "Remove financial records" },
      { id: PERMISSIONS.FINANCIALS_ADMIN, label: "Financial Admin", description: "Full financial administration" },
    ],
  },
  {
    category: "Users",
    items: [
      { id: PERMISSIONS.USERS_VIEW, label: "View Users", description: "View staff and users" },
      { id: PERMISSIONS.USERS_CREATE, label: "Create Users", description: "Invite new users" },
      { id: PERMISSIONS.USERS_EDIT, label: "Edit Users", description: "Modify user roles and permissions" },
      { id: PERMISSIONS.USERS_DELETE, label: "Delete Users", description: "Remove users from organization" },
    ],
  },
  {
    category: "Communication",
    items: [
      { id: PERMISSIONS.COMMUNICATION_VIEW, label: "View Communication", description: "View messages and announcements" },
      { id: PERMISSIONS.COMMUNICATION_SEND, label: "Send Communication", description: "Send messages and announcements" },
    ],
  },
];

// Helper to check if user has permission
export function hasPermission(userPermissions: string[], requiredPermission: Permission): boolean {
  if (userPermissions.includes(PERMISSIONS.ALL)) return true;
  return userPermissions.includes(requiredPermission);
}

// Helper to check if user has any of the permissions
export function hasAnyPermission(userPermissions: string[], requiredPermissions: Permission[]): boolean {
  if (userPermissions.includes(PERMISSIONS.ALL)) return true;
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

// Helper to check if user has all permissions
export function hasAllPermissions(userPermissions: string[], requiredPermissions: Permission[]): boolean {
  if (userPermissions.includes(PERMISSIONS.ALL)) return true;
  return requiredPermissions.every((p) => userPermissions.includes(p));
}
