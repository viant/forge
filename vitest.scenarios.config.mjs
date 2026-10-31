import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'jsdom',include:['src/components/scenarios/*.render.test.jsx'],setupFiles:['./scripts/react-runtime-test-setup.js'],maxWorkers:1,server:{deps:{inline:[/@preact\/signals/,/@phosphor-icons\/react/]}}}});
