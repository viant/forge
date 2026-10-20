import assert from 'node:assert/strict';
import {normalizeMediaPreview} from './mediaPreview.js';

assert.deepEqual(normalizeMediaPreview({kind: 'image', url: 'https://example.com/a.png', alt: 'A'}), {
    kind: 'image', url: 'https://example.com/a.png', alt: 'A', message: 'Preview is not available for this media type.',
});
assert.equal(normalizeMediaPreview({kind: 'video', url: 'http://insecure.example/a.mp4'}).kind, 'video');
assert.equal(normalizeMediaPreview({kind: 'vast', url: 'https://example.com/vast.xml'}).kind, 'unsupported');
assert.equal(normalizeMediaPreview(null).message, 'No preview asset is available.');

assert.equal(normalizeMediaPreview({kind:'image',url:'javascript:alert(1)'}).kind,'unsupported');
assert.equal(normalizeMediaPreview({kind:'image',url:'data:image/svg+xml,<svg/>'}).kind,'unsupported');
assert.equal(normalizeMediaPreview({kind:'image',url:'blob:http://localhost/owned'}).kind,'unsupported');
assert.equal(normalizeMediaPreview({kind:'image',url:'blob:http://localhost/owned'},{trustedBlob:true}).kind,'image');
console.log('media preview tests passed');
const card=normalizeMediaPreview({kind:'imageCard',url:'https://example.test/image.png',title:'<script>text</script>',description:'Caption',caption:'Sponsor',href:'javascript:alert(1)',identity:42});
assert.equal(card.kind,'imagecard');assert.equal(card.href,'');assert.equal(card.identity,'42');assert.equal(card.title,'<script>text</script>');assert.equal(normalizeMediaPreview({kind:'imageCard',title:'No image'}).kind,'imagecard');
