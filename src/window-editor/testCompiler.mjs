// Tests compile with Forge's own source loader; no prebuilt /tmp helper is required.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function compileWindowSource(source) {
 return execFileSync('go',['run','./scripts/window-source-compile'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{...process.env,GOWORK:'off'},input:JSON.stringify(source),maxBuffer:16*1024*1024}).toString();
}
