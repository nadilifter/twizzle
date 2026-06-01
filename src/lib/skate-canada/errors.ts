// Typed errors for the Skate Canada CRM client. Callers can `instanceof`-
// switch on these to surface friendly messages or trigger retries.

/** Top of the SC error tree. */
export class CrmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CrmError";
  }
}

/** Thrown when env-var config is missing or malformed. */
export class CrmConfigError extends CrmError {
  constructor(message: string) {
    super(message);
    this.name = "CrmConfigError";
  }
}

/** Thrown when Azure AD rejects our credentials (expired secret, wrong tenant, etc.). */
export class CrmAuthError extends CrmError {
  constructor(
    message: string,
    public code: string | null = null,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "CrmAuthError";
  }
}

/** Thrown when the CRM SOAP endpoint returns a soap:Fault. */
export class CrmFaultError extends CrmError {
  constructor(
    message: string,
    public faultCode: string | null = null
  ) {
    super(message);
    this.name = "CrmFaultError";
  }
}

/** Thrown when the response is unparseable / unexpected shape. */
export class CrmProtocolError extends CrmError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CrmProtocolError";
  }
}
