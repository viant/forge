import React, {useEffect, useRef, useState} from 'react';
import {Button, Dialog, DialogBody, DialogFooter} from '@blueprintjs/core';
import {Camera} from '@phosphor-icons/react';
import {cameraErrorMessage, captureCameraPhoto, createCameraSession, createPhotoCaptureAttempt} from './cameraCapture.js';
import './CameraCapture.css';

export default function CameraCapture({disabled, onCapture}) {
    const [open, setOpen] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [capturing, setCapturing] = useState(false);
    const videoRef = useRef(null);
    const sessionRef = useRef(null);
    const captureRef = useRef(null);
    const close = () => {captureRef.current?.cancel(); captureRef.current = null; sessionRef.current?.stop(); setOpen(false);};
    useEffect(() => {
        if (!open) return;
        let active = true;
        setReady(false);
        setCapturing(false);
        setError('');
        const session = createCameraSession(navigator.mediaDevices);
        sessionRef.current = session;
        session.start().then(stream => {
            if (active && stream && videoRef.current) videoRef.current.srcObject = stream;
        }).catch(reason => {if (active) setError(cameraErrorMessage(reason));});
        return () => {active = false; captureRef.current?.cancel(); captureRef.current = null; session.stop(); if (videoRef.current) videoRef.current.srcObject = null;};
    }, [open, attempt]);
    const capture = async () => {
        setCapturing(true);
        setError('');
        const attempt = createPhotoCaptureAttempt();
        captureRef.current?.cancel();
        captureRef.current = attempt;
        try {
            const attached = await attempt.run(() => captureCameraPhoto(videoRef.current), onCapture);
            if (attached && captureRef.current === attempt) close();
        } catch (reason) {if (captureRef.current === attempt) setError(cameraErrorMessage(reason));}
        finally {if (captureRef.current === attempt) setCapturing(false);}
    };
    return <>
        <Button type="button" minimal small disabled={disabled} icon={<Camera size={20}/>} className="composer-icon-btn composer-icon-btn--camera" aria-label="Add camera photo" title="Add camera photo" onClick={() => setOpen(true)}/>
        <Dialog isOpen={open} onClose={close} title="Take a photo" className="forge-camera-capture" aria-describedby="forge-camera-description">
            <DialogBody>
                <p id="forge-camera-description">Preview your camera, then capture a photo to attach to your message.</p>
                <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" onLoadedData={() => setReady(true)} onError={() => setError('The camera preview could not play. Try again.')}/>
                {error ? <p role="alert">{error}</p> : !ready && <p role="status">Waiting for camera access…</p>}
            </DialogBody>
            <DialogFooter actions={<>
                <Button type="button" onClick={close}>Cancel</Button>
                {error && <Button type="button" disabled={capturing} onClick={() => setAttempt(value => value + 1)}>Try again</Button>}
                <Button type="button" intent="primary" disabled={!ready || capturing} loading={capturing} onClick={capture}>Capture photo</Button>
            </>}/>
        </Dialog>
    </>;
}
