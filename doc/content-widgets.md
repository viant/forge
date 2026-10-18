# Content widgets

`contentCarousel`, `cardRail`, `cardRailGroup`, and `filterChips` are presentation
widgets. Authored windows own domain mapping, data retrieval, and navigation.

Carousel records accept `id`, `title`, `description`, `image`, `graphicImage`,
and `actionLabel`. Set `wholeSlideAction` to expose a whole-slide button, and
`autoRotateMs` to enable rotation (minimum 1000 ms). Rotation pauses on focus,
hover, explicit pause, or reduced-motion preference.

Card rails accept `heading`, `description`, `icon`, `totalCount`, `countHint`,
and `value` (cards). `totalCount` may exceed the visible card count.
Cards accept `id`, `title`, `subtitle`, `image`, `fallbackImage`, `imageFit`,
`facts`, `tags`, `copyValue`, and `copyLabel`. Image URLs are limited to HTTP(S)
or root-relative paths. Failed primary images try the safe fallback before a
placeholder. Copy failures are announced without opening the card.

`cardRailGroup.value` is an array of rail records. The group adds `detail.section`
to action events. `onClick` supplies `detail.item`; `onTagClick` supplies both
`detail.item` and `detail.tag`; `onCountClick` identifies the rail. Authored `on`
handlers receive these under `event.detail`. Actions preserve the bound collection.
Tag and copy controls are siblings of the card-opening button, never nested buttons.

Tags accept `id`, `kind`, `label`, `selected`, and `disabled`. With an `onTagClick`
handler they render as buttons; otherwise they remain labels. `filterChips`
uses option values without coercion. Window adapters must normalize domain IDs
where the authored metadata compiler uses string-valued options.
