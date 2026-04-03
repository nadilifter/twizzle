module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-ticket-required": ({ subject }) => {
          if (!subject) return [false, "subject must not be empty"];
          return [
            /^US-\d+ /.test(subject),
            'subject must start with a ticket number (e.g., "US-123 add feature")',
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
    "subject-ticket-required": [2, "always"],
  },
};
