import type { Config } from 'jest';
import { createDefaultPreset } from 'ts-jest';

const config: Config = {
    // verbose: true,
    reporters: [
        'default',
        ['jest-junit', { outputDirectory: 'test-results', outputName: 'jest.xml' }]
    ],
    ...createDefaultPreset()
};

export default config;
