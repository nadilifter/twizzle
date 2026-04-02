# SMS Toll-Free Verification

This document covers how to provision new toll-free phone numbers for the SMS pool and manage their Twilio toll-free verification (TFV).

---

## Overview

Uplifter uses a pool of Twilio toll-free numbers (`SMS_PHONE_POOL`) to route SMS conversations. Each number must:

1. Be **purchased** in Twilio
2. Be **added** to the Messaging Service
3. Have an **approved toll-free verification** (TFV)

Only numbers with `TWILIO_APPROVED` status are used for sending. The app checks this automatically via `fetchVerifiedTollFreeNumbers()` in `src/lib/twilio.ts`.

---

## Prerequisites

All commands below use Basic Auth with `TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN`. Export these from the target environment before running any commands:

```bash
export TWILIO_ACCOUNT_SID="<from .env>"
export TWILIO_AUTH_TOKEN="<from .env>"
export TWILIO_MESSAGING_SERVICE_SID="<from .env>"
export TWILIO_CUSTOMER_PROFILE_SID="<from Twilio Console > Trust Hub > Customer Profiles>"
```

The Customer Profile SID, business contact details, and EIN are available in the Twilio Console under Trust Hub > Customer Profiles, or in the existing approved verification (see "Checking Verification Status" below).

---

## Step 1: Purchase a Toll-Free Number

Search for available toll-free numbers and purchase one:

```bash
# Search for available numbers
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/AvailablePhoneNumbers/US/TollFree.json?PageSize=5" \
  | python3 -m json.tool

# Purchase a number (replace the phone number with one from search results)
curl -s -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "PhoneNumber=+18005551234" \
  | python3 -m json.tool
```

Note the `sid` (starts with `PN`) and `phone_number` from the response.

## Step 2: Add to Messaging Service

```bash
curl -s -X POST \
  "https://messaging.twilio.com/v1/Services/$TWILIO_MESSAGING_SERVICE_SID/PhoneNumbers" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "PhoneNumberSid=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  | python3 -m json.tool
```

## Step 3: Submit Toll-Free Verification

This is the critical step. The submission must include proper opt-in consent information or it will be rejected (error 30513).

```bash
# Copy business details from an existing approved verification first:
# curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
#   "https://messaging.twilio.com/v1/Tollfree/Verifications?PageSize=1&Status=TWILIO_APPROVED" \
#   | python3 -m json.tool

curl -s -X POST \
  "https://messaging.twilio.com/v1/Tollfree/Verifications" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "TollfreePhoneNumberSid=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  --data-urlencode "CustomerProfileSid=$TWILIO_CUSTOMER_PROFILE_SID" \
  --data-urlencode "BusinessName=Uplifter LLC" \
  --data-urlencode "BusinessWebsite=https://www.uplifterinc.com/" \
  --data-urlencode "BusinessStreetAddress=<from existing verification>" \
  --data-urlencode "BusinessCity=<from existing verification>" \
  --data-urlencode "BusinessStateProvinceRegion=<from existing verification>" \
  --data-urlencode "BusinessPostalCode=<from existing verification>" \
  --data-urlencode "BusinessCountry=US" \
  --data-urlencode "BusinessContactFirstName=<from existing verification>" \
  --data-urlencode "BusinessContactLastName=<from existing verification>" \
  --data-urlencode "BusinessContactEmail=<from existing verification>" \
  --data-urlencode "BusinessContactPhone=<from existing verification>" \
  --data-urlencode "NotificationEmail=<from existing verification>" \
  --data-urlencode "BusinessRegistrationNumber=<EIN from existing verification>" \
  --data-urlencode "BusinessRegistrationAuthority=EIN" \
  --data-urlencode "BusinessRegistrationCountry=US" \
  --data-urlencode "BusinessType=PRIVATE_PROFIT" \
  --data-urlencode "OptInType=WEB_FORM" \
  --data-urlencode "UseCaseSummary=Uplifter is a sports club management platform. Organizations send transactional SMS to parents and athletes: registration confirmations, schedule alerts, billing reminders, and coach messages." \
  --data-urlencode "ProductionMessageSample=Hi Jane, your registration for Summer Soccer Camp has been confirmed. First session is Mon Jun 15 at 9:00 AM. Reply STOP to opt out." \
  --data-urlencode "AdditionalInformation=Users create an account on our web app and provide their phone number during registration. They must click Send Verification Code and enter the SMS code to verify ownership. Only verified users receive SMS. Users can reply STOP to opt out and START to re-subscribe. All messages are transactional." \
  --data-urlencode "OptInConfirmationMessage=Your phone number has been verified. You will now receive SMS notifications from your organization. Reply STOP at any time to opt out." \
  --data-urlencode "HelpMessageSample=Reply STOP to unsubscribe. Reply START to re-subscribe. For help, contact your organization or email support@uplifterinc.com." \
  --data-urlencode "PrivacyPolicyUrl=https://www.uplifterinc.com/privacy-policy" \
  --data-urlencode "TermsAndConditionsUrl=https://www.uplifterinc.com/terms" \
  --data-urlencode "AgeGatedContent=false" \
  --data-urlencode "OptInKeywords=START" \
  --data-urlencode "OptInKeywords=YES" \
  --data-urlencode "OptInKeywords=UNSTOP" \
  --data-urlencode "OptInImageUrls=https://www.uplifterinc.com/privacy-policy" \
  --data-urlencode "UseCaseCategories=ACCOUNT_NOTIFICATIONS" \
  --data-urlencode "UseCaseCategories=CUSTOMER_CARE" \
  --data-urlencode "MessageVolume=10,000" \
  | python3 -m json.tool
```

