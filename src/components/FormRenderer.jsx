// FormRenderer.jsx – sample custom chat message renderer that shows a prompt
// followed by a SchemaBasedForm generated from the `elicitation.requestedSchema`
// field inside the chat message.

import React from 'react';
import SchemaBasedForm from '../widgets/SchemaBasedForm.jsx';

/**
 * Props
 *   message – chat message object containing `elicitation`
 *   context – chat context bag (handlers, etc.)
 */
export default function FormRenderer({ message, context }) {
    const requestedSchema = message?.elicitation?.requestedSchema;
    const prompt          = message?.elicitation?.message || message?.elicitation?.prompt;
    if (!requestedSchema) {
        return null;
    }

    const handleSubmit = (payload) => {
        context?.handlers?.chat?.submitMessage?.({
            context,
            message: {
                role: 'user',
                content: JSON.stringify(payload),
            },
        });
    };

    return (
        <div className="space-y-2">
            {prompt && <p>{prompt}</p>}

            <SchemaBasedForm
                requestedSchema={requestedSchema}
                dataBinding={`window.state.answers.${message.id}`}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
