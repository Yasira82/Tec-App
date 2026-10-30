import type { Translations } from '@/lib/i18n';

type CampaignCopy = Translations['hub']['campaignPage'];

/**
 * The one thing to do in each campaign app, said in the pioneer's language.
 *
 * An app without a line here gets none — the report form still works, it just
 * asks the general question. Add a line when an app joins a round.
 */
export function missionHint(c: CampaignCopy, slug: string): string | undefined {
  const hints: Record<string, string> = {
    tec:       c.missionTec,
    commerce:  c.missionCommerce,
    ecommerce: c.missionEcommerce,
    assets:    c.missionAssets,
    life:      c.missionLife,
    zone:      c.missionZone,
  };
  return hints[slug];
}
