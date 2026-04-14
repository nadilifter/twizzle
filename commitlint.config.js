const VALID_TICKET_PREFIXES = ["US", "USC", "DEV", "LF"];
const ticketPattern = new RegExp(`^(${VALID_TICKET_PREFIXES.join("|")})-\\d+\\s`);

module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "ticket-prefix": ({ subject }) => {
          if (!subject) return [false, "subject must not be empty"];
          return [
            ticketPattern.test(subject),
            `subject must start with a ticket number (${VALID_TICKET_PREFIXES.map((p) => `${p}-###`).join(", ")})`,
          ];
        },
      },
    },
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "chore", "style", "docs", "test", "perf"],
    ],
    "type-case": [2, "always", "lower-case"],
    "subject-case": [0],
    "subject-full-stop": [2, "never", "."],
    "scope-empty": [2, "always"],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "ticket-prefix": [0],
  },
};
