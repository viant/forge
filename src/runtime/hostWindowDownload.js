import {downloadBytes} from '../components/readerWorkbench/downloadBytes.js';

// The producer supplies bytes and a suggested filename. The host creates only
// a local Blob URL; no browser-selected network or filesystem URL is accepted.
export function downloadWindowArchive(result) {
  if (Array.isArray(result?.archive) && result.archive.length > 32*1024*1024 ||
      typeof result?.archive === 'string' && result.archive.length > 64*1024*1024) {
    throw new Error('The downloaded archive is too large.');
  }
  const bytes=downloadBytes(result?.archive);
  const filename=String(result?.filename || 'download').split(/[\\/]/).at(-1).replace(/[\u0000-\u001f\u007f]/g,'_') || 'download';
  const mediaType=/^[\w.+-]+\/[\w.+-]+$/.test(String(result?.mediaType || '')) ? result.mediaType : 'application/octet-stream';
  const url=URL.createObjectURL(new Blob([bytes],{type:mediaType}));
  const link=document.createElement('a');
  link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
