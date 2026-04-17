// Tells TypeScript to treat CSS file imports as valid modules.
// Actual CSS processing is handled by Next.js/webpack at build time —
// this declaration only exists to silence ts(2882) at type-check time.
declare module "*.css";
