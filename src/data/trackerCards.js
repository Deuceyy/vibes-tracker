import baseCardData from '../cardData.json';
import set3TrackerCards from './set3TrackerCards.js';
import { isReleasedTrackerCard } from '../lib/cardMetadata.js';

export const allTrackerCards = [...baseCardData, ...set3TrackerCards];
export const releasedTrackerCards = allTrackerCards.filter(isReleasedTrackerCard);
export { set3TrackerCards };
