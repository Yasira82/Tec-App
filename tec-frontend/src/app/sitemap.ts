import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

/**
 * What a crawler is told exists.
 *
 * `/pioneers` and `/pioneers/faq` were missing while `/privacy` and `/terms`
 * were listed — the campaign's own landing page absent from the list, on a page
 * that carries an Open Graph card, a canonical tag and a `summary_large_image`
 * twitter card, with an FAQ page underneath it publishing `FAQPage` structured
 * data built specifically so search results surface the questions.
 *
 * Structured data nobody crawls is work that does nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL,                   lastModified: new Date(), changeFrequency: 'weekly',  priority: 1 },
    // The campaign. Weekly, because the page states a count that moves.
    { url: `${SITE_URL}/pioneers`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE_URL}/pioneers/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/privacy`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terms`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
