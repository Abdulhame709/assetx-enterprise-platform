import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
    rules: {
      // Existing controlled form/async hooks use effects to synchronize external
      // data. Keep these visible as warnings while refactoring them incrementally.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
