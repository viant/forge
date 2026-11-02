import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'jsdom',include:['src/components/primitives/ReleaseManager.render.test.jsx','src/components/primitives/ReleaseAssignments.render.test.jsx']}});
