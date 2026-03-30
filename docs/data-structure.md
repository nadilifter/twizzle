# Uplifter Data Structure

## Entity Relationship Overview

```mermaid
erDiagram
    Organization ||--o{ OrganizationMember : has
    Organization ||--o{ Program : offers
    Organization ||--o{ Event : hosts
    Organization ||--o{ Athlete : manages
    Organization ||--o{ Family : serves
    Organization ||--o{ Invoice : issues
    Organization ||--o{ Product : sells
    Organization ||--o{ Discount : creates
    Organization ||--|| WebsiteConfig : configures
    Organization ||--o| OrganizationSubscription : subscribes
    Organization ||--o{ Facility : owns
    Organization ||--o{ Equipment : manages
    Organization ||--o{ StaffProfile : employs
    Organization ||--o{ Shift : schedules
    Organization ||--o{ ScheduleTemplate : defines
    Organization ||--o| MedicalFormConfig : configures
    Organization ||--o{ CustomMedicalQuestion : defines

    Athlete ||--o| AthleteMedicalInfo : has
    AthleteMedicalInfo ||--o{ CustomMedicalResponse : contains
    CustomMedicalQuestion ||--o{ CustomMedicalResponse : answered_by

    User ||--o{ OrganizationMember : joins
    User ||--o{ Session : has
    User ||--o{ Account : links
    User ||--o{ FacilityAssignment : assigned_to
    User ||--o| StaffProfile : has_profile

    StaffProfile ||--o{ Shift : works
    StaffProfile ||--o{ StaffAvailability : available
    StaffProfile ||--o{ EventStaff : assigned_to

    Family ||--o{ AthleteGuardian : guardians
    Athlete ||--o{ AthleteGuardian : has

    Family ||--o{ Invoice : receives
    Family ||--o{ Payment : makes
    Family ||--o{ Enrollment : manages

    Athlete ||--o{ Enrollment : enrolls
    Athlete ||--o{ Attendance : attends
    Athlete ||--o{ AthleteMembership : holds

    Program ||--o{ Event : schedules
    Program ||--o{ Enrollment : accepts
    Event ||--o{ Attendance : tracks
    Event }o--o| Facility : hosted_at
    Event ||--o{ EventStaff : staffed_by

    Facility ||--o{ Space : contains
    Facility ||--o{ Equipment : houses
    Facility ||--o{ FacilityAssignment : staffed_by
    Facility ||--o{ Shift : location_for
    Space ||--o{ Equipment : optionally_contains

    ScheduleTemplate ||--o{ ScheduleTemplateEntry : contains

    Invoice ||--o{ LineItem : contains
    Invoice ||--o{ Payment : settles

    MembershipGroup ||--o{ MembershipInstance : versions
    MembershipInstance ||--o{ AthleteMembership : assigns

    Transaction }o--|| Payment : records
    Organization ||--o{ Transaction : processes
    Organization ||--o{ Payout : receives
```

## Core Domain Models

### Multi-Tenancy Layer

```mermaid
classDiagram
    class Organization {
        +String id
        +String name
        +String slug
        +String email
        +String phone
        +String street
        +String city
        +String country
        +DateTime createdAt
    }

    class OrganizationMember {
        +String id
        +String organizationId
        +String userId
        +Role role
        +MemberStatus status
        +DateTime joinedAt
    }

    class User {
        +String id
        +String email
        +String name
        +String passwordHash
        +Role role
        +Boolean isSuperAdmin
        +DateTime lastActiveAt
    }

    class OrganizationSubscription {
        +String id
        +String organizationId
        +String planId
        +SubscriptionStatus status
        +BillingCycle billingCycle
        +DateTime currentPeriodEnd
    }

    class SubscriptionPlan {
        +String id
        +String name
        +Decimal monthlyPrice
        +Int maxAthletes
        +Int maxUsers
        +Json features
    }

    Organization "1" --> "*" OrganizationMember
    User "1" --> "*" OrganizationMember
    Organization "1" --> "0..1" OrganizationSubscription
    SubscriptionPlan "1" --> "*" OrganizationSubscription
```

### Athletes & Families

```mermaid
classDiagram
    class Family {
        +String id
        +String name
        +String primaryContact
        +String email
        +String phone
        +Decimal balance
        +String organizationId
    }

    class Athlete {
        +String id
        +String name
        +String email
        +String level
        +String group
        +AthleteStatus status
        +DateTime birthDate
        +String organizationId
        +Json medicalDetails
    }

    class AthleteGuardian {
        +String id
        +String athleteId
        +String familyId
        +String relationship
        +Boolean isPrimary
    }

    class Enrollment {
        +String id
        +String athleteId
        +String programId
        +String familyId
        +DateTime startDate
        +EnrollmentStatus status
    }

    Family "1" --> "*" AthleteGuardian
    Athlete "1" --> "*" AthleteGuardian
    Athlete "1" --> "*" Enrollment
    Family "1" --> "*" Enrollment
```

