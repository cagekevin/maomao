import type { LANGUAGES } from '@videoEditor/constants/language-constants';

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language['code'];
