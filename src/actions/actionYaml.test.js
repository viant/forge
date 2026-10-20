import assert from 'node:assert/strict';
import {injectActions} from './action.js';
const metadata={namespace:'management',actions:{code:'({ parse(source) { return utilities.yaml.parse(source); } })'}};
injectActions(metadata);
const {parse}=metadata.actions.import({}).management;
assert.deepEqual(parse('Driver: mysql\nDSN: "${Username}:${Password}@tcp(localhost:3306)/example"\nSecret:\n  URL: file:///tmp/example.enc\n  Key: blowfish://default'),{Driver:'mysql',DSN:'${Username}:${Password}@tcp(localhost:3306)/example',Secret:{URL:'file:///tmp/example.enc',Key:'blowfish://default'}});
assert.throws(()=>parse('Driver: mysql\nDriver: sqlite'),/unique/i);
assert.throws(()=>parse('Secret: [unterminated'),/flow|end|parse/i);
console.log('window action YAML utility: exact references, duplicate and malformed input passed');