### Medical Information

Organizations can configure which medical information to collect from athletes. The system supports both standard medical fields (allergies, conditions, medications, emergency contact) and custom questions defined by the organization.

```mermaid
classDiagram
    class MedicalFormConfig {
        +String id
        +String organizationId
        +Boolean collectAllergies
        +Boolean collectMedications
        +Boolean collectConditions
        +Boolean collectEmergencyContact
        +Boolean collectDietaryRestrictions
        +Boolean collectInsuranceInfo
        +Boolean requireDuringRegistration
    }

    class CustomMedicalQuestion {
        +String id
        +String organizationId
        +String questionText
        +MedicalQuestionType questionType
        +Json options
        +Boolean required
        +Int displayOrder
        +Boolean isActive
    }

    class AthleteMedicalInfo {
        +String id
        +String athleteId
        +String[] allergies
        +String[] medications
        +String[] conditions
        +String[] dietaryRestrictions
        +String insuranceProvider
        +String insurancePolicyNumber
        +String emergencyContactName
        +String emergencyContactPhone
        +String emergencyContactRelation
        +String additionalNotes
        +String lastUpdatedBy
    }

    class CustomMedicalResponse {
        +String id
        +String medicalInfoId
        +String questionId
        +String response
    }

    Organization "1" --> "0..1" MedicalFormConfig
    Organization "1" --> "*" CustomMedicalQuestion
    Athlete "1" --> "0..1" AthleteMedicalInfo
    AthleteMedicalInfo "1" --> "*" CustomMedicalResponse
    CustomMedicalQuestion "1" --> "*" CustomMedicalResponse
```

**MedicalQuestionType enum values:**

- `TEXT` - Free-form text response
- `YES_NO` - Yes/No radio buttons
- `MULTIPLE_CHOICE` - Single selection from options
- `CHECKBOX` - Multiple selections from options

### Programs & Memberships

```mermaid
classDiagram
    class Program {
        +String id
        +String name
        +String description
        +ProgramStatus status
        +String organizationId
    }

    class MembershipGroup {
        +String id
        +String name
        +String description
        +String[] programTypes
        +Boolean allowAutoRenew
    }

    class MembershipInstance {
        +String id
        +String membershipGroupId
        +String name
        +Decimal price
        +BillingInterval billingInterval
        +DateTime startDate
        +DateTime endDate
        +MembershipStatus status
    }

    class AthleteMembership {
        +String id
        +String athleteId
        +String membershipInstanceId
        +DateTime startDate
        +DateTime endDate
        +MembershipStatus status
        +Boolean autoRenew
    }

    MembershipGroup "1" --> "*" MembershipInstance
    MembershipInstance "1" --> "*" AthleteMembership
```

### Events & Attendance

```mermaid
classDiagram
    class Event {
        +String id
        +String title
        +DateTime date
        +String startTime
        +String endTime
        +EventType type
        +Int capacity
        +Json location
        +String programId
        +String coachId
    }

    class Attendance {
        +String id
        +String athleteId
        +String eventId
        +AttendanceStatus status
        +DateTime checkedIn
        +String notes
    }

    class EventType {
        <<enumeration>>
        CLASS
        CLINIC
        PARTY
        TRYOUT
        MEETING
        OTHER
    }

    class AttendanceStatus {
        <<enumeration>>
        REGISTERED
        PRESENT
        ABSENT
        LATE
        EXCUSED
    }

    Event "1" --> "*" Attendance
    Event --> EventType
    Attendance --> AttendanceStatus
```

### Facilities & Equipment