The response will include a `sid` (starts with `HH`) and `status` of `PENDING_REVIEW`.

## Step 4: Add to SMS_PHONE_POOL

Add the new E.164 number to the `SMS_PHONE_POOL` environment variable on the target deployment (comma-separated):

```
SMS_PHONE_POOL=+1XXXXXXXXXX,+1XXXXXXXXXX,+1YYYYYYYYYY
```

The number will automatically be picked up by the pool manager. Only numbers with `TWILIO_APPROVED` verification status will be used for sending; unverified numbers are held back until approval.

---

## Checking Verification Status

List all toll-free verifications and their statuses:

```bash
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://messaging.twilio.com/v1/Tollfree/Verifications?PageSize=50" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for v in data['verifications']:
    print(f\"{v['tollfree_phone_number']:16s} | {v['status']:16s} | {v['sid']}\")"
```

---

## Handling Rejections (Error 30513)

If a verification is rejected with error 30513 ("Opt-in - Consent for messaging is a requirement for service"), update and resubmit the verification within 7 days to stay in the prioritized resubmission queue.

### Common rejection causes

- `opt_in_type` set to something other than `WEB_FORM`
- Missing `AdditionalInformation` describing the consent flow
- Missing `OptInConfirmationMessage`, `HelpMessageSample`, or `PrivacyPolicyUrl`
- `OptInImageUrls` not showing the actual opt-in mechanism

### Resubmit a rejected verification

Use the same fields from Step 3 but as a POST to the verification SID, with an `EditReason`:

```bash
curl -s -X POST \
  "https://messaging.twilio.com/v1/Tollfree/Verifications/HHxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "OptInType=WEB_FORM" \
  --data-urlencode "UseCaseSummary=Uplifter is a sports club management platform. Organizations send transactional SMS to parents and athletes: registration confirmations, schedule alerts, billing reminders, and coach messages." \
  --data-urlencode "ProductionMessageSample=Hi Jane, your registration for Summer Soccer Camp has been confirmed. First session is Mon Jun 15 at 9:00 AM. Reply STOP to opt out." \
  --data-urlencode "AdditionalInformation=Users create an account on our web app and provide their phone number during registration. They must click Send Verification Code and enter the SMS code to verify ownership. Only verified users receive SMS. Users can reply STOP to opt out and START to re-subscribe. All messages are transactional." \
  --data-urlencode "OptInConfirmationMessage=Your phone number has been verified. You will now receive SMS notifications from your organization. Reply STOP at any time to opt out." \
  --data-urlencode "HelpMessageSample=Reply STOP to unsubscribe. Reply START to re-subscribe. For help, contact your organization or email support@uplifterinc.com." \
  --data-urlencode "PrivacyPolicyUrl=https://www.uplifterinc.com/privacy-policy" \
  --data-urlencode "TermsAndConditionsUrl=https://www.uplifterinc.com/terms" \
  --data-urlencode "AgeGatedContent=false" \
  --data-urlencode "OptInKeywords=START" \
  --data-urlencode "OptInKeywords=YES" \
  --data-urlencode "OptInKeywords=UNSTOP" \
  --data-urlencode "OptInImageUrls=https://www.uplifterinc.com/privacy-policy" \
  --data-urlencode "UseCaseCategories=ACCOUNT_NOTIFICATIONS" \
  --data-urlencode "UseCaseCategories=CUSTOMER_CARE" \
  --data-urlencode "EditReason=Corrected opt-in type and added consent details" \
  | python3 -m json.tool
```

