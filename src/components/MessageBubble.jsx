// MessageBubble.jsx – single chat bubble following styles from chat.css.

import React from 'react';
import { format as formatDate } from 'date-fns';

export default function MessageBubble({ children, role = 'assistant', timestamp = new Date() }) {
    const bubbleClass =
        (role === 'user'
            ? 'chat-bubble chat-user'
            : role === 'assistant'
                ? 'chat-bubble chat-bot'
                : 'chat-bubble chat-tool');

    return (
        <div className={bubbleClass} data-ts={formatDate(new Date(timestamp), 'HH:mm')}>
            {children}
        </div>
    );
}
