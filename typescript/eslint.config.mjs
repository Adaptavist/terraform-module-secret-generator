import parser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import node from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import globals from 'globals';
import standardRules from './standard-rules.cjs';

export default [
    { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'coverage/**'] },
    {
        files: ['**/*.{js,cjs,mjs,ts}'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.jest }
        }
    },
    {
        files: ['**/*.ts'],
        languageOptions: { parser },
        plugins: { '@stylistic': stylistic, 'import-x': importX, n: node, promise },
        rules: standardRules
    }
];
