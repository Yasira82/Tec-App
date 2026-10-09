import type { NavIntent } from '@/lib/ai/nav-intents';

/** One rendered bubble. `streaming` marks the reply currently being written. */
export interface ChatMessage {
  role:       'user' | 'ai';
  text:       string;
  streaming?: boolean;
  /** Destinations the model recommended, once the reply is complete. */
  intents?:   NavIntent[];
  /** Thumbnails of the photos sent with this message (a PDF is ''). Shown at the top of the bubble. */
  thumbs?:    string[];
}
