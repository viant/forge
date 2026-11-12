import React from 'react';
// Existing avatar names use the same Lucide stroke family as action icons.
// Decorative wink/sticker variants share Smile; nervous shares Frown.
import {UserRound as User, CircleUserRound as UserCircle, SquareUserRound as UserSquare, ScanFace as UserFocus, UserRoundCog as UserGear, UserRoundCheck as UserCheck, ContactRound as UserList, IdCard as IdentificationCard, ContactRound as IdentificationBadge, UsersRound as Users, UsersRound as UsersFour, UsersRound as UsersThree, Smile as Smiley, Frown as SmileySad, Meh as SmileyMeh, Smile as SmileyWink, CircleX as SmileyXEyes, Frown as SmileyNervous, Smile as SmileySticker, GraduationCap as Student, BadgeCheck as SealCheck, Star, Crown} from 'lucide-react';

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
    return <IconCmp size={size} color={color} {...rest} />;
}
