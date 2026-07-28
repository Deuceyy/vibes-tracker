import baseCardData from '../cardData.json';
import set3TrackerCards from './set3TrackerCards.js';
import promoCards from './promoCards.js';
import { isReleasedTrackerCard } from '../lib/cardMetadata.js';

export const allTrackerCards = [...baseCardData, ...set3TrackerCards, ...promoCards];
export const releasedTrackerCards = allTrackerCards.filter(isReleasedTrackerCard);
export { set3TrackerCards, promoCards };
