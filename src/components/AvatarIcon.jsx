import React from 'react';
// Import only the avatar-related icons we need from phosphor-react so the
// bundle contains just these icons and nothing else.
import {
    User,
    UserCircle,
    UserSquare,
    UserFocus,
    UserGear,
    UserCheck,
    UserList,
    IdentificationCard,
    IdentificationBadge,
    Users,
    UsersFour,
    UsersThree,
    Smiley,
    SmileySad,
    SmileyMeh,
    SmileyWink,
    SmileyXEyes,
    SmileyNervous,
    SmileySticker,
    Student,
    SealCheck,
    Star,
    Crown,
} from '@phosphor-icons/react';

// Map icon names to the imported components so callers can reference icons by
// name string.
const avatarIcons = {
    User,
    UserCircle,
    UserSquare,
    UserFocus,
    UserGear,
    UserCheck,
    UserList,
    IdentificationCard,
    IdentificationBadge,
    Users,
    UsersFour,
    UsersThree,
    Smiley,
    SmileySad,
    SmileyMeh,
    SmileyWink,
    SmileyXEyes,
    SmileyNervous,
    SmileySticker,
    Student,
    SealCheck,
    Star,
    Crown,
};

export default function AvatarIcon({ name = 'User', size = 16, weight = 'regular', color, ...rest }) {
    const IconCmp = avatarIcons[name] || User;
    return <IconCmp size={size} weight={weight} color={color} {...rest} />;
}