```mermaid
classDiagram
    class Facility {
        +String id
        +String organizationId
        +String name
        +String street
        +String city
        +String stateProvince
        +FacilityStatus status
        +Boolean isDefault
        +Int squareFootage
        +Int maxCapacity
    }

    class Space {
        +String id
        +String facilityId
        +String name
        +Int capacity
        +SpaceStatus status
    }

    class Equipment {
        +String id
        +String organizationId
        +String facilityId
        +String spaceId
        +String name
        +EquipmentCondition condition
        +EquipmentStatus status
        +DateTime lastInspectionDate
    }

    class FacilityAssignment {
        +String id
        +String facilityId
        +String userId
        +Boolean isPrimary
    }

    class FacilityStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
        MAINTENANCE
    }

    class SpaceStatus {
        <<enumeration>>
        OPEN
        CLOSED
        MAINTENANCE
    }

    class EquipmentCondition {
        <<enumeration>>
        EXCELLENT
        GOOD
        FAIR
        POOR
        UNSAFE
    }

    class EquipmentStatus {
        <<enumeration>>
        ACTIVE
        RETIRED
        MAINTENANCE
    }

    Facility "1" --> "*" Space
    Facility "1" --> "*" Equipment
    Facility "1" --> "*" FacilityAssignment
    Space "1" --> "*" Equipment
    Facility --> FacilityStatus
    Space --> SpaceStatus
    Equipment --> EquipmentCondition
    Equipment --> EquipmentStatus
```

### Financial System

```mermaid
classDiagram
    class Invoice {
        +String id
        +String reference
        +String familyId
        +InvoiceStatus status
        +DateTime dueDate
        +Decimal subtotal
        +Decimal tax
        +Decimal total
    }

    class LineItem {
        +String id
        +String invoiceId
        +String description
        +Int quantity
        +Decimal unitPrice
        +Decimal total
        +String programId
        +String athleteId
    }

    class Payment {
        +String id
        +String invoiceId
        +String familyId
        +Decimal amount
        +PaymentType method
        +PaymentStatus status
    }

    class Transaction {
        +String id
        +String pspReference
        +TransactionType type
        +Decimal amount
        +TransactionStatus status
        +DateTime settledAt
    }

    class Payout {
        +String id
        +String reference
        +Decimal amount
        +Decimal fees
        +Decimal net
        +PayoutStatus status
        +DateTime paidAt
    }

    class Discount {
        +String id
        +String name
        +String code
        +DiscountType type
        +Decimal amount
        +DateTime validFrom
        +DateTime validTo
    }

    Invoice "1" --> "*" LineItem
    Invoice "1" --> "*" Payment
    Payment "0..1" --> "0..1" Transaction
    LineItem "*" --> "0..1" Discount
```

### Ledger & Accounting

```mermaid
classDiagram
    class GLCode {
        +String id
        +String code
        +String description
        +GLCodeType type
        +GLCodeStatus status
    }

    class LedgerEntry {
        +String id
        +DateTime date
        +String description
        +String glCodeId
        +String reference
        +Decimal debit
        +Decimal credit
        +LedgerEntryStatus status
    }

    class GLCodeType {
        <<enumeration>>
        REVENUE
        EXPENSE
        LIABILITY
        ASSET
        EQUITY
    }

    GLCode "1" --> "*" LedgerEntry
    GLCode --> GLCodeType
```

### Website & CMS

```mermaid
classDiagram
    class WebsiteConfig {
        +String id
        +String organizationId
        +String primaryColor
        +String secondaryColor
        +String logo
        +String favicon
        +String heroImage
        +String heroHeadline
        +String heroSubheadline
        +String heroText
        +Boolean showCalendar
        +Boolean showRegistration
        +String subdomain
        +String domain
        +Boolean isPublished
    }

    class Organization {
        +String id
        +String name
        +String slug
    }

    Organization "1" --> "0..1" WebsiteConfig
```

### POS & Products

```mermaid
classDiagram
    class Product {
        +String id
        +String name
        +String description
        +String sku
        +String category
        +Decimal price
        +String imageUrl
        +Int maxInventory
        +Int currentInventory
        +Boolean isActive
    }

    class StockMovement {
        +String id
        +String productId
        +StockMovementType type
        +Int quantity
        +Int previousQty
        +Int newQty
        +String referenceId
    }

    class StockMovementType {
        <<enumeration>>
        SALE
        RESTOCK
        ADJUSTMENT
        RETURN
    }

    Product "1" --> "*" StockMovement
    StockMovement --> StockMovementType
```

### Staff & Scheduling

