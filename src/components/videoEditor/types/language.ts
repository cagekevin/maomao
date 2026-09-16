import type { LANGUAGES } from '@/components/videoEditor/constants/language-constants';

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language['code'];