A successful update changes the status to `PENDING_REVIEW` or `IN_REVIEW`.

### Batch resubmit all rejected numbers

```bash
# List rejected verifications and resubmit each one
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://messaging.twilio.com/v1/Tollfree/Verifications?PageSize=50" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for v in data['verifications']:
    if v['status'] == 'TWILIO_REJECTED':
        print(v['sid'])" \
  | while read SID; do
    echo "Resubmitting: $SID"
    curl -s -X POST \
      "https://messaging.twilio.com/v1/Tollfree/Verifications/$SID" \
      -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      --data-urlencode "OptInType=WEB_FORM" \
      --data-urlencode "UseCaseSummary=Uplifter is a sports club management platform. Organizations send transactional SMS to parents and athletes: registration confirmations, schedule alerts, billing reminders, and coach messages." \
      --data-urlencode "ProductionMessageSample=Hi Jane, your registration for Summer Soccer Camp has been confirmed. First session is Mon Jun 15 at 9:00 AM. Reply STOP to opt out." \
      --data-urlencode "AdditionalInformation=Users create an account on our web app and provide their phone number during registration. They must click Send Verification Code and enter the SMS code to verify ownership. Only verified users receive SMS. Users can reply STOP to opt out and START to re-subscribe. All messages are transactional." \
      --data-urlencode "OptInConfirmationMessage=Your phone number has been verified. You will now receive SMS notifications from your organization. Reply STOP at any time to opt out." \
      --data-urlencode "HelpMessageSample=Reply STOP to unsubscribe. Reply START to re-subscribe. For help, contact your organization or email support@uplifterinc.com." \
      --data-urlencode "PrivacyPolicyUrl=https://www.uplifterinc.com/privacy-policy" \
      --data-urlencode "TermsAndConditionsUrl=https://www.uplifterinc.com/terms" \
      --data-urlencode "AgeGatedContent=false" \
      --data-urlencode "OptInKeywords=START" \
      --data-urlencode "OptInKeywords=YES" \
      --data-urlencode "OptInKeywords=UNSTOP" \
      --data-urlencode "OptInImageUrls=https://www.uplifterinc.com/privacy-policy" \
      --data-urlencode "UseCaseCategories=ACCOUNT_NOTIFICATIONS" \
      --data-urlencode "UseCaseCategories=CUSTOMER_CARE" \
      --data-urlencode "EditReason=Corrected opt-in type and added consent details" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d.get(\"tollfree_phone_number\",\"?\")} -> {d.get(\"status\",\"ERROR\")}')"
  done
```

---

## Verification Field Reference

These are the fields that have been tested and approved by Twilio for Uplifter:

| Field                           | Value                                               |
| ------------------------------- | --------------------------------------------------- |
| `OptInType`                     | `WEB_FORM`                                          |
| `CustomerProfileSid`            | From Twilio Console (Trust Hub > Customer Profiles) |
| `BusinessName`                  | `Uplifter LLC`                                      |
| `BusinessType`                  | `PRIVATE_PROFIT`                                    |
| `BusinessRegistrationAuthority` | `EIN`                                               |
| `BusinessRegistrationNumber`    | From existing approved verification                 |
| `UseCaseCategories`             | `ACCOUNT_NOTIFICATIONS`, `CUSTOMER_CARE`            |
| `MessageVolume`                 | `10,000`                                            |
| `AgeGatedContent`               | `false`                                             |
| `OptInKeywords`                 | `START`, `YES`, `UNSTOP`                            |

Do **not** use `MOBILE_QR_CODE` for `OptInType` -- this was the cause of the original 30513 rejections.

---

## Relevant Code

| What                                 | Where                                       |
| ------------------------------------ | ------------------------------------------- |
| Twilio client and verification fetch | `src/lib/twilio.ts`                         |
| SMS pool manager (env-based)         | `src/lib/sms-number-pool.ts`                |
| Superadmin pool dashboard            | `src/app/superadmin/usage/page.tsx`         |
| Pool env var                         | `SMS_PHONE_POOL` in `.env` / `.env.example` |
| Inbound SMS webhook                  | `src/app/api/twilio/webhook/route.ts`       |

---

## Twilio API Docs

- [Toll-free verification resource](https://www.twilio.com/docs/messaging/api/tollfree-verification-resource)
- [Error 30513 reference](https://www.twilio.com/docs/api/errors/30513)
- [Available phone numbers](https://www.twilio.com/docs/phone-numbers/api/availablephonenumber-tollfree-resource)
- [Incoming phone numbers](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource)
