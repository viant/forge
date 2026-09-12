export function cameraErrorMessage(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser, then try again.';
    if (error?.name === 'NotFoundError') return 'No camera was found. Connect a camera, or use Add photos or files.';
    if (error?.name === 'NotReadableError') return 'The camera is unavailable. Close other apps using it, then try again.';
    return error?.message || 'Could not open the camera. Try again or use Add photos or files.';
}

// Owns the stream even if permission resolves after the dialog was dismissed.
export function createCameraSession(mediaDevices) {
    let closed = false;
    let stream = null;
    return {
        async start() {
            if (!mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable in this browser. Use Add photos or files.');
            const result = await mediaDevices.getUserMedia({video: {facingMode: 'user'}, audio: false});
            if (closed) {
                result.getTracks().forEach(track => track.stop());
                return null;
            }
            stream = result;
            return result;
        },
        stop() {
            closed = true;
            stream?.getTracks().forEach(track => track.stop());
            stream = null;
        },
    };
}

export async function captureCameraPhoto(video, canvas = document.createElement('canvas')) {
    if (!video?.videoWidth || !video?.videoHeight) throw new Error('The camera is still starting. Wait for the preview, then try again.');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const drawing = canvas.getContext('2d');
    if (!drawing) throw new Error('Photo capture is unavailable in this browser.');
    drawing.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Could not capture the photo. Please try again.');
    return new File([blob], `camera-${Date.now()}.jpg`, {type: 'image/jpeg'});
}

// Invalidate pending canvas work before it can attach after Cancel or unmount.
export function createPhotoCaptureAttempt() {
    let cancelled = false;
    return {
        cancel() { cancelled = true; },
        async run(capture, attach) {
            const photo = await capture();
            if (cancelled) return false;
            await attach(photo);
            return !cancelled;
        },
    };
}
