import React, {useState} from 'react';
import Popover from '../../components/Popover.jsx';
import Button from '../../components/Button.jsx';
import Typography from '../../components/Typography.jsx';
import './floatingPanelSpecimen.css';

export default function FloatingPanelSpecimen() {
    const [large, setLarge] = useState(false);
    return <section aria-label="Anchored panels specimen">
        <Typography as="h3" typeRole="section">Panels stay in view</Typography>
        <Typography as="p" typeRole="body">Panels choose an available side and keep space around the viewport. Oversized content scrolls inside the panel.</Typography>
        <label><input type="checkbox" checked={large} onChange={event => setLarge(event.target.checked)}/>Show oversized content</label>
        <div className="forge-floating-panel-specimen">
            {['top', 'bottom', 'right', 'left'].map(side => <Popover popupKind="dialog" key={side} minimal placement={side} shouldReturnFocusOnClose
                content={<div className="forge-floating-panel-example" role="dialog" aria-label={`${side} panel`}>
                    <Typography as="p" typeRole="body">Preferred side: {side}</Typography>
                    {Array.from({length: large ? 30 : 1}, (_, index) => <Button key={index} variant="ghost">Example action {index + 1}</Button>)}
                </div>}><Button variant="secondary">Open {side} panel</Button></Popover>)}
        </div>
    </section>;
}
