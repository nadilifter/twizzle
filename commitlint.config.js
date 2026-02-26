module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'chore', 'style', 'docs', 'test', 'perf'],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'scope-empty': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
  },
};