```mermaid
classDiagram
    class StaffProfile {
        +String id
        +String userId
        +String organizationId
        +EmploymentType employmentType
        +String title
        +Decimal hourlyRate
        +DateTime hireDate
        +Json certifications
        +String phone
        +Json emergencyContact
    }

    class Shift {
        +String id
        +String organizationId
        +String staffProfileId
        +String facilityId
        +DateTime date
        +String startTime
        +String endTime
        +String shiftType
        +String notes
        +ShiftStatus status
    }

    class ScheduleTemplate {
        +String id
        +String organizationId
        +String name
        +Boolean isActive
    }

    class ScheduleTemplateEntry {
        +String id
        +String templateId
        +Int dayOfWeek
        +String startTime
        +String endTime
        +String shiftType
        +String staffProfileId
        +String facilityId
    }

    class StaffAvailability {
        +String id
        +String staffProfileId
        +Int dayOfWeek
        +String startTime
        +String endTime
        +Boolean isAvailable
    }

    class EventStaff {
        +String id
        +String eventId
        +String staffProfileId
        +EventStaffRole role
        +String notes
    }

    class EmploymentType {
        <<enumeration>>
        FULL_TIME
        PART_TIME
        CONTRACTOR
        VOLUNTEER
    }

    class ShiftStatus {
        <<enumeration>>
        SCHEDULED
        CONFIRMED
        IN_PROGRESS
        COMPLETED
        CANCELLED
        NO_SHOW
    }

    class EventStaffRole {
        <<enumeration>>
        LEAD
        ASSISTANT
        VOLUNTEER
        OBSERVER
    }

    StaffProfile --> EmploymentType
    StaffProfile "1" --> "*" Shift
    StaffProfile "1" --> "*" StaffAvailability
    StaffProfile "1" --> "*" EventStaff
    Shift --> ShiftStatus
    ScheduleTemplate "1" --> "*" ScheduleTemplateEntry
    EventStaff --> EventStaffRole
```

**Key Relationships:**

- **StaffProfile ↔ User**: One-to-one relationship extending User with staff-specific data (employment type, certifications, hourly rate)
- **StaffProfile → Shift**: Staff members can be assigned to multiple shifts
- **StaffProfile → StaffAvailability**: Each staff member has weekly availability (one entry per day)
- **StaffProfile → EventStaff**: Staff can be assigned to multiple events with specific roles
- **ScheduleTemplate → ScheduleTemplateEntry**: Templates contain reusable weekly shift patterns
- **Shift → Facility**: Shifts can optionally be assigned to a specific facility

## Data Flow

```mermaid
flowchart TD
    subgraph Registration["Registration Flow"]
        R1[Parent visits site] --> R2[Selects program]
        R2 --> R3[Creates family account]
        R3 --> R4[Adds athlete]
        R4 --> R5[Enrolls in program]
        R5 --> R6[Invoice generated]
        R6 --> R7[Payment processed]
    end

    subgraph Attendance["Attendance Flow"]
        A1[Event scheduled] --> A2[Athletes enrolled]
        A2 --> A3[Coach takes attendance]
        A3 --> A4[Status recorded]
        A4 --> A5[Metrics calculated]
    end

    subgraph Financial["Financial Flow"]
        F1[Service provided] --> F2[Line item created]
        F2 --> F3[Invoice sent]
        F3 --> F4[Payment received]
        F4 --> F5[Transaction recorded]
        F5 --> F6[Ledger entry posted]
        F6 --> F7[Payout scheduled]
    end
```

## Enum Reference

| Enum               | Values                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Role               | ADMIN, COACH, VOLUNTEER, ACCOUNTANT, CUSTOM, PARENT, STAFF        |
| AthleteStatus      | ACTIVE, INACTIVE, TRIAL, GRADUATED                                |
| ProgramStatus      | ACTIVE, INACTIVE, ARCHIVED                                        |
| EventType          | CLASS, CLINIC, PARTY, TRYOUT, MEETING, OTHER                      |
| AttendanceStatus   | REGISTERED, PRESENT, ABSENT, LATE, EXCUSED                        |
| InvoiceStatus      | DRAFT, SENT, PAID, OVERDUE, CANCELLED, PARTIAL                    |
| PaymentStatus      | PENDING, COMPLETED, FAILED, REFUNDED                              |
| TransactionStatus  | AUTHORISED, CAPTURED, SETTLED, REFUSED, CANCELLED, ERROR, PENDING |
| MembershipStatus   | ACTIVE, EXPIRED, CANCELLED, ARCHIVED                              |
| BillingInterval    | MONTHLY, YEARLY, SESSION                                          |
| SubscriptionStatus | ACTIVE, TRIALING, PAST_DUE, CANCELLED, PAUSED                     |
| FacilityStatus     | ACTIVE, INACTIVE, MAINTENANCE                                     |
| SpaceStatus        | OPEN, CLOSED, MAINTENANCE                                         |
| EquipmentCondition | EXCELLENT, GOOD, FAIR, POOR, UNSAFE                               |
| EquipmentStatus    | ACTIVE, RETIRED, MAINTENANCE                                      |
| EmploymentType     | FULL_TIME, PART_TIME, CONTRACTOR, VOLUNTEER                       |
| ShiftStatus        | SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW  |
| EventStaffRole     | LEAD, ASSISTANT, VOLUNTEER, OBSERVER                              |
