import assert from 'node:assert/strict';
import {normalizeMediaPreview, MAX_EMBEDDED_IMAGE_BYTES} from './mediaPreview.js';

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
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=';
const embedded = (mimeType, payload) => normalizeMediaPreview({kind:'image',image:{mimeType,payload},alt:'Synthetic pixel'});
assert.equal(embedded('image/png',pixel).url, `data:image/png;base64,${pixel}`);
assert.equal(embedded('image/png',pixel).embedded, true);
assert.equal(embedded('image/png',pixel).alt, 'Synthetic pixel');
for (const [mime,bytes] of [['image/jpeg',[255,216,255,224]],['image/gif','GIF89a'],['image/webp','RIFF0000WEBP']]) {
    assert.equal(embedded(mime,Buffer.from(bytes).toString('base64')).kind,'image');
}
for (const [mime,payload] of [['image/svg+xml',Buffer.from('<svg onload="alert(1)"/>').toString('base64')],['text/html',pixel],['image/jpeg',pixel],['image/png','%%%%'],['image/png',pixel.slice(1)],['image/png','AAAA=AAA']]) {
    assert.equal(embedded(mime,payload).kind,'unsupported');
}
assert.equal(normalizeMediaPreview({kind:'image',image:{mimeType:'image/png',payload:'invalid'},url:'https://example.com/fallback.png'}).url,'');
const oversized = Buffer.alloc(MAX_EMBEDDED_IMAGE_BYTES+1);oversized.set([137,80,78,71,13,10,26,10]);
assert.equal(embedded('image/png',oversized.toString('base64')).kind,'unsupported');
console.log('media preview tests passed');
const frame = normalizeMediaPreview({kind:'frame',url:'https://example.test/render?id=42',width:350,height:280,
    sources:[{label:'SOURCE',url:'view-source:http://example.test/render?id=42'},
        {label:'Bad',url:'javascript:alert(1)'},{label:'Credentials',url:'https://user:pass@example.test/'}]});
assert.equal(frame.kind,'frame');
assert.equal(frame.width,350);
assert.deepEqual(frame.sources,[{label:'SOURCE',url:'view-source:http://example.test/render?id=42'}]);
assert.deepEqual(normalizeMediaPreview(frame),frame);
for(const url of ['javascript:alert(1)','data:text/html,hello','view-source:javascript:alert(1)','https://','https://user:pass@example.test/']) {
    assert.equal(normalizeMediaPreview({kind:'frame',url}).kind,'unsupported');
}
assert.equal(normalizeMediaPreview({kind:'frame',url:'https://example.test',width:-1,height:Infinity}).width,400);
const card=normalizeMediaPreview({kind:'imageCard',url:'https://example.test/image.png',title:'<script>text</script>',description:'Caption',caption:'Sponsor',href:'javascript:alert(1)',identity:42});
assert.equal(card.kind,'imagecard');assert.equal(card.href,'');assert.equal(card.identity,'42');assert.equal(card.title,'<script>text</script>');assert.equal(normalizeMediaPreview({kind:'imageCard',title:'No image'}).kind,'imagecard');
